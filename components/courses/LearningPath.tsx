"use client";

import { useState } from "react";
import { TRAINING_DIRECTIONS } from "@/lib/engine/portfolio-types";
import type { CourseOutline } from "@/lib/engine/portfolio-types";
import {
  Route,
  ChevronDown,
  ChevronRight,
  Clock,
  ArrowDown,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Prerequisite graph: which directions should come before others.
 * Based on pedagogical sequencing: foundational → strategic → applied → integrative.
 */
const PREREQUISITE_MAP: Record<string, string[]> = {
  new_technologies: [],
  trend_analysis: ["new_technologies"],
  sales_techniques: ["trend_analysis"],
  negotiation_hr: ["sales_techniques"],
  personal_growth_theory: ["new_technologies", "trend_analysis"],
  personal_growth_practical: ["personal_growth_theory", "negotiation_hr"],
};

/** Phase groupings for visual display */
const PHASES = [
  { id: "foundation", keys: ["new_technologies"] },
  { id: "core", keys: ["trend_analysis", "sales_techniques"] },
  { id: "advanced", keys: ["negotiation_hr", "personal_growth_theory"] },
  { id: "integrative", keys: ["personal_growth_practical"] },
] as const;

interface LearningPathProps {
  courses: CourseOutline[];
  locale: string;
  weights: number[];
}

interface SequencedCourse {
  course: CourseOutline;
  directionIndex: number;
  phase: number;
  cumulativeHours: number;
}

function sequenceCourses(courses: CourseOutline[], weights: number[]): SequencedCourse[] {
  // Build a map of direction key → course
  const courseMap = new Map<string, CourseOutline>();
  for (const course of courses) {
    courseMap.set(course.trainingDirection, course);
  }

  // Topological sort respecting prerequisites + weight priority within same phase
  const result: SequencedCourse[] = [];
  const visited = new Set<string>();

  const visit = (key: string) => {
    if (visited.has(key)) return;
    const prereqs = PREREQUISITE_MAP[key] || [];
    for (const p of prereqs) {
      if (courseMap.has(p)) visit(p);
    }
    visited.add(key);
    const course = courseMap.get(key);
    if (course) {
      const dirIdx = TRAINING_DIRECTIONS.findIndex((d) => d.key === key);
      const phaseIdx = PHASES.findIndex((p) => (p.keys as readonly string[]).includes(key));
      result.push({
        course,
        directionIndex: dirIdx,
        phase: phaseIdx >= 0 ? phaseIdx : 0,
        cumulativeHours: 0,
      });
    }
  };

  // Process phases in order; within each phase, sort by weight (descending)
  for (const phase of PHASES) {
    const phaseKeys = phase.keys
      .filter((k) => courseMap.has(k))
      .sort((a, b) => {
        const idxA = TRAINING_DIRECTIONS.findIndex((d) => d.key === a);
        const idxB = TRAINING_DIRECTIONS.findIndex((d) => d.key === b);
        return (weights[idxB] || 0) - (weights[idxA] || 0);
      });
    for (const k of phaseKeys) {
      visit(k);
    }
  }

  // Calculate cumulative hours
  let cumHours = 0;
  for (const entry of result) {
    cumHours += entry.course.totalHours;
    entry.cumulativeHours = cumHours;
  }

  return result;
}

const PHASE_LABELS: Record<string, { en: string; el: string }> = {
  foundation: { en: "Foundation", el: "Θεμέλια" },
  core: { en: "Core", el: "Πυρήνας" },
  advanced: { en: "Advanced", el: "Προχωρημένα" },
  integrative: { en: "Integrative", el: "Ολοκλήρωση" },
};

const PHASE_COLORS = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
];

export default function LearningPath({ courses, locale, weights }: LearningPathProps) {
  const [expanded, setExpanded] = useState(true);
  const sequenced = sequenceCourses(courses, weights);

  if (sequenced.length === 0) return null;

  const totalHours = sequenced[sequenced.length - 1]?.cumulativeHours || 0;
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      learning_path: { en: "Recommended Learning Path", el: "Προτεινόμενη Διαδρομή Μάθησης" },
      learning_path_desc: {
        en: "AI-recommended course sequence based on prerequisite dependencies and portfolio weights",
        el: "Προτεινόμενη σειρά μαθημάτων βάσει προαπαιτούμενων και βαρών χαρτοφυλακίου",
      },
      total_time: { en: "Total estimated time", el: "Συνολικός εκτιμώμενος χρόνος" },
      hours: { en: "hours", el: "ώρες" },
      step: { en: "Step", el: "Βήμα" },
      cumulative: { en: "Cumulative", el: "Αθροιστικά" },
    };
    return translations[key]?.[locale] || translations[key]?.en || key;
  };

  let prevPhase = -1;

  return (
    <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-6 text-left transition-colors hover:bg-muted/30"
      >
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-primary" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
        <Route className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{t("learning_path")}</h2>
          <p className="text-xs text-muted-foreground">{t("learning_path_desc")}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium">
          <Clock className="h-3.5 w-3.5" />
          {totalHours} {t("hours")}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-6 pb-6 pt-4">
          <div className="relative">
            {sequenced.map((entry, idx) => {
              const showPhaseLabel = entry.phase !== prevPhase;
              prevPhase = entry.phase;
              const phaseId = PHASES[entry.phase]?.id || "foundation";
              const isLast = idx === sequenced.length - 1;

              return (
                <div key={entry.course.trainingDirection}>
                  {/* Phase label */}
                  {showPhaseLabel && (
                    <div className="mb-3 mt-1">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider",
                          PHASE_COLORS[entry.phase] || PHASE_COLORS[0]
                        )}
                      >
                        {PHASE_LABELS[phaseId]?.[locale as "en" | "el"] || PHASE_LABELS[phaseId]?.en}
                      </span>
                    </div>
                  )}

                  {/* Course step */}
                  <div className="flex items-start gap-4">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-xs font-bold text-primary">
                        {idx + 1}
                      </div>
                      {!isLast && (
                        <div className="my-1 h-8 w-px bg-border" />
                      )}
                    </div>

                    {/* Course info */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.course.title}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {entry.course.totalHours}h
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {TRAINING_DIRECTIONS[entry.directionIndex]
                            ? locale === "el"
                              ? TRAINING_DIRECTIONS[entry.directionIndex].name_el
                              : TRAINING_DIRECTIONS[entry.directionIndex].name
                            : ""}
                        </span>
                        <span className="text-muted-foreground/60">
                          {t("cumulative")}: {entry.cumulativeHours}h
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
