"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TRAINING_DIRECTIONS, DIRECTION_COLORS } from "@/lib/engine/portfolio-types";

interface ComparisonEntry {
  label: string;
  weights: number[];
  color: string;
}

interface SkillRadarProps {
  weights: number[];
  locale: string;
  /** Optional additional weight sets for comparison overlay */
  comparisons?: ComparisonEntry[];
}

const SHORT_LABELS: Record<string, { en: string; el: string }> = {
  new_technologies: { en: "Technology", el: "Τεχνολογία" },
  trend_analysis: { en: "Trends", el: "Τάσεις" },
  sales_techniques: { en: "Sales", el: "Πωλήσεις" },
  negotiation_hr: { en: "HR/Negotiation", el: "Διαπρ./HR" },
  personal_growth_theory: { en: "Theory", el: "Θεωρία" },
  personal_growth_practical: { en: "Practical", el: "Πρακτική" },
};

const COMPARISON_COLORS = [
  "#f59e0b", // amber
  "#ef4444", // red
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#06b6d4", // cyan
];

export type { ComparisonEntry };

export default function SkillRadar({ weights, locale, comparisons }: SkillRadarProps) {
  const data = TRAINING_DIRECTIONS.map((dir, i) => {
    const entry: Record<string, string | number> = {
      subject:
        SHORT_LABELS[dir.key]?.[locale as "en" | "el"] ||
        SHORT_LABELS[dir.key]?.en ||
        dir.name,
      value: (weights[i] || 0) * 100,
      fullMark: 50,
    };
    // Add comparison data keys
    if (comparisons) {
      comparisons.forEach((comp, ci) => {
        entry[`comp_${ci}`] = (comp.weights[i] || 0) * 100;
      });
    }
    return entry;
  });

  const showLegend = comparisons && comparisons.length > 0;

  return (
    <ResponsiveContainer width="100%" height={showLegend ? 360 : 320}>
      <RadarChart data={data}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 50]}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickFormatter={(v) => `${v}%`}
        />
        {/* Comparison radars (rendered first so current is on top) */}
        {comparisons?.map((comp, ci) => (
          <Radar
            key={comp.label}
            name={comp.label}
            dataKey={`comp_${ci}`}
            stroke={comp.color}
            fill={comp.color}
            fillOpacity={0.08}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        ))}
        {/* Current portfolio radar */}
        <Radar
          name={locale === "el" ? "Τρέχον" : "Current"}
          dataKey="value"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11 }}
          />
        )}
      </RadarChart>
    </ResponsiveContainer>
  );
}
