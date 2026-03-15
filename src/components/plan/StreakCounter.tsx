import { Flame, Calendar } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type UserProgress = Tables<"user_progress">;

interface StreakCounterProps {
  progress: UserProgress | null;
}

/** Compact day counter + streak display at the top of the daily view. */
export const StreakCounter = ({ progress }: StreakCounterProps) => {
  if (!progress) return null;

  const { current_day, current_streak } = progress;

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5" />
        Day {current_day}
      </span>
      {current_streak > 0 && (
        <span className="flex items-center gap-1.5">
          {current_streak >= 3 && <Flame className="h-3.5 w-3.5 text-orange-500" />}
          {current_streak}-day streak
        </span>
      )}
    </div>
  );
};
