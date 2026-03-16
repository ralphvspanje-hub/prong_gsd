import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Play, Circle } from "lucide-react";

interface PlanOutline {
  total_weeks: number;
  weeks: {
    week_number: number;
    pillars: { pillar_name: string; weekly_goal: string }[];
  }[];
}

interface PlanSummaryStripProps {
  planOutline: PlanOutline;
  pacingProfile: string;
  allBlocks: { week_number: number; is_completed: boolean }[];
  planFormat?: string;
}

const PACING_LABELS: Record<string, string> = {
  aggressive: "Aggressive",
  steady: "Steady",
  exploratory: "Exploratory",
};

const PACING_COLORS: Record<string, string> = {
  aggressive: "bg-red-500/10 text-red-500 border-red-500/20",
  steady: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  exploratory: "bg-green-500/10 text-green-500 border-green-500/20",
};

export const PlanSummaryStrip = ({
  planOutline,
  pacingProfile,
  allBlocks,
  planFormat,
}: PlanSummaryStripProps) => {
  const isSprint = planFormat === "sprint";
  const weekStatuses = useMemo(() => {
    const weekBlockMap = new Map<number, boolean[]>();
    for (const b of allBlocks) {
      if (!weekBlockMap.has(b.week_number)) weekBlockMap.set(b.week_number, []);
      weekBlockMap.get(b.week_number)!.push(b.is_completed);
    }

    const statuses = new Map<number, "completed" | "current" | "future">();
    let foundCurrent = false;
    const sorted = [...weekBlockMap.keys()].sort((a, b) => a - b);
    for (const week of sorted) {
      const completions = weekBlockMap.get(week)!;
      if (completions.every(Boolean)) {
        statuses.set(week, "completed");
      } else if (!foundCurrent) {
        statuses.set(week, "current");
        foundCurrent = true;
      } else {
        statuses.set(week, "future");
      }
    }
    return statuses;
  }, [allBlocks]);

  // Find current week number
  const currentWeek = useMemo(() => {
    for (const [week, status] of weekStatuses) {
      if (status === "current") return week;
    }
    // All done or no blocks generated yet
    return allBlocks.length > 0
      ? Math.max(...allBlocks.map((b) => b.week_number))
      : 1;
  }, [weekStatuses, allBlocks]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold">Your Plan</h2>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={PACING_COLORS[pacingProfile] || ""}
          >
            {PACING_LABELS[pacingProfile] || pacingProfile}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {isSprint
              ? `Sprint ${currentWeek}`
              : `Week ${currentWeek} of ${planOutline.total_weeks}`}
          </span>
        </div>
      </div>

      {/* Week indicators */}
      <div className="flex flex-wrap gap-1.5">
        {planOutline.weeks.map((week) => {
          const status = weekStatuses.get(week.week_number) || "future";
          return (
            <div
              key={week.week_number}
              className="flex items-center justify-center h-7 w-7 rounded-md text-[10px] font-medium"
              title={`Week ${week.week_number}: ${status}`}
            >
              {status === "completed" && (
                <div className="h-7 w-7 rounded-md bg-green-500/20 flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </div>
              )}
              {status === "current" && (
                <div className="h-7 w-7 rounded-md bg-accent/20 ring-1 ring-accent/50 flex items-center justify-center">
                  <Play className="h-3 w-3 text-accent fill-accent" />
                </div>
              )}
              {status === "future" && (
                <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                  <Circle className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Link to="/plan">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground -ml-2"
        >
          View full plan <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </section>
  );
};
