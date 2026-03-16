import { Target, Clock, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface InterviewCountdownProps {
  interviewDate: string | null;
  targetRole: string | null;
  intensity: string | null;
}

const InterviewCountdown = ({ interviewDate, targetRole, intensity }: InterviewCountdownProps) => {
  const daysUntil = interviewDate
    ? Math.max(0, Math.ceil((new Date(interviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3">
      <Target className="h-5 w-5 text-orange-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {targetRole || "Interview Prep"}
        </p>
        {daysUntil !== null && (
          <p className={`text-xs ${daysUntil <= 3 ? "text-red-500 font-semibold" : daysUntil <= 7 ? "text-orange-500" : "text-muted-foreground"}`}>
            {daysUntil === 0 ? "Interview is today!" : `${daysUntil} day${daysUntil !== 1 ? "s" : ""} until interview`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {intensity === "100_percent" && (
          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 gap-1">
            <Flame className="h-3 w-3" />
            Full Intensity
          </Badge>
        )}
        {daysUntil !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>D-{daysUntil}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewCountdown;
