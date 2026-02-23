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
  X,
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
  getActiveProviderSettings,
} from "@/lib/project-manager";
import { useProject } from "@/lib/project-context";
import { Badge } from "@/components/ui/Badge";
import {
  RefreshCw,
  Database,
  FolderOpen,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TopicInfo, Paper } from "@/lib/engine/portfolio-types";
import { ResearchWizard } from "@/components/research/ResearchWizard";
import type { AcademicPaper, TopicInfo as ResearchTopicInfo, SectorReport } from "@/lib/types/research";

const PIPELINE_STEPS = [
  { key: "parse", icon: Table2 },
  { key: "analyze", icon: Sparkles },
] as const;

type UploadTab = "upload" | "generate";

export default function UploadPage() {
  const t = useTranslations("upload");
  const locale = useLocale();
  const router = useRouter();
  const { currentProject, refreshCurrentProject, uploadFiles, setUploadFiles } = useProject();

  // File state (persisted in context across tab switches)
  const pdfFiles = uploadFiles.pdfFiles;
  const topicsFile = uploadFiles.topicsFile;
  const papersFile = uploadFiles.papersFile;
  const setPdfFiles = useCallback((updater: File[] | ((prev: File[]) => File[])) => {
    setUploadFiles((prev) => ({
      ...prev,
      pdfFiles: typeof updater === "function" ? updater(prev.pdfFiles) : updater,
    }));
  }, [setUploadFiles]);
  const setTopicsFile = useCallback((file: File | null) => {
    setUploadFiles((prev) => ({ ...prev, topicsFile: file }));
  }, [setUploadFiles]);
  const setPapersFile = useCallback((file: File | null) => {
    setUploadFiles((prev) => ({ ...prev, papersFile: file }));
  }, [setUploadFiles]);

  // Tab state
  const [activeTab, setActiveTab] = useState<UploadTab>("upload");

  // Pipeline state
  const [pipelineStep, setPipelineStep] = useState(-1); // -1 = not started
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Existing data from previous pipeline run
  interface ExistingData {
    reportNames: string[];
    topicsFileName: string | null;
    papersFileName: string | null;
    topicCount: number;
    paperCount: number;
  }
  const [existingData, setExistingData] = useState<ExistingData | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const topicsInputRef = useRef<HTMLInputElement>(null);
  const papersInputRef = useRef<HTMLInputElement>(null);

  // Load config and existing data on mount/project switch
  useEffect(() => {
    if (!currentProject) {
      return;
    }
    // Show existing data if available
    if (currentProject.sourceData) {
      setExistingData({
        reportNames: currentProject.sourceData.reports.map((r) => r.name),
        topicsFileName: currentProject.sourceData.topicsFileName || null,
        papersFileName: currentProject.sourceData.papersFileName || null,
        topicCount: currentProject.sourceData.topics.filter((t) => t.topicNumber !== -1).length,
        paperCount: currentProject.sourceData.papers.length,
      });
    } else {
      setExistingData(null);
    }

    setPipelineError(currentProject.pipelineError || null);
    setRunning(false);

    // If pipeline was already completed for analysis
    if (currentProject.pipelineStatus === "complete") {
      setPipelineStep(2);
    } else if (currentProject.pipelineStatus === "error") {
      setPipelineStep(currentProject.pipelineStep ?? -1);
    } else {
      setPipelineStep(-1);
    }
  }, [currentProject, router]);

  const canStart = topicsFile !== null || existingData !== null;

  const runPipeline = useCallback(async () => {
    const useExisting = !topicsFile && existingData !== null;
    if (!topicsFile && !useExisting) return;

    setRunning(true);
    setPipelineError(null);

    const project = getCurrentProject();
    if (!project) {
      setPipelineError("No active project");
      setRunning(false);
      return;
    }

    const active = getActiveProviderSettings();

    try {
      let topics: TopicInfo[];
      let papers: Paper[];
      let reportTexts: string[];

      if (useExisting && project.sourceData) {
        // Re-analyze: skip file parsing, use existing source data
        setPipelineStep(0);
        project.pipelineStatus = "analyzing";
        project.pipelineStep = 0;
        saveProject(project);

        topics = project.sourceData.topics;
        papers = project.sourceData.papers;
        reportTexts = project.sourceData.reports.map((r) => r.textContent);
      } else {
        // Step 0: Parse new files
        setPipelineStep(0);
        project.pipelineStatus = "analyzing";
        project.pipelineStep = 0;
        saveProject(project);

        // Parse Topics CSV
        const topicsText = await topicsFile!.text();
        topics = parseTopicsCSV(topicsText);

        if (topics.length === 0) {
          throw new Error("No topics found in CSV. Check the file format.");
        }

        // Parse Papers CSV (optional)
        papers = [];
        if (papersFile) {
          const papersText = await papersFile.text();
          papers = parsePapersCSV(papersText);
        }

        // Extract PDF texts
        reportTexts = [];
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
          topicsFileName: topicsFile!.name,
          papersFileName: papersFile?.name,
        };
        saveProject(project);
      }

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
          apiKey: active.apiKey || undefined,
          modelId: active.verifiedModel || undefined,
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

      project.pipelineStatus = "complete";
      project.pipelineStep = 2;
      project.pipelineError = null;
      saveProject(project);
      refreshCurrentProject();

      setPipelineStep(2);
      // Auto-redirect after analysis completion
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
  }, [topicsFile, papersFile, pdfFiles, existingData, locale, router]);

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

  const pipelineComplete = pipelineStep === 2;

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

  // Handle Research Wizard completion
  const handleResearchComplete = useCallback((data: {
    papers: AcademicPaper[];
    topics: ResearchTopicInfo[];
    report: SectorReport;
  }) => {
    if (!currentProject) return;

    // Convert research data to app format
    const convertedTopics: TopicInfo[] = data.topics.map(t => ({
      topicNumber: t.topicNumber,
      count: t.count,
      name: t.name,
      keywords: t.representation, // representation -> keywords
      representativeDocs: t.representativeDocs,
      rarityLabel: t.rarityLabel,
    }));

    const convertedPapers: Paper[] = data.papers.map(p => ({
      id: p.id,
      doi: p.doi || '',
      title: p.title,
      abstract: p.abstract,
      year: p.year,
      venue: p.venue || '',
      authors: p.authors.join(', '),
      url: p.url || '',
      source: p.source,
      fields: p.fields?.join(', '),
      topicNumber: p.topicNumber ?? -1,
      rarityLabel: p.rarityLabel ?? 'NO_TOPIC',
    }));

    // Update project with generated data
    const updated = {
      ...currentProject,
      sourceData: {
        reports: [{
          name: data.report.sector_definition.name,
          textContent: data.report.sector_definition.description,
        }],
        topics: convertedTopics,
        papers: convertedPapers,
        topicsFileName: 'generated-topics.csv',
        papersFileName: 'generated-papers.csv',
      },
    };

    saveProject(updated);
    refreshCurrentProject();

    // Switch to upload tab to show results
    setActiveTab("upload");
  }, [currentProject, refreshCurrentProject]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="mb-2 text-3xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("subtitle")}</p>

      {/* Tab Switcher */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        <button
          onClick={() => setActiveTab("upload")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "upload"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("tab_upload")}
        </button>
        <button
          onClick={() => setActiveTab("generate")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "generate"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("tab_generate")}
        </button>
      </div>

      {/* Upload Tab Content */}
      {activeTab === "upload" && (
      <div className="space-y-6">
        {/* Existing Data Summary */}
        {existingData && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">{t("existing_data")}</h3>
              {pipelineStep === 2 && (
                <Badge variant="success">{t("pipeline_complete_badge")}</Badge>
              )}
            </div>

            {/* Uploaded files list */}
            <div className="mb-4 space-y-2">
              {/* Topics CSV — always present */}
              {existingData.topicsFileName && (
                <div className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                  <Table2 className="h-4 w-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{existingData.topicsFileName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {existingData.topicCount} {t("topics_count").toLowerCase()}
                  </span>
                </div>
              )}
              {!existingData.topicsFileName && (
                <div className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                  <Table2 className="h-4 w-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 text-sm font-medium">{t("topics_label")}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {existingData.topicCount} {t("topics_count").toLowerCase()}
                  </span>
                </div>
              )}

              {/* Papers CSV — optional */}
              {existingData.paperCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                  <Table2 className="h-4 w-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {existingData.papersFileName || t("papers_label")}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {existingData.paperCount} {t("papers_count").toLowerCase()}
                  </span>
                </div>
              )}

              {/* PDF reports */}
              {existingData.reportNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">PDF</span>
                </div>
              ))}
            </div>

            <button
              onClick={runPipeline}
              disabled={running}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors",
                running
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
              {t("reanalyze")}
            </button>
          </div>
        )}

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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPdfFiles((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTopicsFile(null);
                  }}
                  className="ml-1 rounded-full p-0.5 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPapersFile(null);
                  }}
                  className="ml-1 rounded-full p-0.5 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
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

        {/* Generate / View Results Button */}
        <button
          onClick={pipelineComplete ? () => router.push("/analysis") : runPipeline}
          disabled={pipelineComplete ? false : (!canStart || running)}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-semibold transition-colors",
            pipelineComplete
              ? "bg-success text-white hover:bg-success/90"
              : canStart && !running
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
              {t("pipeline_analyze")}
            </>
          )}
        </button>
      </div>
      )}

      {/* Generate Tab Content */}
      {activeTab === "generate" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 text-lg font-semibold">{t("generate_tab_title")}</h2>
            <p className="mb-6 text-sm text-muted-foreground">{t("generate_tab_subtitle")}</p>
            <ResearchWizard onComplete={handleResearchComplete} />
          </div>
        </div>
      )}
    </div>
  );
}
