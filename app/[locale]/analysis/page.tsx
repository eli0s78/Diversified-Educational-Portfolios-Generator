"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useState, useEffect } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { TopicInfo } from "@/lib/engine/portfolio-types";
import { TRAINING_DIRECTIONS, DIRECTION_COLORS } from "@/lib/engine/portfolio-types";
import { getTopicStats } from "@/lib/engine/data-loader";
import {
  BarChart3,
  Tag,
  FileText,
  Building2,
  GraduationCap,
  Users,
  Grid3X3,
} from "lucide-react";
import { getCurrentProject } from "@/lib/project-manager";
import { useProject } from "@/lib/project-context";

export default function AnalysisPage() {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const router = useRouter();
  const { currentProject: ctxProject } = useProject();

  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [affinityMatrix, setAffinityMatrix] = useState<Record<number, number[]>>({});
  const [sectorName, setSectorName] = useState("");
  const [sectorDescription, setSectorDescription] = useState("");
  const [programTitle, setProgramTitle] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<TopicInfo | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof getTopicStats> | null>(null);

  useEffect(() => {
    const project = ctxProject ?? getCurrentProject();
    if (!project?.sourceData || !project?.analysis) {
      router.push("/upload");
      return;
    }
    setTopics(project.sourceData.topics);
    setAffinityMatrix(project.analysis.affinityMatrix);
    setSectorName(project.analysis.sectorName);
    setSectorDescription(project.analysis.sectorDescription);
    setProgramTitle(project.analysis.programTitle);
    setProgramDescription(project.analysis.programDescription);
    setTargetAudience(project.analysis.targetAudience);
    setStats(getTopicStats(project.sourceData.topics));
  }, [router]);

  const activeTopics = topics.filter((t) => t.topicNumber !== -1);
  const maxCount = activeTopics.length > 0
    ? Math.max(...activeTopics.map((t) => t.count))
    : 1;

  if (!stats) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("subtitle")}</p>

      {/* AI-Generated Metadata */}
      <div className="mb-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{sectorName}</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
          {sectorDescription}
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
              {t("program")}
            </div>
            <p className="text-sm font-medium">{programTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{programDescription}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {t("audience")}
            </div>
            <p className="text-sm">{targetAudience}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xl font-bold text-primary">{stats.totalTopics}</div>
                <div className="text-xs text-muted-foreground">{t("topics")}</div>
              </div>
              <div>
                <div className="text-xl font-bold text-primary">{stats.totalPapers}</div>
                <div className="text-xs text-muted-foreground">{t("papers")}</div>
              </div>
              <div>
                <div className="text-xl font-bold text-success">{stats.commonCount}</div>
                <div className="text-xs text-muted-foreground">{t("common")}</div>
              </div>
              <div>
                <div className="text-xl font-bold text-accent">{stats.rareCount}</div>
                <div className="text-xs text-muted-foreground">{t("rare")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Topic Distribution */}
        <div className="lg:col-span-3">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t("topic_distribution")}
          </h2>
          <div className="space-y-2">
            {activeTopics
              .sort((a, b) => b.count - a.count)
              .map((topic) => (
                <button
                  key={topic.topicNumber}
                  onClick={() => setSelectedTopic(topic)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                    selectedTopic?.topicNumber === topic.topicNumber
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <span className="w-6 shrink-0 text-xs font-bold text-muted-foreground">
                    T{topic.topicNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 truncate font-medium">{topic.name}</div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          topic.rarityLabel === "COMMON" ? "bg-primary" : "bg-accent"
                        )}
                        style={{ width: `${(topic.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        topic.rarityLabel === "COMMON"
                          ? "bg-primary/10 text-primary"
                          : "bg-accent/10 text-accent"
                      )}
                    >
                      {topic.rarityLabel === "COMMON" ? t("common") : t("rare")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {topic.count}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Topic Detail */}
          {selectedTopic ? (
            <div className="sticky top-20 space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-1 text-lg font-semibold">
                  Topic {selectedTopic.topicNumber}
                </h3>
                <p className="mb-4 font-medium text-primary">{selectedTopic.name}</p>

                <div className="mb-4">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Tag className="h-4 w-4" />
                    {t("keywords")}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTopic.keywords.slice(0, 10).map((kw, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-muted px-2 py-1 text-xs"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <FileText className="h-4 w-4" />
                    {t("papers")} ({selectedTopic.count})
                  </h4>
                  <div className="space-y-2">
                    {selectedTopic.representativeDocs.slice(0, 5).map((doc, i) => (
                      <p key={i} className="text-xs text-muted-foreground line-clamp-2">
                        {doc}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Affinity for selected topic */}
              {affinityMatrix[selectedTopic.topicNumber] && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Grid3X3 className="h-4 w-4" />
                    {t("affinity_scores")}
                  </h4>
                  <div className="space-y-2">
                    {TRAINING_DIRECTIONS.map((dir, i) => {
                      const score = affinityMatrix[selectedTopic.topicNumber]?.[i] ?? 0;
                      return (
                        <div key={dir.key} className="flex items-center gap-2">
                          <span className="w-40 truncate text-xs">
                            {locale === "el" ? dir.name_el : dir.name}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${score * 100}%`,
                                backgroundColor: DIRECTION_COLORS[i],
                              }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs font-medium">
                            {(score * 100).toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {t("select_topic")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
