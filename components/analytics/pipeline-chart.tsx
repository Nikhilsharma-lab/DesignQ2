"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const PHASE_COLORS: Record<string, string> = {
  predesign: "var(--phase-predesign)",
  design: "var(--phase-design)",
  dev: "var(--phase-dev)",
  track: "var(--phase-track)",
};

const chartConfig: ChartConfig = {
  predesign: { label: "Predesign", color: "var(--phase-predesign)" },
  design: { label: "Design", color: "var(--phase-design)" },
  dev: { label: "Dev", color: "var(--phase-dev)" },
  track: { label: "Track", color: "var(--phase-track)" },
};

interface PipelineChartProps {
  data: { phase: string; count: number }[];
}

export function PipelineChart({ data }: PipelineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-muted-foreground/60">
        No pipeline data yet
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="phase"
          width={72}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v: string) =>
            v.charAt(0).toUpperCase() + v.slice(1)
          }
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((entry) => (
            <Cell
              key={entry.phase}
              fill={PHASE_COLORS[entry.phase] ?? "var(--muted-foreground)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
