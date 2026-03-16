import { useState, useCallback, useMemo } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { StreakCounter } from "@/components/plan/StreakCounter";
import { PacingBanner } from "@/components/plan/PacingBanner";
import { WeeklyGoalCard } from "@/components/plan/WeeklyGoalCard";
import { DailyTaskList } from "@/components/plan/DailyTaskList";
import { CheckinModal } from "@/components/plan/CheckinModal";
import { PlanCompletionModal } from "@/components/plan/PlanCompletionModal";
import InterviewCountdown from "@/components/plan/InterviewCountdown";
import { MistakeJournalDisplay } from "@/components/plan/MistakeJournalDisplay";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LearningPlan = Tables<"learning_plans">;
type PlanBlock = Tables<"plan_blocks">;
type PlanTask = Tables<"plan_tasks">;
type UserProgress = Tables<"user_progress">;

interface WeekPillar {
  pillar_name: string;
  weekly_goal: string;
  difficulty: number;
  pillar_id?: string;
}

interface Week {
  week_number: number;
  pillars: WeekPillar[];
}

interface PlanOutline {
  total_weeks: number;
  weeks: Week[];
}

// ---------------------------------------------------------------------------
// InterviewDashboard — dedicated interview prep experience
// ---------------------------------------------------------------------------

const InterviewDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Set localStorage so shared pages (/plan, /mentor) know we're in interview mode
  useMemo(() => {
    localStorage.setItem("pronggsd-dashboard-view", "interview_prep");
  }, []);

  // Modal state
  const [checkinBlock, setCheckinBlock] = useState<PlanBlock | null>(null);
  const [showPlanComplete, setShowPlanComplete] = useState(false);
  const [blockPollCount, setBlockPollCount] = useState(0);

  // ---- Queries ----

  // Active interview prep plan
  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["interview-plan", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_plans")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .eq("plan_type", "interview_prep")
        .maybeSingle();
      if (error) throw error;
      return data as LearningPlan | null;
    },
    enabled: !!userId,
  });

  // Interview profile context (for countdown)
  const { data: interviewProfile } = useQuery({
    queryKey: ["interview-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("interview_target_role, interview_date, interview_intensity")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!plan,
  });

  // Pillars (interview-specific: sort_order >= 100)
  const { data: pillars } = useQuery({
    queryKey: ["pillars", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pillars")
        .select("id, name, sort_order")
        .eq("user_id", userId!)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Current week's plan blocks
  const { data: currentBlocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["plan-blocks-current", plan?.id],
    queryFn: async () => {
      const { data: firstBlock } = await supabase
        .from("plan_blocks")
        .select("week_number")
        .eq("plan_id", plan!.id)
        .eq("is_completed", false)
        .order("week_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstBlock) {
        const { count } = await supabase
          .from("plan_blocks")
          .select("*", { count: "exact", head: true })
          .eq("plan_id", plan!.id);
        if (count && count > 0) return [] as PlanBlock[];
        return null;
      }

      const { data, error } = await supabase
        .from("plan_blocks")
        .select("*")
        .eq("plan_id", plan!.id)
        .eq("week_number", firstBlock.week_number)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as PlanBlock[];
    },
    enabled: !!plan?.id,
    refetchInterval: (query) => {
      if (query.state.data === null && blockPollCount < 10) {
        setBlockPollCount((c) => c + 1);
        return 3000;
      }
      return false;
    },
  });

  // Tasks for current blocks
  const blockIds = useMemo(
    () => (currentBlocks || []).map((b) => b.id),
    [currentBlocks],
  );

  const { data: tasks } = useQuery({
    queryKey: ["plan-tasks", blockIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_tasks")
        .select("*")
        .in("plan_block_id", blockIds)
        .order("task_order", { ascending: true });
      if (error) throw error;
      return (data || []) as PlanTask[];
    },
    enabled: blockIds.length > 0,
  });

  // User progress (streak, day counter)
  const { data: progress } = useQuery({
    queryKey: ["user-progress", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as UserProgress | null;
    },
    enabled: !!userId,
  });

  // ---- Derived state ----

  const outline = plan?.plan_outline as unknown as PlanOutline | null;
  const currentWeekNumber = currentBlocks?.[0]?.week_number;

  // Pacing notes — limit to 1 for interview prep to avoid repetition
  const pacingNotes = useMemo(() => {
    const notes = (currentBlocks || [])
      .map((b) => b.pacing_note)
      .filter(Boolean) as string[];
    return notes.slice(0, 1);
  }, [currentBlocks]);

  // Weekly goal cards
  const pillarGoals = useMemo(() => {
    if (!currentBlocks || !pillars) return [];
    return currentBlocks
      .filter((b) => !b.is_completed)
      .map((b) => ({
        pillarName:
          pillars.find((p) => p.id === b.pillar_id)?.name || "Unknown",
        weeklyGoal: b.weekly_goal,
      }));
  }, [currentBlocks, pillars]);

  const isPlanComplete =
    currentBlocks !== null &&
    currentBlocks !== undefined &&
    currentBlocks.length === 0 &&
    plan;

  // ---- Task completion (same logic as Dashboard) ----

  const handleToggleTask = useCallback(
    async (taskId: string, completed: boolean) => {
      if (!userId) return;

      queryClient.setQueryData<PlanTask[]>(["plan-tasks", blockIds], (old) =>
        old?.map((t) =>
          t.id === taskId
            ? {
                ...t,
                is_completed: completed,
                completed_at: completed ? new Date().toISOString() : null,
              }
            : t,
        ),
      );

      const { error: taskError } = await supabase
        .from("plan_tasks")
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", taskId);

      if (taskError) {
        toast.error("Failed to update task");
        queryClient.invalidateQueries({ queryKey: ["plan-tasks", blockIds] });
        return;
      }

      if (completed) {
        supabase.functions
          .invoke("gsd-process-checkin", {
            body: { event_type: "task_complete", task_id: taskId },
          })
          .then(({ data }) => {
            if (data) {
              queryClient.invalidateQueries({
                queryKey: ["user-progress", userId],
              });
              if (data.block_auto_complete && data.block_id) {
                const block = currentBlocks?.find(
                  (b) => b.id === data.block_id,
                );
                if (block) setCheckinBlock(block);
              }
              if (data.gap_return) {
                toast("Welcome back! Your streak starts fresh today.");
              }
              if (data.pacing_note !== undefined) {
                queryClient.invalidateQueries({
                  queryKey: ["plan-blocks-current", plan?.id],
                });
              }
            }
          })
          .catch(() => {
            queryClient.invalidateQueries({
              queryKey: ["user-progress", userId],
            });
          });
      } else {
        await supabase
          .from("user_progress")
          .update({
            total_tasks_completed: Math.max(
              0,
              (progress?.total_tasks_completed ?? 1) - 1,
            ),
          })
          .eq("user_id", userId);
        queryClient.invalidateQueries({ queryKey: ["user-progress", userId] });

        const parentBlock = currentBlocks?.find((b) =>
          tasks?.some((t) => t.id === taskId && t.plan_block_id === b.id),
        );
        if (parentBlock?.is_completed) {
          await supabase
            .from("plan_blocks")
            .update({ is_completed: false, completed_at: null })
            .eq("id", parentBlock.id);
          queryClient.invalidateQueries({
            queryKey: ["plan-blocks-current", plan?.id],
          });
        }
      }
    },
    [userId, progress, blockIds, tasks, currentBlocks, plan, queryClient],
  );

  // ---- Check-in submission ----

  const handleCheckinSubmit = useCallback(
    async (difficulty: string, note: string) => {
      if (!checkinBlock || !plan || !outline) return;

      const { data: checkinResult, error: checkinError } =
        await supabase.functions.invoke("gsd-process-checkin", {
          body: {
            event_type: "block_complete",
            block_id: checkinBlock.id,
            difficulty: difficulty || null,
            note: note || null,
          },
        });

      if (checkinError) {
        toast.error("Check-in failed. Please try again.");
        setCheckinBlock(null);
        return;
      }

      if (checkinResult?.level_up) {
        toast.success(
          `Level up! ${checkinResult.level_up.pillar_name} → Level ${checkinResult.level_up.new_level}`,
        );
      }

      if (checkinResult?.plan_status === "plan_complete") {
        setCheckinBlock(null);
        setShowPlanComplete(true);
        queryClient.invalidateQueries({
          queryKey: ["plan-blocks-current", plan.id],
        });
        return;
      }

      // Interview plans generate all blocks upfront, so no next-block generation needed.
      // But handle it for safety in case plan was extended.
      if (checkinResult?.next_block?.should_generate) {
        const nextWeek = checkinResult.next_block;
        for (const wp of nextWeek.pillars || []) {
          const pillarId =
            wp.pillar_id ||
            (pillars || []).find(
              (p: { id: string; name: string }) =>
                p.name.toLowerCase().includes(wp.pillar_name.toLowerCase()) ||
                wp.pillar_name.toLowerCase().includes(p.name.toLowerCase()),
            )?.id;

          if (!pillarId) continue;

          await supabase.functions.invoke("gsd-generate-plan", {
            body: {
              mode: "plan_block",
              plan_id: plan.id,
              week_number: nextWeek.week_number,
              pillar_id: pillarId,
              weekly_goal: wp.weekly_goal,
              active_pillar_count: nextWeek.pillars.length,
              difficulty_adjustment: checkinResult.difficulty_adjustment,
              feedback_context: checkinResult.feedback_context,
            },
          });
        }
      }

      setCheckinBlock(null);
      queryClient.invalidateQueries({
        queryKey: ["plan-blocks-current", plan.id],
      });
      queryClient.invalidateQueries({ queryKey: ["plan-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-progress", userId] });
    },
    [checkinBlock, plan, outline, pillars, userId, queryClient],
  );

  // ---- Render ----

  // No interview plan → back to main dashboard
  if (!planLoading && !plan && userId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Loading
  if (planLoading || blocksLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4 py-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  // Blocks still generating
  if (currentBlocks === null) {
    const generationTimedOut = blockPollCount >= 10;
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
          {generationTimedOut ? (
            <>
              <Zap className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground max-w-xs">
                Plan generation seems to be taking too long. This can happen if
                the AI service is busy.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setBlockPollCount(0);
                  queryClient.invalidateQueries({
                    queryKey: ["plan-blocks-current", plan?.id],
                  });
                }}
              >
                Retry
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm text-muted-foreground">
                Generating your interview prep plan...
              </p>
            </>
          )}
        </div>
      </Layout>
    );
  }

  // Plan complete
  if (isPlanComplete && outline) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
          <Zap className="h-10 w-10 text-orange-500" />
          <h1 className="font-serif text-2xl font-bold">
            Interview prep complete!
          </h1>
          <p className="text-sm text-muted-foreground max-w-md">
            You've finished your {outline.total_weeks}-week crash course. Talk
            to your mentor for final tips, or head back to your learning plan.
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              onClick={() => navigate("/mentor")}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Final tips
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to learning
            </Button>
          </div>
        </div>
        <PlanCompletionModal
          open={showPlanComplete}
          onOpenChange={setShowPlanComplete}
          totalWeeks={outline.total_weeks}
        />
      </Layout>
    );
  }

  const pillarNameForBlock = (block: PlanBlock) =>
    (pillars || []).find((p) => p.id === block.pillar_id)?.name || "Unknown";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5 py-4">
        {/* Back to learning dashboard */}
        <Link to="/dashboard">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground -ml-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Learning Dashboard
          </Button>
        </Link>

        {/* Interview countdown */}
        {interviewProfile && (
          <InterviewCountdown
            interviewDate={interviewProfile.interview_date}
            targetRole={interviewProfile.interview_target_role}
            intensity={interviewProfile.interview_intensity}
          />
        )}

        {/* Streak counter */}
        <StreakCounter progress={progress || null} />

        {/* Pacing banner */}
        <PacingBanner pacingNotes={pacingNotes} />

        {/* Weekly goal card */}
        {currentWeekNumber && pillarGoals.length > 0 && (
          <WeeklyGoalCard
            weekNumber={currentWeekNumber}
            pillarGoals={pillarGoals}
          />
        )}

        {/* Daily task list */}
        <DailyTaskList
          blocks={currentBlocks || []}
          tasks={tasks || []}
          pillars={(pillars || []).map((p) => ({ id: p.id, name: p.name }))}
          onToggleTask={handleToggleTask}
        />

        {/* Mistake journal */}
        {userId && <MistakeJournalDisplay userId={userId} />}

        {/* View full plan link */}
        <div className="pt-2">
          <Link to="/plan">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
            >
              View full plan <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Check-in modal */}
      {checkinBlock && (
        <CheckinModal
          open={!!checkinBlock}
          onOpenChange={(open) => {
            if (!open) setCheckinBlock(null);
          }}
          weekNumber={checkinBlock.week_number}
          pillarName={pillarNameForBlock(checkinBlock)}
          onSubmit={handleCheckinSubmit}
        />
      )}
    </Layout>
  );
};

export default InterviewDashboard;
