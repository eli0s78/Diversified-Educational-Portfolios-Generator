"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  Table2,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  GraduationCap,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { parseTopicsCSV, parsePapersCSV } from "@/lib/engine/data-loader";
import { extractTextFromPDF } from "@/lib/pdf-extract";
import {
  getCurrentProject,
  saveProject,
  getSettings,
} from "@/lib/project-manager";
import { useProject } from "@/lib/project-context";
import type { TopicInfo, Paper } from "@/lib/engine/portfolio-types";

const PIPELINE_STEPS = [
  { key: "parse", icon: Table2 },
  { key: "analyze", icon: Sparkles },
  { key: "optimize", icon: BarChart3 },
  { key: "generate", icon: GraduationCap },
] as const;

export default function UploadPage() {
  const t = useTranslations("upload");
  const locale = useLocale();
  const router = useRouter();
  const { refreshCurrentProject } = useProject();

  // File state
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [topicsFile, setTopicsFile] = useState<File | null>(null);
  const [papersFile, setPapersFile] = useState<File | null>(null);

  // Pipeline state
  const [pipelineStep, setPipelineStep] = useState(-1); // -1 = not started
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Optional config
  const [configOpen, setConfigOpen] = useState(false);
  const [programInstructions, setProgramInstructions] = useState("");
  const [educationLevel, setEducationLevel] = useState<string>("bachelor");

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const topicsInputRef = useRef<HTMLInputElement>(null);
  const papersInputRef = useRef<HTMLInputElement>(null);

  // Load existing config on mount
  useEffect(() => {
    const project = getCurrentProject();
    if (!project) {
      router.push("/");
      return;
    }
    setProgramInstructions(project.config.programInstructions || "");
    setEducationLevel(project.config.educationLevel || "bachelor");

    // If pipeline was already completed, show status
    if (project.pipelineStatus === "complete") {
      setPipelineStep(4);
    }
  }, [router]);

  const canStart = topicsFile !== null;

  const runPipeline = useCallback(async () => {
    if (!topicsFile) return;

    setRunning(true);
    setPipelineError(null);

    const project = getCurrentProject();
    if (!project) {
      setPipelineError("No active project");
      setRunning(false);
      return;
    }

    const settings = getSettings();

    try {
      // Step 0: Parse files
      setPipelineStep(0);
      project.pipelineStatus = "analyzing";
      project.pipelineStep = 0;
      project.config.programInstructions = programInstructions;
      project.config.educationLevel = educationLevel as "high_school" | "bachelor" | "master" | "phd";
      saveProject(project);

      // Parse Topics CSV
      const topicsText = await topicsFile.text();
      const topics: TopicInfo[] = parseTopicsCSV(topicsText);

      if (topics.length === 0) {
        throw new Error("No topics found in CSV. Check the file format.");
      }

      // Parse Papers CSV (optional)
      let papers: Paper[] = [];
      if (papersFile) {
        const papersText = await papersFile.text();
        papers = parsePapersCSV(papersText);
      }

      // Extract PDF texts
      const reportTexts: string[] = [];
      for (const pdf of pdfFiles) {
        const text = await extractTextFromPDF(pdf);
        reportTexts.push(text);
      }

      // Save source data
      project.sourceData = {
        reports: pdfFiles.map((f, i) => ({
          name: f.name,
          textContent: reportTexts[i] || "",
        })),
        topics,
        papers,
      };
      saveProject(project);

      // Step 1: AI Analysis
      setPipelineStep(1);
      project.pipelineStep = 1;
      saveProject(project);

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics,
          reportTexts,
          language: locale,
          aiProvider: settings.aiProvider || "claude",
          apiKey: settings.apiKey || undefined,
          modelId: settings.verifiedModel || undefined,
        }),
      });

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => ({}));
        throw new Error(err.error || `Analysis failed (${analyzeRes.status})`);
      }

      const analysis = await analyzeRes.json();
      project.analysis = analysis;
      project.name = analysis.programTitle || analysis.sectorName || project.name;
      saveProject(project);

      // Step 2: Portfolio Optimization
      setPipelineStep(2);
      project.pipelineStatus = "optimizing";
      project.pipelineStep = 2;
      saveProject(project);

      const optimizeRes = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics,
          affinityMatrix: analysis.affinityMatrix,
          riskTolerance: 0.5,
        }),
      });

      if (!optimizeRes.ok) {
        const err = await optimizeRes.json().catch(() => ({}));
        throw new Error(err.error || `Optimization failed (${optimizeRes.status})`);
      }

      const optData = await optimizeRes.json();

      // Normalize frontier
      const frontier = (optData.frontier || []).map(
        (p: { risk: number; return: number; weights: number[]; sharpe_ratio: number }) => ({
          risk: p.risk,
          return_: p.return,
          weights: p.weights,
          sharpeRatio: p.sharpe_ratio,
        })
      );
      const sel = optData.selected_portfolio || optData.frontier?.[0] || {};
      const weights = sel.weights || [];
      const hhi = weights.reduce((sum: number, w: number) => sum + w * w, 0);

      project.portfolioResult = {
        frontier,
        selectedPortfolio: {
          weights,
          expectedReturn: sel.return ?? 0,
          risk: sel.risk ?? 0,
          sharpeRatio: sel.sharpe_ratio ?? 0,
          diversificationScore: 1 - hhi,
        },
        riskTolerance: 0.5,
      };
      saveProject(project);

      // Step 3: Course Generation
      setPipelineStep(3);
      project.pipelineStatus = "generating";
      project.pipelineStep = 3;
      saveProject(project);

      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weights,
          topics,
          papers,
          affinityMatrix: analysis.affinityMatrix,
          sectorName: analysis.sectorName,
          sectorDescription: analysis.sectorDescription,
          programTitle: analysis.programTitle,
          programInstructions: project.config.programInstructions || "",
          targetAudience: analysis.targetAudience,
          educationLevel: analysis.educationLevel || project.config.educationLevel,
          language: locale,
          aiProvider: settings.aiProvider || "claude",
          apiKey: settings.apiKey || undefined,
          modelId: settings.verifiedModel || undefined,
        }),
      });

      if (!generateRes.ok) {
        const err = await generateRes.json().catch(() => ({}));
        throw new Error(err.error || `Generation failed (${generateRes.status})`);
      }

      const genData = await generateRes.json();
      project.courses = genData.courses;
      project.pipelineStatus = "complete";
      project.pipelineStep = 4;
      project.pipelineError = null;
      saveProject(project);
      refreshCurrentProject();

      setPipelineStep(4);
      // Auto-redirect after completion
      setTimeout(() => {
        router.push("/analysis");
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed";
      setPipelineError(message);
      project.pipelineStatus = "error";
      project.pipelineError = message;
      saveProject(project);
      refreshCurrentProject();
      setRunning(false);
    }
  }, [topicsFile, papersFile, pdfFiles, programInstructions, educationLevel, locale, router]);

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    setPdfFiles((prev) => [...prev, ...files]);
  };

  const handleCsvDrop = (
    e: React.DragEvent,
    setter: (f: File) => void
  ) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find(
      (f) => f.name.endsWith(".csv")
    );
    if (file) setter(file);
  };

  const pipelineComplete = pipelineStep === 4;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="mb-2 text-3xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("subtitle")}</p>

      <div className="space-y-6">
        {/* PDF Reports Dropzone */}
        <div>
          <label className="mb-2 block text-sm font-semibold">
            {t("pdf_label")}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({t("optional")})
            </span>
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handlePdfDrop}
            onClick={() => pdfInputRef.current?.click()}
            className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("pdf_hint")}
            </p>
            {pdfFiles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pdfFiles.map((f, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                  >
                    <FileText className="h-3 w-3" />
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setPdfFiles((prev) => [...prev, ...files]);
            }}
          />
        </div>

        {/* Topics CSV Dropzone */}
        <div>
          <label className="mb-2 block text-sm font-semibold">
            {t("topics_label")}
            <span className="ml-2 text-xs font-normal text-destructive">
              ({t("required")})
            </span>
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleCsvDrop(e, setTopicsFile)}
            onClick={() => topicsInputRef.current?.click()}
            className={cn(
              "flex min-h-[80px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card p-6 transition-colors hover:bg-muted/30",
              topicsFile
                ? "border-success/50"
                : "border-border hover:border-primary/50"
            )}
          >
            <Table2 className="mb-2 h-7 w-7 text-muted-foreground" />
            {topicsFile ? (
              <span className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" />
                {topicsFile.name}
              </span>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("topics_hint")}
              </p>
            )}
          </div>
          <input
            ref={topicsInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setTopicsFile(file);
            }}
          />
        </div>

        {/* Papers CSV Dropzone */}
        <div>
          <label className="mb-2 block text-sm font-semibold">
            {t("papers_label")}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({t("optional")})
            </span>
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleCsvDrop(e, setPapersFile)}
            onClick={() => papersInputRef.current?.click()}
            className={cn(
              "flex min-h-[80px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card p-6 transition-colors hover:bg-muted/30",
              papersFile
                ? "border-success/50"
                : "border-border hover:border-primary/50"
            )}
          >
            <Table2 className="mb-2 h-7 w-7 text-muted-foreground" />
            {papersFile ? (
              <span className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" />
                {papersFile.name}
              </span>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("papers_hint")}
              </p>
            )}
          </div>
          <input
            ref={papersInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPapersFile(file);
            }}
          />
        </div>

        {/* Optional Configuration */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold transition-colors hover:bg-muted/30"
          >
            {t("config_title")}
            {configOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {configOpen && (
            <div className="border-t border-border px-5 py-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {t("instructions_label")}
                </label>
                <textarea
                  value={programInstructions}
                  onChange={(e) => setProgramInstructions(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
                  placeholder={t("instructions_placeholder")}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {t("education_label")}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["high_school", "bachelor", "master", "phd"] as const).map(
                    (level) => (
                      <button
                        key={level}
                        onClick={() => setEducationLevel(level)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                          educationLevel === level
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {t(`education_levels.${level}`)}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pipeline Progress */}
        {pipelineStep >= 0 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-sm font-semibold">{t("pipeline_title")}</h3>
            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = pipelineStep === i;
                const isDone = pipelineStep > i;
                const isFailed = pipelineError && pipelineStep === i;

                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
                      isActive && !isFailed && "bg-primary/5",
                      isDone && "text-success",
                      isFailed && "bg-destructive/5 text-destructive"
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                    ) : isActive && !isFailed ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                    ) : isFailed ? (
                      <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                    ) : (
                      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <span className={cn("font-medium", !isDone && !isActive && "text-muted-foreground")}>
                      {t(`pipeline_${step.key}`)}
                    </span>
                  </div>
                );
              })}
            </div>

            {pipelineComplete && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm font-medium text-success">
                <CheckCircle2 className="h-5 w-5" />
                {t("pipeline_complete")}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {pipelineError && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">{t("pipeline_error")}</p>
              <p className="mt-1 text-xs text-destructive/80">{pipelineError}</p>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={runPipeline}
          disabled={!canStart || running}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-semibold transition-colors",
            canStart && !running
              ? "bg-primary text-white hover:bg-primary-hover"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {running ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("generating")}
            </>
          ) : pipelineComplete ? (
            <>
              {t("view_results")}
              <ArrowRight className="h-5 w-5" />
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              {t("generate_btn")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
