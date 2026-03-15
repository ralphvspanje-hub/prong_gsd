import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, Flame, CalendarDays, Target } from "lucide-react";

interface ProgressSummaryCardsProps {
  totalTasksCompleted: number;
  currentStreak: number;
  longestStreak: number;
  currentDay: number;
  planCompletionPercent: number;
}

const stats = (props: ProgressSummaryCardsProps) => [
  {
    label: "Tasks Done",
    value: props.totalTasksCompleted,
    icon: CheckSquare,
  },
  {
    label: "Streak",
    value: `${props.currentStreak}d`,
    sub: `Best: ${props.longestStreak}d`,
    icon: Flame,
  },
  {
    label: "Days Active",
    value: props.currentDay,
    icon: CalendarDays,
  },
  {
    label: "Plan",
    value: `${props.planCompletionPercent}%`,
    icon: Target,
  },
];

export const ProgressSummaryCards = (props: ProgressSummaryCardsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats(props).map((s) => (
        <Card key={s.label} className="border-border">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <s.icon className="h-5 w-5 text-accent shrink-0" />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{s.value}</p>
              <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              {"sub" in s && s.sub && (
                <p className="text-[10px] text-muted-foreground">{s.sub}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
