import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

interface PillarGoal {
  pillarName: string;
  weeklyGoal: string;
}

interface WeeklyGoalCardProps {
  weekNumber: number;
  pillarGoals: PillarGoal[];
}

/** Shows the current week number and weekly goal per active pillar. */
export const WeeklyGoalCard = ({ weekNumber, pillarGoals }: WeeklyGoalCardProps) => {
  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-serif">
          <Target className="h-4 w-4 text-muted-foreground" />
          Week {weekNumber}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {pillarGoals.map((pg) => (
          <div key={pg.pillarName} className="flex items-start gap-2">
            <div className="mt-1.5 h-2 w-2 rounded-full bg-accent shrink-0" />
            <p className="text-sm">
              <span className="font-medium">{pg.pillarName}</span>
              <span className="text-muted-foreground"> — {pg.weeklyGoal}</span>
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
