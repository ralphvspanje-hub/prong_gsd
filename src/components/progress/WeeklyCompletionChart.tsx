import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tables } from "@/integrations/supabase/types";

type PlanTask = Tables<"plan_tasks">;
type PlanBlock = Tables<"plan_blocks">;

interface WeeklyCompletionChartProps {
  tasks: PlanTask[];
  blocks: PlanBlock[];
  planFormat?: string;
}

const chartConfig: ChartConfig = {
  completed: {
    label: "Tasks completed",
    color: "hsl(var(--chart-2))",
  },
};

export const WeeklyCompletionChart = ({
  tasks,
  blocks,
  planFormat,
}: WeeklyCompletionChartProps) => {
  const isSprint = planFormat === "sprint";
  const unitPrefix = isSprint ? "S" : "W";
  const progressLabel = isSprint ? "Sprint Progress" : "Weekly Progress";

  const data = useMemo(() => {
    // Map block ID → week number
    const blockWeekMap = new Map<string, number>();
    for (const b of blocks) {
      blockWeekMap.set(b.id, b.week_number);
    }

    // Count completed tasks per week
    const weekCounts = new Map<number, number>();
    for (const t of tasks) {
      if (!t.is_completed) continue;
      const week = blockWeekMap.get(t.plan_block_id);
      if (week !== undefined) {
        weekCounts.set(week, (weekCounts.get(week) || 0) + 1);
      }
    }

    // Also count total tasks per week
    const weekTotals = new Map<number, number>();
    for (const t of tasks) {
      const week = blockWeekMap.get(t.plan_block_id);
      if (week !== undefined) {
        weekTotals.set(week, (weekTotals.get(week) || 0) + 1);
      }
    }

    const allWeeks = [
      ...new Set([...weekCounts.keys(), ...weekTotals.keys()]),
    ].sort((a, b) => a - b);

    return allWeeks.map((week) => ({
      week: `${unitPrefix}${week}`,
      completed: weekCounts.get(week) || 0,
      total: weekTotals.get(week) || 0,
    }));
  }, [tasks, blocks]);

  if (data.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">{progressLabel}</h2>
        <p className="text-sm text-muted-foreground text-center py-6">
          No task data yet. Complete some tasks to see your weekly progress.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-serif text-lg font-semibold">{progressLabel}</h2>
      <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="week" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip
            content={<ChartTooltipContent />}
            cursor={{ fill: "hsl(var(--muted))" }}
          />
          <Bar
            dataKey="completed"
            fill="var(--color-completed)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </section>
  );
};
