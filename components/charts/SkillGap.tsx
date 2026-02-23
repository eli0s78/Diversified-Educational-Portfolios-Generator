"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { TRAINING_DIRECTIONS, INDUSTRY_DEMAND } from "@/lib/engine/portfolio-types";

const SHORT_LABELS: Record<string, { en: string; el: string }> = {
  new_technologies: { en: "Technology", el: "Τεχνολογία" },
  trend_analysis: { en: "Trends", el: "Τάσεις" },
  sales_techniques: { en: "Sales", el: "Πωλήσεις" },
  negotiation_hr: { en: "HR/Negot.", el: "Διαπρ./HR" },
  personal_growth_theory: { en: "Theory", el: "Θεωρία" },
  personal_growth_practical: { en: "Practical", el: "Πρακτική" },
};

interface SkillGapProps {
  weights: number[];
  locale: string;
}

export default function SkillGap({ weights, locale }: SkillGapProps) {
  const data = TRAINING_DIRECTIONS.map((dir, i) => {
    const portfolio = (weights[i] || 0) * 100;
    const demand = (INDUSTRY_DEMAND[dir.key] || 0) * 100;
    const gap = portfolio - demand;
    return {
      name: SHORT_LABELS[dir.key]?.[locale as "en" | "el"] || SHORT_LABELS[dir.key]?.en || dir.name,
      portfolio,
      demand,
      gap,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          domain={[-30, 30]}
          tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={75}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            fontSize: "0.8rem",
          }}
          formatter={(value, name) => {
            const v = Number(value) || 0;
            if (name === "gap") {
              const label = locale === "el" ? "Κενό" : "Gap";
              return [`${v > 0 ? "+" : ""}${v.toFixed(1)}%`, label];
            }
            return [v, name];
          }}
          labelStyle={{ fontWeight: 600 }}
        />
        <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeWidth={1} />
        <Bar dataKey="gap" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.gap >= 0 ? "var(--success)" : "var(--destructive)"}
              fillOpacity={0.7}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
