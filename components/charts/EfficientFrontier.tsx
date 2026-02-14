"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface FrontierPoint {
  risk: number;
  return_: number;
  weights: number[];
  sharpeRatio: number;
}

interface EfficientFrontierProps {
  frontier: FrontierPoint[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  optimumIdx: number;
}

export default function EfficientFrontier({
  frontier,
  selectedIdx,
  onSelect,
  optimumIdx,
}: EfficientFrontierProps) {
  const data = frontier.map((p, i) => ({
    x: p.risk * 100,
    y: p.return_ * 100,
    idx: i,
    sharpe: p.sharpeRatio ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          type="number"
          name="Risk"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          label={{
            value: "Risk (%)",
            position: "bottom",
            offset: 0,
            style: { fontSize: 12, fill: "var(--muted-foreground)" },
          }}
        />
        <YAxis
          dataKey="y"
          type="number"
          name="Return"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          label={{
            value: "Return (%)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12, fill: "var(--muted-foreground)" },
          }}
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="rounded-lg border border-border bg-card p-2.5 text-xs shadow-md">
                <div>Risk: {d.x.toFixed(2)}%</div>
                <div>Return: {d.y.toFixed(2)}%</div>
                <div>Sharpe: {(d.sharpe ?? 0).toFixed(2)}</div>
              </div>
            );
          }}
        />
        <Scatter
          data={data}
          cursor="pointer"
          onClick={(entry) => {
            if (entry && typeof entry.idx === "number") {
              onSelect(entry.idx);
            }
          }}
        >
          {data.map((entry) => (
            <Cell
              key={entry.idx}
              fill={
                entry.idx === selectedIdx
                  ? "var(--accent)"
                  : entry.idx === optimumIdx
                    ? "var(--success)"
                    : "var(--primary)"
              }
              r={
                entry.idx === selectedIdx || entry.idx === optimumIdx ? 6 : 4
              }
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
