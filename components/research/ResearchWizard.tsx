"use client";

import { useState } from "react";
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
    markStepComplete("occupation-input");

    try {
      // Step 1: Collect Literature
      setCurrentStep("literature-collection");
      console.log("[Research Wizard] Collecting literature...");

      const litResponse = await fetch("/api/collect-literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupation,
          keywords: [occupation.split(" ")[0]], // Simple keyword extraction
          year_from: 2020,
          year_to: new Date().getFullYear(),
          max_papers: 200,
          sources: ["semantic-scholar", "openalex"],
        }),
      });

      if (!litResponse.ok) {
        throw new Error(`Literature collection failed: ${litResponse.statusText}`);
      }

      const litData = await litResponse.json();
      setPapers(litData.papers);
      markStepComplete("literature-collection");

      // Step 2: Topic Modeling (requires BERTopic service)
      setCurrentStep("topic-modeling");
      console.log(`[Research Wizard] Topic modeling ${litData.papers.length} papers...`);

      // Check if BERTopic service URL is configured (read from localStorage client-side)
      const settingsRaw = localStorage.getItem("dep-settings");
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
      const bertopicUrl = settings.bertopic_service_url;

      if (!bertopicUrl) {
        throw new Error("BERTopic service URL not configured. Please set it in Settings.");
      }

      const topicResponse = await fetch(`${bertopicUrl}/api/topic-modeling`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          papers: litData.papers.map((p: AcademicPaper) => ({
            id: p.id,
            title: p.title,
            abstract: p.abstract,
          })),
          min_topic_size: 8,
        }),
      });

      if (!topicResponse.ok) {
        throw new Error(`Topic modeling failed: ${topicResponse.statusText}`);
      }

      const topicData = await topicResponse.json();
      setTopics(topicData.topics);
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
      console.log("[Research Wizard] Collecting labor market data...");

      const laborResponse = await fetch("/api/labor-market-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupation, region }),
      });

      if (!laborResponse.ok) {
        throw new Error(`Labor market data collection failed: ${laborResponse.statusText}`);
      }

      const laborDataResult = await laborResponse.json();
      setLaborData(laborDataResult);
      markStepComplete("labor-market-data");

      // Step 4: Sector Trends (parallel with labor market, not blocking)
      const trendsResponse = await fetch("/api/sector-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupation }),
      });

      const trendsDataResult = trendsResponse.ok ? await trendsResponse.json() : null;
      setTrendsData(trendsDataResult);

      // Step 5: Generate Report
      setCurrentStep("report-generation");
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
      markStepComplete("report-generation");

      // Complete!
      setCurrentStep("complete");
      onComplete({
        papers: papersWithTopics,
        topics: topicData.topics,
        report: reportData.report,
      });
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

      {/* Progress Display */}
      {loading && currentStep !== "occupation-input" && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">
                  {currentStep === "literature-collection" && "Collecting academic papers..."}
                  {currentStep === "topic-modeling" && "Running topic modeling..."}
                  {currentStep === "labor-market-data" && "Fetching labor market data..."}
                  {currentStep === "report-generation" && "Generating sector report..."}
                </p>
                <p className="text-xs text-muted-foreground">This may take a few minutes</p>
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

      {/* Results Summary */}
      {currentStep === "complete" && report && (
        <Card className="border-success">
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="text-sm font-semibold text-success">Research Complete!</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Papers</p>
                <p className="text-2xl font-bold">{papers.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Topics</p>
                <p className="text-2xl font-bold">{topics.filter((t) => t.topicNumber >= 0).length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Technologies</p>
                <p className="text-2xl font-bold">{report.technologies.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
