"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { TRAINING_DIRECTIONS, type CourseOutline, type SupervisorMatch } from "@/lib/engine/portfolio-types";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Tag,
  FileText,
  RefreshCw,
  Loader2,
  Target,
  UserCheck,
} from "lucide-react";
import { parseRichContent, type RichBlock } from "@/lib/rich-text";
import {
  getCurrentProject,
  saveProject,
  getSettings,
} from "@/lib/project-manager";
import { useProject } from "@/lib/project-context";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

function RichContent({ content }: { content: string }) {
  const blocks = parseRichContent(content);
  const result: React.ReactNode[] = [];
  let listBuffer: RichBlock[] = [];
  let keyIdx = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    result.push(
      <ol key={`ol-${keyIdx++}`} className="my-2 list-decimal space-y-1.5 pl-5">
        {listBuffer.map((item, i) => (
          <li key={i} className="pl-1">
            {item.segments.map((seg, j) =>
              seg.bold ? (
                <strong key={j}>{seg.text}</strong>
              ) : (
                <span key={j}>{seg.text}</span>
              )
            )}
          </li>
        ))}
      </ol>
    );
    listBuffer = [];
  };

  for (const block of blocks) {
    if (block.type === "list-item") {
      listBuffer.push(block);
    } else {
      flushList();
      result.push(
        <p key={`p-${keyIdx++}`}>
          {block.segments.map((seg, j) =>
            seg.bold ? (
              <strong key={j}>{seg.text}</strong>
            ) : (
              <span key={j}>{seg.text}</span>
            )
          )}
        </p>
      );
    }
  }
  flushList();

  return <>{result}</>;
}

export default function CoursesPage() {
  const t = useTranslations("courses");
  const locale = useLocale();
  const { refreshCurrentProject } = useProject();
  const [courses, setCourses] = useState<CourseOutline[]>([]);
  const [supervisors, setSupervisors] = useState<Record<string, SupervisorMatch[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const generateCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const project = getCurrentProject();
      const settings = getSettings();

      if (!project) {
        setError(t("no_project"));
        return;
      }

      const weights = project.portfolioResult?.selectedPortfolio.weights;
      if (!weights) {
        setError(t("no_weights"));
        return;
      }

      if (!project.sourceData || !project.analysis) {
        setError(t("no_project"));
        return;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weights,
          topics: project.sourceData.topics,
          papers: project.sourceData.papers,
          affinityMatrix: project.analysis.affinityMatrix,
          sectorName: project.analysis.sectorName,
          sectorDescription: project.analysis.sectorDescription,
          programTitle: project.analysis.programTitle,
          programInstructions: project.config.programInstructions || "",
          targetAudience: project.analysis.targetAudience,
          educationLevel: project.analysis.educationLevel || project.config.educationLevel,
          language: locale,
          aiProvider: settings.aiProvider || "claude",
          apiKey: settings.apiKey || undefined,
          modelId: settings.verifiedModel || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses);
        if (data.supervisors) {
          setSupervisors(data.supervisors);
        }
        // Save courses + supervisors to active project
        if (project) {
          project.courses = data.courses;
          project.courseSupervisors = data.supervisors || null;
          saveProject(project);
          refreshCurrentProject();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Generation failed (${res.status})`);
      }
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  // Load cached courses + supervisors from project on mount
  useEffect(() => {
    const project = getCurrentProject();
    if (project && project.courses.length > 0) {
      setCourses(project.courses);
      if (project.courseSupervisors) {
        setSupervisors(project.courseSupervisors);
      }
    }
  }, []);

  // Check if generation is possible (has portfolio weights)
  const [canGenerate, setCanGenerate] = useState(false);
  useEffect(() => {
    const project = getCurrentProject();
    setCanGenerate(!!project?.portfolioResult?.selectedPortfolio.weights);
  }, []);

  const toggleModule = (key: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleUnit = (key: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium text-muted-foreground">
          {t("generating")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <PageContainer size="md">
        <EmptyState
          icon={BookOpen}
          message={t("generation_error")}
          action={
            <div>
              <p className="mb-4 text-sm text-muted-foreground">{error}</p>
              <Button onClick={generateCourses} variant="primary">
                <RefreshCw className="h-4 w-4" />
                {t("regenerate")}
              </Button>
            </div>
          }
        />
      </PageContainer>
    );
  }

  if (courses.length === 0) {
    return (
      <PageContainer size="md">
        <EmptyState
          icon={BookOpen}
          message={canGenerate ? t("no_courses") : t("no_weights")}
          action={
            canGenerate ? (
              <Button onClick={generateCourses} variant="primary" size="lg">
                <BookOpen className="h-4 w-4" />
                {t("generate_btn")}
              </Button>
            ) : undefined
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button onClick={generateCourses} variant="secondary" size="md">
            <RefreshCw className="h-4 w-4" />
            {t("regenerate")}
          </Button>
        }
      />

      <div className="space-y-6">
        {courses.map((course, courseIdx) => {
          const direction = TRAINING_DIRECTIONS.find(
            (d) => d.key === course.trainingDirection
          );
          return (
            <div
              key={courseIdx}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Course Header */}
              <div className="border-b border-border bg-muted/50 p-6">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {direction
                      ? locale === "el"
                        ? direction.name_el
                        : direction.name
                      : course.trainingDirection}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {course.totalHours} {t("hours")}
                  </span>
                </div>
                <h2 className="text-xl font-bold">{course.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {course.overview}
                </p>

                {/* Assigned Supervisors */}
                {supervisors[course.trainingDirection]?.length > 0 && (
                  <div className="mt-4 rounded-lg border border-border/50 bg-card p-3">
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <UserCheck className="h-3.5 w-3.5" />
                      {t("supervisors")}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {supervisors[course.trainingDirection].map((sup) => (
                        <div
                          key={sup.id}
                          className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5"
                          title={[sup.field, ...sup.specialties].join(", ")}
                        >
                          <span className="text-sm font-medium">{sup.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {sup.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modules */}
              <div className="divide-y divide-border">
                {course.modules.map((mod) => {
                  const modKey = `${courseIdx}-${mod.moduleNumber}`;
                  const isExpanded = expandedModules.has(modKey);
                  return (
                    <div key={modKey}>
                      <button
                        onClick={() => toggleModule(modKey)}
                        className="flex w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/30"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="shrink-0 text-sm font-bold text-primary">
                          {t("module")} {mod.moduleNumber}
                        </span>
                        <span className="font-medium">{mod.title}</span>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/50 bg-muted/20 px-6 py-4">
                          <p className="mb-3 text-sm text-muted-foreground">
                            {mod.description}
                          </p>

                          {mod.learningObjectives.length > 0 && (
                            <div className="mb-4">
                              <h4 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <Target className="h-3 w-3" />
                                {t("objectives")}
                              </h4>
                              <ul className="list-inside list-disc space-y-0.5 text-sm">
                                {mod.learningObjectives.map((obj, i) => (
                                  <li key={i}>{obj}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Units */}
                          <div className="space-y-2">
                            {mod.units.map((unit) => {
                              const unitKey = `${modKey}-${unit.unitNumber}`;
                              const isUnitExpanded = expandedUnits.has(unitKey);
                              return (
                                <div
                                  key={unitKey}
                                  className="rounded-lg border border-border bg-card"
                                >
                                  <button
                                    onClick={() => toggleUnit(unitKey)}
                                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
                                  >
                                    {isUnitExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    )}
                                    <span className="shrink-0 text-xs font-bold text-secondary">
                                      {t("unit")} {unit.unitNumber}
                                    </span>
                                    <span className="font-medium">
                                      {unit.title}
                                    </span>
                                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {unit.estimatedMinutes} {t("minutes")}
                                    </span>
                                  </button>

                                  {isUnitExpanded && (
                                    <div className="border-t border-border/50 px-4 py-4">
                                      <div className="prose prose-sm max-w-none text-sm leading-relaxed text-card-foreground">
                                        <RichContent content={unit.content} />
                                      </div>

                                      {unit.skillTags.length > 0 && (
                                        <div className="mt-4">
                                          <h5 className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                            <Tag className="h-3 w-3" />
                                            {t("skills")}
                                          </h5>
                                          <div className="flex flex-wrap gap-1">
                                            {unit.skillTags.map((tag, i) => (
                                              <span
                                                key={i}
                                                className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
                                              >
                                                {tag}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {unit.paperReferences.length > 0 && (
                                        <div className="mt-3">
                                          <h5 className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                            <FileText className="h-3 w-3" />
                                            {t("references")}
                                          </h5>
                                          <ul className="space-y-0.5 text-xs text-muted-foreground">
                                            {unit.paperReferences.map(
                                              (ref, i) => (
                                                <li key={i}>{ref}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
