import { useMemo } from "react";
import { Flame } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type PlanTask = Tables<"plan_tasks">;
type UserProgress = Tables<"user_progress">;

interface ActivitySectionProps {
  progress: UserProgress | null;
  completedTasks: PlanTask[];
}

/** Build a map of date string (YYYY-MM-DD) → task count for the last N days. */
function buildDailyCountMap(tasks: PlanTask[], days: number): Map<string, number> {
  const counts = new Map<string, number>();
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  for (const t of tasks) {
    if (!t.completed_at) continue;
    const d = new Date(t.completed_at);
    if (d < cutoff) continue;
    const key = d.toLocaleDateString("en-CA"); // YYYY-MM-DD format
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/** Generate the last N days as YYYY-MM-DD strings. */
function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString("en-CA"));
  }
  return days;
}

const HEATMAP_DAYS = 84; // 12 weeks
const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""];

function intensityClass(count: number): string {
  if (count === 0) return "bg-muted";
  if (count <= 1) return "bg-accent/30";
  if (count <= 2) return "bg-accent/60";
  return "bg-accent";
}

export const ActivitySection = ({ progress, completedTasks }: ActivitySectionProps) => {
  const streak = progress?.current_streak ?? 0;
  const longest = progress?.longest_streak ?? 0;

  const { days, counts } = useMemo(() => {
    const d = lastNDays(HEATMAP_DAYS);
    const c = buildDailyCountMap(completedTasks, HEATMAP_DAYS);
    return { days: d, counts: c };
  }, [completedTasks]);

  // Organize days into columns (weeks), rows are days of week (0=Sun..6=Sat)
  // We display Mon–Sun top-to-bottom, so remap: row 0=Mon, row 6=Sun
  const grid = useMemo(() => {
    const columns: (string | null)[][] = [];
    let col: (string | null)[] = [];

    for (const day of days) {
      const d = new Date(day + "T12:00:00"); // noon to avoid timezone issues
      const dow = d.getDay(); // 0=Sun, 1=Mon...6=Sat
      const row = dow === 0 ? 6 : dow - 1; // remap: Mon=0..Sun=6

      // Start a new column when we hit Monday and have existing data
      if (row === 0 && col.length > 0) {
        // Pad remaining slots in previous column
        while (col.length < 7) col.push(null);
        columns.push(col);
        col = [];
      }

      // Pad leading nulls if starting mid-week
      while (col.length < row) col.push(null);
      col.push(day);
    }

    // Pad and push final column
    if (col.length > 0) {
      while (col.length < 7) col.push(null);
      columns.push(col);
    }

    return columns;
  }, [days]);

  return (
    <section className="space-y-4">
      {/* Big streak counter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-accent/10">
          <Flame className={`h-8 w-8 ${streak >= 3 ? "text-accent" : "text-muted-foreground"}`} />
        </div>
        <div>
          <p className="text-3xl font-bold leading-tight">
            {streak} day{streak !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Current streak · Best: {longest} day{longest !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Activity heatmap */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {/* Weekday labels */}
          <div className="flex flex-col gap-[3px] shrink-0 pr-1">
            {WEEKDAYS.map((label, i) => (
              <div key={i} className="h-[13px] w-5 text-[10px] text-muted-foreground leading-[13px]">
                {label}
              </div>
            ))}
          </div>

          {/* Grid columns (weeks) */}
          {grid.map((column, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {column.map((day, ri) => (
                <div
                  key={ri}
                  className={`h-[13px] w-[13px] rounded-sm ${
                    day ? intensityClass(counts.get(day) || 0) : "bg-transparent"
                  }`}
                  title={day ? `${day}: ${counts.get(day) || 0} tasks` : undefined}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="h-[10px] w-[10px] rounded-sm bg-muted" />
          <div className="h-[10px] w-[10px] rounded-sm bg-accent/30" />
          <div className="h-[10px] w-[10px] rounded-sm bg-accent/60" />
          <div className="h-[10px] w-[10px] rounded-sm bg-accent" />
          <span>More</span>
        </div>
      </div>
    </section>
  );
};
