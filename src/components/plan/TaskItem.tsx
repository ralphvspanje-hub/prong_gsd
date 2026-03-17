import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  Loader2,
  Send,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  pronggsd: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  freecodecamp: "bg-green-500/10 text-green-600 border-green-500/20",
  "mdn web docs": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "khan academy": "bg-green-500/10 text-green-600 border-green-500/20",
  arxiv: "bg-red-500/10 text-red-600 border-red-500/20",
  "google scholar": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "dev.to": "bg-gray-500/10 text-gray-600 border-gray-500/20",
  w3schools: "bg-green-500/10 text-green-600 border-green-500/20",
  "official docs": "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

/** Constructs a search URL for the given platform and query. */
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
  if (p.includes("freecodecamp"))
    return `https://www.freecodecamp.org/news/search/?query=${encoded}`;
  if (p.includes("mdn"))
    return `https://developer.mozilla.org/en-US/search?q=${encoded}`;
  if (p.includes("khan"))
    return `https://www.khanacademy.org/search?page_search_query=${encoded}`;
  if (p.includes("arxiv")) return `https://arxiv.org/search/?query=${encoded}`;
  if (p.includes("scholar"))
    return `https://scholar.google.com/scholar?q=${encoded}`;
  if (p.includes("dev.to")) return `https://dev.to/search?q=${encoded}`;
  if (p.includes("w3schools"))
    return `https://www.google.com/search?q=${encodeURIComponent("site:w3schools.com " + query)}`;
  if (p.includes("kaggle")) return `https://www.kaggle.com/search?q=${encoded}`;
  if (p.includes("official docs"))
    return `https://www.google.com/search?q=${encodeURIComponent("official documentation " + query)}`;
  // Fallback: Google search scoped to the platform
  return `https://www.google.com/search?q=${encodeURIComponent(platform + " " + query)}`;
}

const ANSWER_MAX_LENGTH = 2000;

/** Individual task with checkbox, platform badge, resource link, time estimate, and why text. */
export const TaskItem = ({ task, onToggle }: TaskItemProps) => {
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Practice question state
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{
    feedback: string;
    attempt: number;
    completed: boolean;
    can_retry: boolean;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(false);

  const isCompleted = task.is_completed;
  const isMockInterview = task.resource_type === "mock_interview";
  const isPracticeQuestion = task.resource_type === "practice_question";
  const attemptCount = task.attempt_count ?? 0;
  const userAnswers = (task.user_answers as any[]) ?? [];
  const lastFeedback = task.last_feedback;
  const platformKey = task.platform.toLowerCase();
  const badgeColor =
    PLATFORM_COLORS[platformKey] ||
    "bg-muted text-muted-foreground border-border";

  // Determine the resource link
  const resourceUrl =
    task.resource_type === "curated" && task.url
      ? task.url
      : task.search_query
        ? buildSearchUrl(task.platform, task.search_query)
        : null;

  const showWhyToggle = task.why_text && task.why_text.length >= 100;
  const showWhyInline = task.why_text && task.why_text.length < 100;

  // Practice question: checkbox disabled until at least 1 attempt
  const checkboxDisabled =
    isPracticeQuestion && attemptCount === 0 && !isCompleted;

  const handlePracticeSubmit = async () => {
    if (!answerText.trim() || submitting) return;
    const attempt = attemptCount + 1;
    if (attempt > 2) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "gsd-practice-feedback",
        { body: { task_id: task.id, answer: answerText.trim(), attempt } },
      );
      if (error || !data?.feedback) {
        toast.error("Failed to get feedback. Please try again.");
        setSubmitting(false);
        return;
      }
      setFeedbackData(data);
      setAnswerText("");
      // Refresh task data so attempt_count updates
      queryClient.invalidateQueries({ queryKey: ["plan-tasks"] });

      if (data.completed) {
        // Auto-complete fires the existing completion flow
        onToggle(task.id, true);
      }
    } catch {
      toast.error("Failed to get feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setRetrying(true);
    setFeedbackData(null);
  };

  const handleMarkComplete = () => {
    onToggle(task.id, true);
  };

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
        title={checkboxDisabled ? "Answer the question first" : undefined}
      >
        <Checkbox
          checked={isCompleted}
          disabled={checkboxDisabled}
          onCheckedChange={(checked) => onToggle(task.id, !!checked)}
          className={`data-[state=checked]:bg-accent data-[state=checked]:border-accent ${checkboxDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
        />
      </motion.div>

      {/* Task content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Action text + platform badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-sm ${isCompleted ? "line-through text-muted-foreground" : ""}`}
          >
            {task.action}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${badgeColor}`}
          >
            {task.platform}
          </Badge>
        </div>

        {/* Mock interview button */}
        {isMockInterview && !isCompleted && (
          <button
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              try {
                const { data, error } = await supabase.functions.invoke(
                  "gsd-mock-interview",
                  {
                    body: { action: "start", task_id: task.id },
                  },
                );
                if (error || !data?.mock_id) {
                  toast.error("Failed to start mock interview");
                  setStarting(false);
                  return;
                }
                navigate(`/mock-interview/${data.mock_id}`);
              } catch {
                toast.error("Failed to start mock interview");
                setStarting(false);
              }
            }}
            className="inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium disabled:opacity-50"
          >
            {starting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MessageSquare className="h-3 w-3" />
            )}
            {starting ? "Starting..." : "Start Mock Interview"}
          </button>
        )}

        {/* Resource link (non-practice-question, non-mock) */}
        {!isMockInterview &&
          !isPracticeQuestion &&
          resourceUrl &&
          !isCompleted && (
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

        {/* ---- Practice Question Inline UI ---- */}
        {isPracticeQuestion && !isCompleted && (
          <div className="mt-2 space-y-2">
            {/* State 0: Unanswered — show textarea + submit */}
            {attemptCount === 0 && !feedbackData && (
              <>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  maxLength={ANSWER_MAX_LENGTH}
                  placeholder="Type your answer..."
                  rows={3}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={handlePracticeSubmit}
                    disabled={submitting || !answerText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    {submitting ? "Submitting..." : "Submit Answer"}
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {answerText.length}/{ANSWER_MAX_LENGTH}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  You get 2 attempts with AI feedback
                </p>
              </>
            )}

            {/* State 1: First attempt feedback — show feedback + retry/complete */}
            {(feedbackData?.attempt === 1 ||
              (attemptCount === 1 && !feedbackData && !retrying)) && (
              <div className="space-y-2">
                {/* Show stored feedback if no live feedbackData */}
                <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
                  <p className="text-[10px] font-medium text-accent mb-1">
                    AI Feedback
                  </p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">
                    {feedbackData?.feedback || lastFeedback}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Try Again
                  </button>
                  <button
                    onClick={handleMarkComplete}
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Mark Complete
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  1/2 attempts used
                </p>
              </div>
            )}

            {/* Retry textarea (attempt 2 input) */}
            {retrying && attemptCount === 1 && !feedbackData?.completed && (
              <>
                {/* Show previous feedback for reference */}
                <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    Previous feedback
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {lastFeedback}
                  </p>
                </div>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  maxLength={ANSWER_MAX_LENGTH}
                  placeholder="Revise your answer..."
                  rows={3}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={handlePracticeSubmit}
                    disabled={submitting || !answerText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    {submitting ? "Submitting..." : "Submit Final Answer"}
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {answerText.length}/{ANSWER_MAX_LENGTH}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Practice question: completed — collapsible review */}
        {isPracticeQuestion && isCompleted && userAnswers.length > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setReviewExpanded(!reviewExpanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View your answers & feedback
              {reviewExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {reviewExpanded && (
              <div className="mt-2 space-y-2">
                {userAnswers.map((entry: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 space-y-1"
                  >
                    <p className="text-[10px] font-medium text-muted-foreground">
                      Attempt {entry.attempt}
                    </p>
                    <p className="text-xs text-foreground">{entry.answer}</p>
                    <div className="rounded border border-accent/20 bg-accent/5 px-2 py-1.5 mt-1">
                      <p className="text-[10px] font-medium text-accent mb-0.5">
                        Feedback
                      </p>
                      <p className="text-xs text-foreground whitespace-pre-wrap">
                        {entry.feedback}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              {whyExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {whyExpanded && (
              <p className="text-xs text-muted-foreground mt-1">
                {task.why_text}
              </p>
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
