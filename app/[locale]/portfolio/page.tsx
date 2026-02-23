"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { TRAINING_DIRECTIONS, DIRECTION_COLORS, findMarketAlignedIndex } from "@/lib/engine/portfolio-types";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Loader2,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
  Bookmark,
  Trash2,
  GitCompareArrows,
  Eye,
  EyeOff,
  Check,
  Upload,
  FolderOpen,
} from "lucide-react";
import SkillRadar from "@/components/charts/SkillRadar";
import type { ComparisonEntry } from "@/components/charts/SkillRadar";
import SkillGap from "@/components/charts/SkillGap";
import EfficientFrontier from "@/components/charts/EfficientFrontier";
import {
  getCurrentProject,
  saveProject,
  type ProjectPortfolioResult,
  type SavedPortfolio,
} from "@/lib/project-manager";
import { useProject } from "@/lib/project-context";
import { EmptyState } from "@/components/ui/EmptyState";

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

const COMPARISON_COLORS = [
  "#f59e0b", // amber
  "#ef4444", // red
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#06b6d4", // cyan
];

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function PortfolioPage() {
  const t = useTranslations("portfolio");
  const locale = useLocale();
  const router = useRouter();
  const { currentProject, refreshCurrentProject } = useProject();

  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFrontierIdx, setSelectedFrontierIdx] = useState<number | null>(null);
  const [noAnalysis, setNoAnalysis] = useState(false);
  const hasOptimized = useRef(false);
  const skipAutoOptimize = useRef(false);

  // Portfolio comparison & active tracking
  const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  // Restore saved portfolio results on mount or project switch
  useEffect(() => {
    if (!currentProject?.analysis || !currentProject?.sourceData) {
      setNoAnalysis(true);
      setResult(null);
      setSavedPortfolios([]);
      setActivePortfolioId(null);
      return;
    }
    setNoAnalysis(false);
    if (currentProject.portfolioResult) {
      const pr = currentProject.portfolioResult;
      setRiskTolerance(pr.riskTolerance);
      setResult({
        frontier: pr.frontier,
        selectedPortfolio: pr.selectedPortfolio,
      });
      hasOptimized.current = true;
      // if the user just arrived from the analysis page and hasn't optimized
    } else {
      setResult(null);
      hasOptimized.current = false;
    }
    setSavedPortfolios(currentProject.savedPortfolios || []);
    setActivePortfolioId(currentProject.activePortfolioId || null);
    setComparisonIds(new Set());
    setShowComparison(false);
    setSelectedFrontierIdx(null);
    setShowSaveInput(false);
    setSaveLabel("");
  }, [currentProject]);

  // Helper to persist portfolios + activeId to project
  const persistPortfolios = useCallback((
    portfolios: SavedPortfolio[],
    activeId: string | null,
    portfolioResult?: ProjectPortfolioResult
  ) => {
    const project = getCurrentProject();
    if (!project) return;
    project.savedPortfolios = portfolios;
    project.activePortfolioId = activeId;
    if (portfolioResult) {
      project.portfolioResult = portfolioResult;
    }
    saveProject(project);
    refreshCurrentProject();
  }, [refreshCurrentProject]);

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
        const hhi = weights.reduce((sum: number, w: number) => sum + w * w, 0);
        const diversificationScore = 1 - hhi;

        const selectedPortfolio: SelectedPortfolio = {
          weights,
          expectedReturn: sel.return ?? 0,
          risk: sel.risk ?? 0,
          sharpeRatio: sel.sharpe_ratio ?? 0,
          diversificationScore,
        };

        // On first optimize, auto-select market-aligned portfolio and save as "Optimized"
        const isFirstOptimize = !hasOptimized.current;
        let finalSelectedPortfolio = selectedPortfolio;
        let finalFrontierIdx: number | null = null;
        let finalRiskTolerance = riskTolerance;

        if (isFirstOptimize && frontier.length > 1) {
          const bestIdx = findMarketAlignedIndex(frontier);
          const bestPoint = frontier[bestIdx];

          const hhi2 = bestPoint.weights.reduce((sum: number, w: number) => sum + w * w, 0);
          finalSelectedPortfolio = {
            weights: bestPoint.weights,
            expectedReturn: bestPoint.return_,
            risk: bestPoint.risk,
            sharpeRatio: bestPoint.sharpeRatio,
            diversificationScore: 1 - hhi2,
          };
          finalFrontierIdx = bestIdx;

          // Compute the corresponding slider position
          const minRisk = frontier[0].risk;
          const maxRisk = frontier[frontier.length - 1].risk;
          if (maxRisk - minRisk > 1e-8) {
            finalRiskTolerance = Math.max(0, Math.min(1,
              (bestPoint.risk - minRisk) / (maxRisk - minRisk)
            ));
          }

          skipAutoOptimize.current = true;
          setRiskTolerance(finalRiskTolerance);

          // Auto-save the "Optimized" benchmark portfolio
          const optimizedPortfolio: SavedPortfolio = {
            id: generateId(),
            label: locale === "el" ? "Βελτιστοποιημένο" : "Optimized",
            savedAt: new Date().toISOString(),
            riskTolerance: finalRiskTolerance,
            weights: [...bestPoint.weights],
            expectedReturn: bestPoint.return_,
            risk: bestPoint.risk,
            sharpeRatio: bestPoint.sharpeRatio,
            diversificationScore: 1 - hhi2,
            isOptimized: true,
          };

          const updatedPortfolios = [optimizedPortfolio, ...savedPortfolios.filter((p) => !p.isOptimized)];
          setSavedPortfolios(updatedPortfolios);
          setActivePortfolioId(optimizedPortfolio.id);

          // Persist
          const portfolioResult: ProjectPortfolioResult = {
            frontier,
            selectedPortfolio: finalSelectedPortfolio,
            riskTolerance: finalRiskTolerance,
          };
          setResult({ frontier, selectedPortfolio: finalSelectedPortfolio });
          setSelectedFrontierIdx(finalFrontierIdx);
          persistPortfolios(updatedPortfolios, optimizedPortfolio.id, portfolioResult);
        } else {
          setResult({ frontier, selectedPortfolio: finalSelectedPortfolio });
          setSelectedFrontierIdx(finalFrontierIdx);

          // Save to active project (subsequent optimizations)
          const portfolioResult: ProjectPortfolioResult = {
            frontier,
            selectedPortfolio: finalSelectedPortfolio,
            riskTolerance: finalRiskTolerance,
          };
          const project2 = getCurrentProject();
          if (project2) {
            project2.portfolioResult = portfolioResult;
            saveProject(project2);
            refreshCurrentProject();
          }
        }
      }
    } catch (err) {
      console.error("Optimization error:", err);
    } finally {
      setLoading(false);
    }
    hasOptimized.current = true;
  }, [riskTolerance, refreshCurrentProject, persistPortfolios, savedPortfolios, locale]);

  // Auto-optimize on mount if we haven't done it yet
  useEffect(() => {
    if (result || hasOptimized.current || loading || noAnalysis) return;
    optimize();
  }, [result, loading, noAnalysis, optimize]);

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

  // ---- Determine which data to display ----
  // If a saved portfolio is active AND we're not exploring (no frontier dot selected
  // after clicking the saved portfolio), show the active portfolio's data.
  const activePortfolio = activePortfolioId
    ? savedPortfolios.find((p) => p.id === activePortfolioId)
    : null;

  const displayWeights = selectedFrontierIdx !== null && result
    ? result.frontier[selectedFrontierIdx].weights
    : result?.selectedPortfolio.weights || [];

  const displayReturn = selectedFrontierIdx !== null && result
    ? result.frontier[selectedFrontierIdx].return_
    : result?.selectedPortfolio.expectedReturn || 0;

  const displayRisk = selectedFrontierIdx !== null && result
    ? result.frontier[selectedFrontierIdx].risk
    : result?.selectedPortfolio.risk || 0;

  const displaySharpe = selectedFrontierIdx !== null && result
    ? result.frontier[selectedFrontierIdx].sharpeRatio
    : result?.selectedPortfolio.sharpeRatio || 0;

  const displayDiversification = result?.selectedPortfolio.diversificationScore || 0;

  // ---- Portfolio Comparison Handlers ----

  const handleSelectPortfolio = useCallback((portfolio: SavedPortfolio) => {
    setActivePortfolioId(portfolio.id);

    // Update display: set result.selectedPortfolio to this portfolio's data
    if (result) {
      const updated: OptimizeResult = {
        frontier: result.frontier,
        selectedPortfolio: {
          weights: portfolio.weights,
          expectedReturn: portfolio.expectedReturn,
          risk: portfolio.risk,
          sharpeRatio: portfolio.sharpeRatio,
          diversificationScore: portfolio.diversificationScore,
        },
      };
      setResult(updated);
      setSelectedFrontierIdx(null);

      // Move slider to this portfolio's risk tolerance
      skipAutoOptimize.current = true;
      setRiskTolerance(portfolio.riskTolerance);
    }

    // Persist
    const project = getCurrentProject();
    if (project) {
      project.activePortfolioId = portfolio.id;
      if (project.portfolioResult) {
        project.portfolioResult.selectedPortfolio = {
          weights: portfolio.weights,
          expectedReturn: portfolio.expectedReturn,
          risk: portfolio.risk,
          sharpeRatio: portfolio.sharpeRatio,
          diversificationScore: portfolio.diversificationScore,
        };
        project.portfolioResult.riskTolerance = portfolio.riskTolerance;
      }
      saveProject(project);
      refreshCurrentProject();
    }
  }, [result, refreshCurrentProject]);

  const handleSavePortfolio = () => {
    if (!result) return;
    const label = saveLabel.trim() || `Portfolio ${savedPortfolios.length + 1}`;
    const newPortfolio: SavedPortfolio = {
      id: generateId(),
      label,
      savedAt: new Date().toISOString(),
      riskTolerance,
      weights: [...displayWeights],
      expectedReturn: displayReturn,
      risk: displayRisk,
      sharpeRatio: displaySharpe,
      diversificationScore: displayDiversification,
    };
    const updated = [...savedPortfolios, newPortfolio];
    setSavedPortfolios(updated);
    setActivePortfolioId(newPortfolio.id);
    setSaveLabel("");
    setShowSaveInput(false);

    persistPortfolios(updated, newPortfolio.id);
  };

  const handleDeleteSaved = (id: string) => {
    // Prevent deleting the Optimized benchmark
    const portfolio = savedPortfolios.find((p) => p.id === id);
    if (portfolio?.isOptimized) return;

    const updated = savedPortfolios.filter((p) => p.id !== id);
    setSavedPortfolios(updated);
    setComparisonIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    // If the deleted portfolio was active, fall back to the Optimized one
    let newActiveId = activePortfolioId;
    if (activePortfolioId === id) {
      const optimized = updated.find((p) => p.isOptimized);
      newActiveId = optimized?.id || updated[0]?.id || null;
      setActivePortfolioId(newActiveId);
      // Update display to the new active portfolio
      if (newActiveId) {
        const fallback = updated.find((p) => p.id === newActiveId);
        if (fallback) handleSelectPortfolio(fallback);
      }
    }

    persistPortfolios(updated, newActiveId);
  };

  const toggleComparison = (id: string) => {
    setComparisonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Build comparison entries for the radar chart
  const comparisonEntries: ComparisonEntry[] = savedPortfolios
    .filter((p) => comparisonIds.has(p.id))
    .map((p, i) => ({
      label: p.label,
      weights: p.weights,
      color: COMPARISON_COLORS[i % COMPARISON_COLORS.length],
    }));

  const handleGenerate = () => {
    if (!result) return;
    // Use the active portfolio's weights for generation
    const genPortfolio = activePortfolio || savedPortfolios[0];
    const weights = genPortfolio ? genPortfolio.weights : displayWeights;

    const project = getCurrentProject();
    if (project && project.portfolioResult) {
      project.portfolioResult.selectedPortfolio.weights = weights;
      saveProject(project);
      refreshCurrentProject();
    }
    router.push("/courses");
  };

  if (!currentProject) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={FolderOpen}
          title={t("no_project_title")}
          message={t("no_project_message")}
          action={
            <button
              onClick={() => router.push("/")}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {t("go_home")}
            </button>
          }
        />
      </div>
    );
  }

  if (noAnalysis) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={Upload}
          title={t("no_analysis_title")}
          message={t("no_analysis")}
          action={
            <button
              onClick={() => router.push("/upload")}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {t("go_upload")}
            </button>
          }
        />
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
                {(displayReturn * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("risk")}
              </div>
              <div className="text-2xl font-bold text-accent">
                {(displayRisk * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("sharpe")}
              </div>
              <div className="text-2xl font-bold text-success">
                {displaySharpe.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("diversification")}
              </div>
              <div className="text-2xl font-bold text-secondary">
                {(displayDiversification * 100).toFixed(0)}%
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
              <SkillRadar
                weights={displayWeights}
                locale={locale}
                comparisons={showComparison ? comparisonEntries : undefined}
              />
            </div>
          </div>

          {/* Skill Gap Analysis */}
          <div className="mb-8 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t("skill_gap")}
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {t("skill_gap_desc")}
            </p>
            <SkillGap weights={displayWeights} locale={locale} />
            <div className="mt-2 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success opacity-70" />
                {locale === "el" ? "Υπερκάλυψη" : "Surplus"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive opacity-70" />
                {locale === "el" ? "Κενό" : "Deficit"}
              </span>
            </div>
          </div>

          {/* Weight Breakdown */}
          <div className="mb-8 rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold">
              {locale === "el" ? "Κατανομή Βαρών" : "Weight Allocation"}
            </h3>
            <div className="space-y-3">
              {TRAINING_DIRECTIONS.map((dir, i) => {
                const weight = displayWeights[i] || 0;
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

          {/* Portfolio Comparison Section */}
          <div className="mb-8 rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold">
                <GitCompareArrows className="h-5 w-5 text-primary" />
                {t("portfolio_comparison")}
              </h3>
              <div className="flex items-center gap-2">
                {savedPortfolios.length > 1 && (
                  <button
                    onClick={() => setShowComparison(!showComparison)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      showComparison
                        ? "bg-primary text-white"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    )}
                  >
                    {showComparison ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showComparison
                      ? (locale === "el" ? "Απόκρυψη" : "Hide")
                      : (locale === "el" ? "Σύγκριση" : "Compare")}
                  </button>
                )}
                {!showSaveInput ? (
                  <button
                    onClick={() => setShowSaveInput(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    {t("save_portfolio")}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={saveLabel}
                      onChange={(e) => setSaveLabel(e.target.value)}
                      placeholder={t("save_label_placeholder")}
                      className="w-40 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSavePortfolio();
                        if (e.key === "Escape") { setShowSaveInput(false); setSaveLabel(""); }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleSavePortfolio}
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                    >
                      {t("save")}
                    </button>
                    <button
                      onClick={() => { setShowSaveInput(false); setSaveLabel(""); }}
                      className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            {savedPortfolios.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("no_saved_portfolios")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {showComparison && <th className="pb-2 pr-3">{locale === "el" ? "Σύγκριση" : "Compare"}</th>}
                      <th className="pb-2 pr-3">{t("save_label")}</th>
                      <th className="pb-2 pr-3">{t("risk_tolerance")}</th>
                      <th className="pb-2 pr-3">{t("expected_return")}</th>
                      <th className="pb-2 pr-3">{t("risk")}</th>
                      <th className="pb-2 pr-3">{t("sharpe")}</th>
                      <th className="pb-2 pr-3">{t("diversification")}</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {savedPortfolios.map((p) => {
                      const isActive = p.id === activePortfolioId;
                      const isComparing = comparisonIds.has(p.id);
                      const compColor = isComparing
                        ? COMPARISON_COLORS[[...comparisonIds].indexOf(p.id) % COMPARISON_COLORS.length]
                        : undefined;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleSelectPortfolio(p)}
                          className={cn(
                            "cursor-pointer border-b transition-colors",
                            isActive
                              ? "border-primary/30 bg-primary/10"
                              : "border-border/50 hover:bg-muted/50",
                            isComparing && !isActive && "bg-primary/5"
                          )}
                        >
                          {showComparison && (
                            <td className="py-2 pr-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleComparison(p.id); }}
                                className={cn(
                                  "h-5 w-5 rounded border-2 transition-colors",
                                  isComparing
                                    ? "border-transparent"
                                    : "border-border hover:border-primary"
                                )}
                                style={isComparing ? { backgroundColor: compColor } : undefined}
                              />
                            </td>
                          )}
                          <td className="py-2 pr-3 font-medium">
                            <div className="flex items-center gap-2">
                              {isComparing && compColor && (
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: compColor }}
                                />
                              )}
                              <span>{p.label}</span>
                              {p.isOptimized && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-success">
                                  <BarChart3 className="h-2.5 w-2.5" />
                                  {locale === "el" ? "Βάση" : "Baseline"}
                                </span>
                              )}
                              {isActive && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                                  <Check className="h-2.5 w-2.5" />
                                  {locale === "el" ? "Ενεργό" : "Active"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-3">{(p.riskTolerance * 100).toFixed(0)}%</td>
                          <td className="py-2 pr-3 text-primary">{(p.expectedReturn * 100).toFixed(1)}%</td>
                          <td className="py-2 pr-3 text-accent">{(p.risk * 100).toFixed(1)}%</td>
                          <td className="py-2 pr-3 text-success">{p.sharpeRatio.toFixed(2)}</td>
                          <td className="py-2 pr-3 text-secondary">{(p.diversificationScore * 100).toFixed(0)}%</td>
                          <td className="py-2 text-right">
                            {!p.isOptimized && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteSaved(p.id); }}
                                className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                                title={locale === "el" ? "Διαγραφή" : "Delete"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {t("proceed_to_courses")}
            <ArrowRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
