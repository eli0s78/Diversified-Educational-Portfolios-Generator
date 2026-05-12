"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Search,
  FileText,
  TrendingUp,
  Building2,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ResearchWizardStep,
  OccupationTaxonomy,
  AcademicPaper,
  TopicInfo,
  LaborMarketData,
  SectorTrendsData,
  SectorReport,
} from "@/lib/types/research";
import { GeneratedDataReview } from "./GeneratedDataReview";

interface ResearchWizardProps {
  onComplete: (data: {
    papers: AcademicPaper[];
    topics: TopicInfo[];
    report: SectorReport;
  }) => void;
}

const STEPS: Array<{
  id: ResearchWizardStep;
  label: string;
  icon: typeof Search;
}> = [
    { id: "occupation-input", label: "Occupation", icon: Search },
    { id: "literature-collection", label: "Literature", icon: FileText },
    { id: "topic-modeling", label: "Topics", icon: TrendingUp },
    { id: "labor-market-data", label: "Labor Market", icon: Building2 },
    { id: "report-generation", label: "Report", icon: Sparkles },
  ];

export function ResearchWizard({ onComplete }: ResearchWizardProps) {
  const t = useTranslations("upload");

  const [currentStep, setCurrentStep] = useState<ResearchWizardStep>("occupation-input");
  const [occupation, setOccupation] = useState("");
  const [region, setRegion] = useState<"US" | "EU" | "Global">("Global");
  const [language, setLanguage] = useState<"en" | "el">("en");

  const [papers, setPapers] = useState<AcademicPaper[]>([]);
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [laborData, setLaborData] = useState<LaborMarketData | null>(null);
  const [trendsData, setTrendsData] = useState<SectorTrendsData | null>(null);
  const [report, setReport] = useState<SectorReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [completedSteps, setCompletedSteps] = useState<Set<ResearchWizardStep>>(new Set());

  // --- Live Log & Timer State ---
  const [activityLog, setActivityLog] = useState<{ id: string; message: string; type: "info" | "success" | "warning"; time: string }[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activityLog]);

  // Timer logic
  useEffect(() => {
    if (loading && currentStep !== "complete") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, currentStep]);

  const addLog = (message: string, type: "info" | "success" | "warning" = "info") => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setActivityLog((prev) => [...prev, { id: Math.random().toString(36).substring(7), message, type, time }]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const markStepComplete = (step: ResearchWizardStep) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  };

  const handleStart = async () => {
    if (!occupation.trim()) {
      setError("Please enter an occupation");
      return;
    }

    setError(null);
    setLoading(true);
    setActivityLog([]);
    setElapsedSeconds(0);
    markStepComplete("occupation-input");

    try {


      // Step 1: Collect Literature
      setCurrentStep("literature-collection");
      addLog(`Initializing research pipeline for: ${occupation}...`);
      addLog(`Searching academic databases (Semantic Scholar, OpenAlex, etc.)...`);
      console.log("[Research Wizard] Collecting literature...");

      // Check if settings are available (read from localStorage client-side)
      const settingsRaw = localStorage.getItem("dep-settings");
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};

      const litResponse = await fetch("/api/collect-literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupation,
          keywords: [], // Let the API handle keyword extraction to avoid duplicates
          year_from: 2015, // Broader year range for better coverage
          year_to: new Date().getFullYear(),
          max_papers: 200,
          fetch_full_text: true,
          full_text_limit: 10,
          sources: [
            "semantic-scholar", "openalex", "crossref", "europe-pmc",
            "biorxiv", "core", "google-books", "open-library", "doab",
            "openstax", "merlot", "oasis", "arxiv", "pubmed"
          ],
          semantic_scholar_api_key: settings.semantic_scholar_api_key,
          core_api_key: settings.core_api_key,
          google_books_api_key: settings.google_books_api_key,
          exa_api_key: settings.exa_api_key,
        }),
      });

      if (!litResponse.ok) {
        throw new Error(`Literature collection failed: ${litResponse.statusText}`);
      }

      const litData = await litResponse.json();
      setPapers(litData.papers);

      addLog(`Found ${litData.metadata.total_found} papers across ${litData.metadata.sources_used.join(', ')}`, "success");
      addLog(`Removed ${litData.metadata.duplicates_removed} duplicates. Final count: ${litData.papers.length}.`);

      // Log latest 5 paper titles
      const topPapers = litData.papers.slice(0, 5);
      topPapers.forEach((p: AcademicPaper) => {
        addLog(`📄 ${p.title.length > 60 ? p.title.substring(0, 60) + '...' : p.title}`);
      });
      if (litData.papers.length > 5) {
        addLog(`...and ${litData.papers.length - 5} more papers.`);
      }

      markStepComplete("literature-collection");

      // Validate paper count before proceeding
      if (!litData.papers || litData.papers.length === 0) {
        throw new Error(
          "No academic papers found for this occupation. This could mean:\n" +
          "1. The academic APIs are rate-limited (add a Semantic Scholar API key in Settings)\n" +
          "2. This occupation has limited published research (try broader terms like 'skilled trades' or 'vocational training')\n" +
          "3. Try a different occupation with more academic research (e.g., 'Software Developers', 'Registered Nurses')"
        );
      }

      // Step 2: Topic Modeling (embedded Python - no separate service needed!)
      setCurrentStep("topic-modeling");
      addLog(`Sending ${litData.papers.length} papers to Gemini 3.1 Pro for semantic clustering...`);
      console.log(`[Research Wizard] Topic modeling ${litData.papers.length} papers...`);

      // Calculate adaptive min_topic_size based on number of papers
      // Use 5% of papers, but at least 3 and at most 10
      const paperCount = litData.papers.length;
      const minTopicSize = Math.max(3, Math.min(10, Math.floor(paperCount * 0.05)));

      // Ensure we have enough papers for topic modeling
      if (paperCount < minTopicSize) {
        throw new Error(
          `Need at least ${minTopicSize} papers for topic modeling, but only found ${paperCount}. ` +
          "Please add a Semantic Scholar API key in Settings to collect more papers, " +
          "or try a different occupation with more published research."
        );
      }

      console.log(`[Research Wizard] Using min_topic_size=${minTopicSize} for ${paperCount} papers`);
      addLog(`Analyzing abstracts and discovering macro-themes using adaptive grouping (min_size=${minTopicSize})...`);

      const topicResponse = await fetch("/api/topic-modeling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          papers: litData.papers.map((p: AcademicPaper) => ({
            id: p.id,
            title: p.title,
            abstract: p.abstract,
          })),
          min_topic_size: minTopicSize,
        }),
      });

      if (!topicResponse.ok) {
        const errorData = await topicResponse.json().catch(() => ({}));
        const deepErr = errorData.details ? ` - ${errorData.details}` : "";
        const errorMsg = (errorData.error || topicResponse.statusText) + deepErr;
        throw new Error(`Topic modeling failed: ${errorMsg}`);
      }

      const topicData = await topicResponse.json();
      setTopics(topicData.topics);

      const realTopics = topicData.topics.filter((t: any) => t.topicNumber >= 0);
      const outliers = topicData.metadata.n_outliers;
      addLog(`Identified ${realTopics.length} core topics and isolated ${outliers} outliers.`, "success");
      realTopics.slice(0, 5).forEach((t: any) => {
        addLog(`🏷️ Topic ${t.topicNumber}: ${t.name} (${t.count} papers)`);
      });

      markStepComplete("topic-modeling");

      // Update papers with topic assignments
      const papersWithTopics = litData.papers.map((p: AcademicPaper) => {
        const enriched = topicData.papers_with_topics.find((pw: any) => pw.id === p.id);
        return enriched
          ? { ...p, topicNumber: enriched.topicNumber, rarityLabel: enriched.rarityLabel }
          : p;
      });
      setPapers(papersWithTopics);

      // Step 3: Labor Market Data
      setCurrentStep("labor-market-data");
      addLog(`Querying O*NET Web Services for occupation taxonomy...`);
      addLog(`Fetching BLS employment statistics and projections...`);
      addLog(`Querying OECD data for educational attainment...`);
      console.log("[Research Wizard] Collecting labor market data...");

      const laborResponse = await fetch("/api/labor-market-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupation,
          region,
          onet_api_key: settings.onet_api_key,
          bls_api_key: settings.bls_api_key,
        }),
      });

      if (!laborResponse.ok) {
        throw new Error(`Labor market data collection failed: ${laborResponse.statusText}`);
      }

      const laborDataResult = await laborResponse.json();
      setLaborData(laborDataResult);
      addLog(`Labor market data acquired successfully.`, "success");
      markStepComplete("labor-market-data");

      // Step 4: Sector Trends (parallel with labor market, not blocking)
      addLog(`Scanning recent news and structural trends...`);
      const trendsResponse = await fetch("/api/sector-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupation,
          onet_api_key: settings.onet_api_key,
          tavily_api_key: settings.tavily_api_key,
          firecrawl_api_key: settings.firecrawl_api_key,
          fred_api_key: settings.fred_api_key,
        }),
      });

      const trendsDataResult = trendsResponse.ok ? await trendsResponse.json() : null;
      setTrendsData(trendsDataResult);
      if (trendsDataResult) addLog(`Trend contextual data ingested.`);

      // Step 5: Generate Report
      setCurrentStep("report-generation");
      addLog(`Synthesizing collected data into a comprehensive sector report...`);
      addLog(`Generating sector definition and exogenous forces analysis...`);
      console.log("[Research Wizard] Generating sector report...");

      const reportResponse = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupation: laborDataResult.occupation,
          topics: topicData.topics,
          papers: papersWithTopics,
          labor_market_data: laborDataResult,
          sector_trends: trendsDataResult,
          language,
        }),
      });

      if (!reportResponse.ok) {
        throw new Error(`Report generation failed: ${reportResponse.statusText}`);
      }

      const reportData = await reportResponse.json();
      setReport(reportData.report);
      addLog(`Sector report generated successfully!`, "success");
      addLog(`Pipeline complete in ${formatTime(elapsedSeconds)}. Data awaits your review.`, "success");
      markStepComplete("report-generation");

      // Complete!
      setCurrentStep("complete");
      // Note: Data is now reviewed by the user via GeneratedDataReview component
      // instead of auto-firing onComplete.
    } catch (err) {
      console.error("[Research Wizard] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((step, index) => {
          const isActive = currentStep === step.id;
          const isComplete = completedSteps.has(step.id);
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 transition-all",
                  isActive && "border-primary bg-primary/10 shadow-sm",
                  isComplete && !isActive && "border-success bg-success/5",
                  !isActive && !isComplete && "border-border bg-muted/30"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    isActive && "bg-primary text-primary-foreground",
                    isComplete && !isActive && "bg-success text-success-foreground",
                    !isActive && !isComplete && "bg-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium transition-colors",
                    isActive && "text-primary",
                    isComplete && !isActive && "text-success",
                    !isActive && !isComplete && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-[2px] w-4 transition-colors",
                    isComplete ? "bg-success" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Input Form */}
      {currentStep === "occupation-input" && (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Occupation</label>
              <Input
                type="text"
                placeholder="e.g., Software Developers, Administrative Assistants"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                disabled={loading}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the occupation or job role you want to research
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as "US" | "EU" | "Global")}
                  disabled={loading}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="Global">Global</option>
                  <option value="US">United States</option>
                  <option value="EU">European Union</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as "en" | "el")}
                  disabled={loading}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="el">Ελληνικά</option>
                </select>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleStart}
              disabled={loading || !occupation.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Research Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress & Logs Display */}
      {loading && currentStep !== "occupation-input" && (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            {/* Header info */}
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    {currentStep === "literature-collection" && "Collecting academic papers..."}
                    {currentStep === "topic-modeling" && "Running topic modeling..."}
                    {currentStep === "labor-market-data" && "Fetching labor market data..."}
                    {currentStep === "report-generation" && "Generating sector report..."}
                    {currentStep === "complete" && "Finalizing..."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1 text-sm font-mono border">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatTime(elapsedSeconds)}</span>
              </div>
            </div>

            {/* Terminal-like log panel */}
            <div className="h-[280px] overflow-y-auto bg-slate-950 p-4 font-mono text-xs text-slate-300">
              <div className="space-y-2">
                {activityLog.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <span className="shrink-0 text-slate-500">[{log.time}]</span>
                    <span
                      className={cn(
                        log.type === "success" && "text-emerald-400 font-medium",
                        log.type === "warning" && "text-amber-400",
                        log.type === "info" && "text-slate-300"
                      )}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary / Human in the loop review */}
      {currentStep === "complete" && report && (
        <GeneratedDataReview
          papers={papers}
          topics={topics}
          report={report}
          elapsedTime={formatTime(elapsedSeconds)}
          onSendToUpload={() => {
            onComplete({
              papers,
              topics,
              report,
            });
          }}
        />
      )}
    </div>
  );
}
