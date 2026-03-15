import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tables } from "@/integrations/supabase/types";

type PlanTask = Tables<"plan_tasks">;
type PlanBlock = Tables<"plan_blocks">;

interface PillarCompletionChartProps {
  tasks: PlanTask[];
  blocks: PlanBlock[];
  pillars: { id: string; name: string }[];
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const PillarCompletionChart = ({
  tasks,
  blocks,
  pillars,
}: PillarCompletionChartProps) => {
  const { data, config } = useMemo(() => {
    // Map block ID → pillar ID
    const blockPillarMap = new Map<string, string>();
    for (const b of blocks) {
      blockPillarMap.set(b.id, b.pillar_id);
    }

    // Count completed and total tasks per pillar
    const pillarCompleted = new Map<string, number>();
    const pillarTotal = new Map<string, number>();
    for (const t of tasks) {
      const pillarId = blockPillarMap.get(t.plan_block_id);
      if (!pillarId) continue;
      pillarTotal.set(pillarId, (pillarTotal.get(pillarId) || 0) + 1);
      if (t.is_completed) {
        pillarCompleted.set(pillarId, (pillarCompleted.get(pillarId) || 0) + 1);
      }
    }

    const chartData = pillars.map((p, i) => ({
      pillar: p.name,
      completed: pillarCompleted.get(p.id) || 0,
      total: pillarTotal.get(p.id) || 0,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));

    const chartConfig: ChartConfig = {};
    pillars.forEach((p, i) => {
      chartConfig[p.name] = {
        label: p.name,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });

    return { data: chartData, config: chartConfig };
  }, [tasks, blocks, pillars]);

  if (data.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-serif text-lg font-semibold">Completion by Pillar</h2>
      <ChartContainer config={config} className="aspect-[2/1] w-full">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="pillar"
            tickLine={false}
            axisLine={false}
            width={80}
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => (
                  <span>
                    {value} / {item.payload.total} tasks
                  </span>
                )}
              />
            }
            cursor={{ fill: "hsl(var(--muted))" }}
          />
          <Bar dataKey="completed" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </section>
  );
};
