import { useState } from "react";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type PlanTask = Tables<"plan_tasks">;

interface TaskItemProps {
  task: PlanTask;
  onToggle: (taskId: string, completed: boolean) => void;
}

// Platform badge colors
const PLATFORM_COLORS: Record<string, string> = {
  hackerrank: "bg-green-500/10 text-green-600 border-green-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  github: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  google: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  leetcode: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  kaggle: "bg-teal-500/10 text-teal-600 border-teal-500/20",
};

/** Constructs a search URL for the given platform and query. */
function buildSearchUrl(platform: string, query: string): string {
  const encoded = encodeURIComponent(query);
  const p = platform.toLowerCase();
  if (p.includes("youtube")) return `https://www.youtube.com/results?search_query=${encoded}`;
  if (p.includes("github")) return `https://github.com/search?q=${encoded}&type=repositories`;
  if (p.includes("leetcode")) return `https://leetcode.com/problemset/?search=${encoded}`;
  if (p.includes("hackerrank")) return `https://www.hackerrank.com/domains`;
  // Fallback: Google search scoped to the platform
  return `https://www.google.com/search?q=${encodeURIComponent(platform + " " + query)}`;
}

/** Individual task with checkbox, platform badge, resource link, time estimate, and why text. */
export const TaskItem = ({ task, onToggle }: TaskItemProps) => {
  const [whyExpanded, setWhyExpanded] = useState(false);
  const isCompleted = task.is_completed;
  const platformKey = task.platform.toLowerCase();
  const badgeColor = PLATFORM_COLORS[platformKey] || "bg-muted text-muted-foreground border-border";

  // Determine the resource link
  const resourceUrl = task.resource_type === "curated" && task.url
    ? task.url
    : task.search_query
      ? buildSearchUrl(task.platform, task.search_query)
      : null;

  const showWhyToggle = task.why_text && task.why_text.length >= 100;
  const showWhyInline = task.why_text && task.why_text.length < 100;

  return (
    <motion.div
      layout
      initial={false}
      animate={isCompleted ? { opacity: 0.6 } : { opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 py-3 ${isCompleted ? "opacity-60" : ""}`}
    >
      {/* Checkbox with completion animation */}
      <motion.div
        whileTap={{ scale: 0.9 }}
        animate={isCompleted ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.25 }}
        className="pt-0.5"
      >
        <Checkbox
          checked={isCompleted}
          onCheckedChange={(checked) => onToggle(task.id, !!checked)}
          className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
        />
      </motion.div>

      {/* Task content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Action text + platform badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
            {task.action}
          </span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badgeColor}`}>
            {task.platform}
          </Badge>
        </div>

        {/* Resource link */}
        {resourceUrl && !isCompleted && (
          <a
            href={resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            {task.resource_type === "curated" ? "Open resource" : `Search ${task.platform}`}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {/* Why text — inline for short, toggle for long */}
        {showWhyInline && !isCompleted && (
          <p className="text-xs text-muted-foreground">{task.why_text}</p>
        )}
        {showWhyToggle && !isCompleted && (
          <div>
            <button
              onClick={() => setWhyExpanded(!whyExpanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Why?
              {whyExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {whyExpanded && (
              <p className="text-xs text-muted-foreground mt-1">{task.why_text}</p>
            )}
          </div>
        )}
      </div>

      {/* Time estimate */}
      {task.estimated_time_minutes && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 pt-0.5">
          <Clock className="h-3 w-3" />
          {task.estimated_time_minutes}m
        </div>
      )}
    </motion.div>
  );
};
