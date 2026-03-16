import { BookOpen, Target } from "lucide-react";

interface DashboardToggleProps {
  viewMode: "learning" | "interview_prep";
  onToggle: (mode: "learning" | "interview_prep") => void;
}

const DashboardToggle = ({ viewMode, onToggle }: DashboardToggleProps) => {
  return (
    <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
      <button
        onClick={() => onToggle("learning")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === "learning"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <BookOpen className="h-3.5 w-3.5" />
        Learning Plan
      </button>
      <button
        onClick={() => onToggle("interview_prep")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === "interview_prep"
            ? "bg-orange-500 text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Target className="h-3.5 w-3.5" />
        Interview Prep
      </button>
    </div>
  );
};

export default DashboardToggle;
