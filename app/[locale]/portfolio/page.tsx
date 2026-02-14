"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { TRAINING_DIRECTIONS, DIRECTION_COLORS } from "@/lib/engine/portfolio-types";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Loader2,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";
import SkillRadar from "@/components/charts/SkillRadar";
import EfficientFrontier from "@/components/charts/EfficientFrontier";
import {
  getCurrentProject,
  saveProject,
  type ProjectPortfolioResult,
} from "@/lib/project-manager";
import { useProject } from "@/lib/project-context";

interface FrontierPoint {
  risk: number;
  return_: number;
  weights: number[];
  sharpeRatio: number;
}

interface SelectedPortfolio {
  weights: number[];
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
  diversificationScore: number;
}

interface OptimizeResult {
  frontier: FrontierPoint[];
  selectedPortfolio: SelectedPortfolio;
}

export default function PortfolioPage() {
  const t = useTranslations("portfolio");
  const locale = useLocale();
  const router = useRouter();
  const { refreshCurrentProject } = useProject();

  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFrontierIdx, setSelectedFrontierIdx] = useState<number | null>(null);
  const [noAnalysis, setNoAnalysis] = useState(false);
  const hasOptimized = useRef(false);
  const skipAutoOptimize = useRef(false);

  // Restore saved portfolio results on mount
  useEffect(() => {
    const project = getCurrentProject();
    if (!project?.analysis || !project?.sourceData) {
      setNoAnalysis(true);
      return;
    }
    if (project.portfolioResult) {
      const pr = project.portfolioResult;
      setRiskTolerance(pr.riskTolerance);
      setResult({
        frontier: pr.frontier,
        selectedPortfolio: pr.selectedPortfolio,
      });
      hasOptimized.current = true;
    }
  }, []);

  const optimize = useCallback(async () => {
    setLoading(true);
    try {
      const project = getCurrentProject();
      if (!project?.analysis || !project?.sourceData) return;

      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: project.sourceData.topics,
          affinityMatrix: project.analysis.affinityMatrix,
          riskTolerance,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Normalize API response (snake_case) to component format (camelCase)
        const frontier: FrontierPoint[] = (data.frontier || []).map(
          (p: { risk: number; return: number; weights: number[]; sharpe_ratio: number }) => ({
            risk: p.risk,
            return_: p.return,
            weights: p.weights,
            sharpeRatio: p.sharpe_ratio,
          })
        );
        const sel = data.selected_portfolio || data.frontier?.[0] || {};
        const weights = sel.weights || [];
        // Compute diversification score: 1 - HHI (Herfindahl index)
        const hhi = weights.reduce((sum: number, w: number) => sum + w * w, 0);
        const diversificationScore = 1 - hhi;

        const selectedPortfolio: SelectedPortfolio = {
          weights,
          expectedReturn: sel.return ?? 0,
          risk: sel.risk ?? 0,
          sharpeRatio: sel.sharpe_ratio ?? 0,
          diversificationScore,
        };

        setResult({ frontier, selectedPortfolio });
        setSelectedFrontierIdx(null);

        // Save to active project
        if (project) {
          const portfolioResult: ProjectPortfolioResult = {
            frontier,
            selectedPortfolio,
            riskTolerance,
          };
          project.portfolioResult = portfolioResult;
          saveProject(project);
          refreshCurrentProject();
        }
      }
    } catch (err) {
      console.error("Optimization error:", err);
    } finally {
      setLoading(false);
    }
    hasOptimized.current = true;
  }, [riskTolerance]);

  // Auto-optimize when slider changes (only after first manual optimize)
  useEffect(() => {
    if (!hasOptimized.current) return;
    if (skipAutoOptimize.current) {
      skipAutoOptimize.current = false;
      return;
    }
    const timer = setTimeout(() => {
      optimize();
    }, 500);
    return () => clearTimeout(timer);
  }, [riskTolerance, optimize]);

  // Handle frontier dot click — sync slider to reflect the selected point
  const handleFrontierSelect = useCallback((idx: number) => {
    if (!result) return;
    setSelectedFrontierIdx(idx);

    const frontier = result.frontier;
    if (frontier.length < 2) return;
    const minRisk = frontier[0].risk;
    const maxRisk = frontier[frontier.length - 1].risk;
    if (maxRisk - minRisk < 1e-8) return;

    const dotRisk = frontier[idx].risk;
    const sliderValue = (dotRisk - minRisk) / (maxRisk - minRisk);

    skipAutoOptimize.current = true;
    setRiskTolerance(Math.max(0, Math.min(1, sliderValue)));
  }, [result]);

  const activeWeights = selectedFrontierIdx !== null && result
    ? result.frontier[selectedFrontierIdx].weights
    : result?.selectedPortfolio.weights || [];

  const activeReturn = selectedFrontierIdx !== null && result
    ? result.frontier[selectedFrontierIdx].return_
    : result?.selectedPortfolio.expectedReturn || 0;

  const activeRisk = selectedFrontierIdx !== null && result
    ? result.frontier[selectedFrontierIdx].risk
    : result?.selectedPortfolio.risk || 0;

  const activeSharpe = selectedFrontierIdx !== null && result
    ? result.frontier[selectedFrontierIdx].sharpeRatio
    : result?.selectedPortfolio.sharpeRatio || 0;

  const handleGenerate = () => {
    if (!result) return;
    const weights = activeWeights;
    // Save final selected weights to project
    const project = getCurrentProject();
    if (project && project.portfolioResult) {
      project.portfolioResult.selectedPortfolio.weights = weights;
      saveProject(project);
      refreshCurrentProject();
    }
    router.push("/courses");
  };

  if (noAnalysis) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{t("no_analysis")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("subtitle")}</p>

      {/* Risk Tolerance Slider */}
      <div className="mb-8 rounded-xl border border-border bg-card p-6">
        <label className="mb-1 block text-sm font-semibold">
          {t("risk_tolerance")}
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          {t("risk_hint")}
        </p>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={riskTolerance}
          onChange={(e) => setRiskTolerance(parseFloat(e.target.value))}
          className="mb-2 w-full accent-primary"
        />
        <div className="flex justify-between text-xs">
          <span className="flex items-center gap-1 text-success">
            <Shield className="h-3 w-3" />
            {t("conservative")}
          </span>
          <span className="font-medium text-primary">{t("balanced")}</span>
          <span className="flex items-center gap-1 text-danger">
            <Zap className="h-3 w-3" />
            {t("aggressive")}
          </span>
        </div>

        {!result && (
          <>
            <p className="mt-4 mb-2 text-xs text-muted-foreground">
              {t("optimize_hint")}
            </p>
            <button
              onClick={optimize}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {locale === "el" ? "Βελτιστοποίηση..." : "Optimizing..."}
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4" />
                {t("optimize")}
              </>
            )}
            </button>
          </>
        )}
      </div>

      {result && (
        <>
          {/* Stats Cards */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("expected_return")}
              </div>
              <div className="text-2xl font-bold text-primary">
                {(activeReturn * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("risk")}
              </div>
              <div className="text-2xl font-bold text-accent">
                {(activeRisk * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("sharpe")}
              </div>
              <div className="text-2xl font-bold text-success">
                {activeSharpe.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("diversification")}
              </div>
              <div className="text-2xl font-bold text-secondary">
                {((result.selectedPortfolio.diversificationScore) * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="mb-8 grid gap-8 lg:grid-cols-2">
            {/* Efficient Frontier */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t("efficient_frontier")}
              </h2>
              <EfficientFrontier
                frontier={result.frontier}
                selectedIdx={selectedFrontierIdx}
                onSelect={handleFrontierSelect}
                optimumIdx={result.frontier.findIndex(
                  (p) =>
                    Math.abs(p.risk - result.selectedPortfolio.risk) < 0.001
                )}
              />
            </div>

            {/* Skill Radar */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="h-5 w-5 text-primary" />
                {t("skill_distribution")}
              </h2>
              <SkillRadar weights={activeWeights} locale={locale} />
            </div>
          </div>

          {/* Weight Breakdown */}
          <div className="mb-8 rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold">
              {locale === "el" ? "Κατανομή Βαρών" : "Weight Allocation"}
            </h3>
            <div className="space-y-3">
              {TRAINING_DIRECTIONS.map((dir, i) => {
                const weight = activeWeights[i] || 0;
                return (
                  <div key={dir.key} className="flex items-center gap-3">
                    <span className="w-32 truncate text-sm sm:w-64">
                      {locale === "el" ? dir.name_el : dir.name}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${weight * 100}%`,
                          backgroundColor: DIRECTION_COLORS[i],
                        }}
                      />
                    </div>
                    <span className="w-14 text-right text-sm font-medium">
                      {(weight * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {t("generate_btn")}
            <ArrowRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
