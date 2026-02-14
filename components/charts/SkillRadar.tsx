"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { TRAINING_DIRECTIONS } from "@/lib/engine/portfolio-types";

interface SkillRadarProps {
  weights: number[];
  locale: string;
}

const SHORT_LABELS: Record<string, { en: string; el: string }> = {
  new_technologies: { en: "Technology", el: "Τεχνολογία" },
  trend_analysis: { en: "Trends", el: "Τάσεις" },
  sales_techniques: { en: "Sales", el: "Πωλήσεις" },
  negotiation_hr: { en: "HR/Negotiation", el: "Διαπρ./HR" },
  personal_growth_theory: { en: "Theory", el: "Θεωρία" },
  personal_growth_practical: { en: "Practical", el: "Πρακτική" },
};

export default function SkillRadar({ weights, locale }: SkillRadarProps) {
  const data = TRAINING_DIRECTIONS.map((dir, i) => ({
    subject:
      SHORT_LABELS[dir.key]?.[locale as "en" | "el"] ||
      SHORT_LABELS[dir.key]?.en ||
      dir.name,
    value: (weights[i] || 0) * 100,
    fullMark: 50,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
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
        <Radar
          dataKey="value"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
