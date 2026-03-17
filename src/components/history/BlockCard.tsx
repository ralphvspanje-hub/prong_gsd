import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Check, ChevronDown, Clock, ExternalLink } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type PlanBlock = Tables<"plan_blocks">;
type PlanTask = Tables<"plan_tasks">;

interface CheckinFeedback {
  difficulty?: string;
  note?: string;
}

interface BlockCardProps {
  block: PlanBlock;
  tasks: PlanTask[];
  pillarName: string;
  blockLabel?: string;
}

// Reuse platform badge colors from TaskItem
const PLATFORM_COLORS: Record<string, string> = {
  hackerrank: "bg-green-500/10 text-green-600 border-green-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  github: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  google: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  leetcode: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  kaggle: "bg-teal-500/10 text-teal-600 border-teal-500/20",
};

function buildSearchUrl(platform: string, query: string): string {
  const encoded = encodeURIComponent(query);
  const p = platform.toLowerCase();
  if (p.includes("youtube"))
    return `https://www.youtube.com/results?search_query=${encoded}`;
  if (p.includes("github"))
    return `https://github.com/search?q=${encoded}&type=repositories`;
  if (p.includes("leetcode"))
    return `https://leetcode.com/problemset/?search=${encoded}`;
  if (p.includes("hackerrank")) return `https://www.hackerrank.com/domains`;
  return `https://www.google.com/search?q=${encodeURIComponent(platform + " " + query)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const BlockCard = ({
  block,
  tasks,
  pillarName,
  blockLabel = "Week",
}: BlockCardProps) => {
  const completedCount = tasks.filter((t) => t.is_completed).length;
  const feedback = block.checkin_feedback as unknown as CheckinFeedback | null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="w-full">
        <Card
          className={`border-border hover:border-accent/30 transition-colors ${
            !block.is_completed ? "opacity-50" : ""
          }`}
        >
          <CardContent className="flex items-center justify-between py-3">
            <div className="text-left space-y-0.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{block.title}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {pillarName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {blockLabel} {block.week_number}
                {block.completed_at && ` · ${formatDate(block.completed_at)}`}
                {" · "}
                {completedCount}/{tasks.length} tasks
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          </CardContent>
        </Card>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Card className="border-border border-t-0 rounded-t-none">
          <CardContent className="py-4 space-y-3">
            {/* Weekly goal */}
            <p className="text-sm text-muted-foreground">{block.weekly_goal}</p>

            {/* Task list (read-only) */}
            <div className="space-y-2">
              {tasks
                .sort((a, b) => a.task_order - b.task_order)
                .map((task) => {
                  const platformKey = task.platform.toLowerCase();
                  const badgeColor =
                    PLATFORM_COLORS[platformKey] ||
                    "bg-muted text-muted-foreground border-border";
                  const resourceUrl =
                    task.resource_type === "curated" && task.url
                      ? task.url
                      : task.search_query
                        ? buildSearchUrl(task.platform, task.search_query)
                        : null;

                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-2 py-1.5 ${
                        task.is_completed ? "" : "opacity-50"
                      }`}
                    >
                      <div className="pt-0.5 shrink-0">
                        {task.is_completed ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm">{task.action}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${badgeColor}`}
                          >
                            {task.platform}
                          </Badge>
                        </div>
                        {resourceUrl && (
                          <a
                            href={resourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            {task.resource_type === "curated"
                              ? "Open resource"
                              : `Search ${task.platform}`}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {task.estimated_time_minutes && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 pt-0.5">
                          <Clock className="h-3 w-3" />
                          {task.estimated_time_minutes <= 20
                            ? "Short"
                            : task.estimated_time_minutes <= 40
                              ? "Medium"
                              : "Long"}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Checkin feedback */}
            {feedback && (
              <div className="flex gap-2 pt-2 border-t border-border">
                {feedback.difficulty && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {feedback.difficulty.replace(/_/g, " ")}
                  </Badge>
                )}
                {feedback.note && (
                  <span className="text-xs text-muted-foreground italic">
                    "{feedback.note}"
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
