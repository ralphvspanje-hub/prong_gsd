import { useState, useCallback, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { StreakCounter } from "@/components/plan/StreakCounter";
import { PacingBanner } from "@/components/plan/PacingBanner";
import { WeeklyGoalCard } from "@/components/plan/WeeklyGoalCard";
import { DailyTaskList } from "@/components/plan/DailyTaskList";
import { CheckinModal } from "@/components/plan/CheckinModal";
import { PlanCompletionModal } from "@/components/plan/PlanCompletionModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardToggle from "@/components/plan/DashboardToggle";
import InterviewCountdown from "@/components/plan/InterviewCountdown";
import { MistakeJournalDisplay } from "@/components/plan/MistakeJournalDisplay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Loader2, ArrowRight, Target } from "lucide-react";
import { Link } from "react-router-dom";
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
// Dashboard
// ---------------------------------------------------------------------------

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // View mode toggle (persisted in localStorage)
  const [viewMode, setViewMode] = useState<"learning" | "interview_prep">(
    () =>
      (localStorage.getItem("pronggsd-dashboard-view") as
        | "learning"
        | "interview_prep") || "learning",
  );

  const handleViewToggle = (mode: "learning" | "interview_prep") => {
    setViewMode(mode);
    localStorage.setItem("pronggsd-dashboard-view", mode);
    setBlockPollCount(0);
  };

  // Modal state
  const [checkinBlock, setCheckinBlock] = useState<PlanBlock | null>(null);
  const [showPlanComplete, setShowPlanComplete] = useState(false);
  const [showExtendPrompt, setShowExtendPrompt] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [blockPollCount, setBlockPollCount] = useState(0);

  // ---- Queries ----

  // Active learning plan
  const { data: learningPlan, isLoading: learningPlanLoading } = useQuery({
    queryKey: ["learning-plan", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_plans")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .eq("plan_type", "learning")
        .maybeSingle();
      if (error) throw error;
      return data as LearningPlan | null;
    },
    enabled: !!userId,
  });

  // Active interview prep plan
  const { data: interviewPlan, isLoading: interviewPlanLoading } = useQuery({
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
    enabled: !!userId && !!interviewPlan,
  });

  // Derived: which plan is active for this view
  const plan = viewMode === "interview_prep" ? interviewPlan : learningPlan;
  const planLoading =
    viewMode === "interview_prep" ? interviewPlanLoading : learningPlanLoading;
  const hasBothPlans = !!learningPlan && !!interviewPlan;

  // Pillars (for name lookup)
  const { data: pillars } = useQuery({
    queryKey: ["pillars", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pillars")
        .select("id, name")
        .eq("user_id", userId!)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Current week's plan blocks — uncompleted blocks with lowest week number.
  // Poll every 5s when plan exists but no blocks yet (generation race condition).
  const { data: currentBlocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["plan-blocks-current", plan?.id],
    queryFn: async () => {
      // First find the lowest uncompleted week number
      const { data: firstBlock } = await supabase
        .from("plan_blocks")
        .select("week_number")
        .eq("plan_id", plan!.id)
        .eq("is_completed", false)
        .order("week_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstBlock) {
        // All blocks completed — check if plan is fully done
        const { count } = await supabase
          .from("plan_blocks")
          .select("*", { count: "exact", head: true })
          .eq("plan_id", plan!.id);
        // If blocks exist but all completed, the plan is done
        if (count && count > 0) return [] as PlanBlock[];
        // No blocks at all — still generating
        return null;
      }

      // Fetch all blocks for the current week
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
    // Poll when blocks haven't loaded yet (still generating).
    // Give up after 10 polls (~30s) to avoid infinite spinning on silent failure.
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

  // Pacing notes from current blocks (limit to 1 for interview prep to avoid repetition)
  const pacingNotes = useMemo(() => {
    const notes = (currentBlocks || [])
      .map((b) => b.pacing_note)
      .filter(Boolean) as string[];
    return viewMode === "interview_prep"
      ? notes.slice(0, 1)
      : [...new Set(notes)];
  }, [currentBlocks, viewMode]);

  // Weekly goal cards
  const pillarGoals = useMemo(() => {
    if (!currentBlocks || !pillars) return [];
    // Only show uncompleted blocks as active goals
    return currentBlocks
      .filter((b) => !b.is_completed)
      .map((b) => ({
        pillarName:
          pillars.find((p) => p.id === b.pillar_id)?.name || "Unknown",
        weeklyGoal: b.weekly_goal,
      }));
  }, [currentBlocks, pillars]);

  // Check if the entire plan is complete (all blocks done, blocks exist)
  const isPlanComplete =
    currentBlocks !== null &&
    currentBlocks !== undefined &&
    currentBlocks.length === 0 &&
    plan;

  // ---- Task completion ----

  const handleToggleTask = useCallback(
    async (taskId: string, completed: boolean) => {
      if (!userId) return;

      // Optimistic update
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

      // Update task in DB
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
        // Fire-and-forget: edge function handles streak + pacing authoritatively
        supabase.functions
          .invoke("gsd-process-checkin", {
            body: { event_type: "task_complete", task_id: taskId },
          })
          .then(({ data }) => {
            if (data) {
              queryClient.invalidateQueries({
                queryKey: ["user-progress", userId],
              });
              // Edge function detected block completion → show CheckinModal
              if (data.block_auto_complete && data.block_id) {
                const block = currentBlocks?.find(
                  (b) => b.id === data.block_id,
                );
                if (block) setCheckinBlock(block);
              }
              if (data.gap_return) {
                toast("Welcome back! Your streak starts fresh today.");
              }
              // Refresh pacing notes if updated
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
        // Un-completion: decrement total_tasks_completed directly
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

        // Revert block completion if parent block was marked complete
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

      // Call process-checkin edge function — handles block completion, leveling, and plan progression
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

      // Level-up toast
      if (checkinResult?.level_up) {
        toast.success(
          `Level up! ${checkinResult.level_up.pillar_name} → Level ${checkinResult.level_up.new_level}`,
        );
      }

      // Plan progression
      if (checkinResult?.plan_status === "plan_complete") {
        setCheckinBlock(null);
        setShowPlanComplete(true);
        queryClient.invalidateQueries({
          queryKey: ["plan-blocks-current", plan.id],
        });
        return;
      }

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

      // Near-end prompt for exploratory plans
      if (checkinResult?.nearing_end) {
        setShowExtendPrompt(true);
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

  // ---- Extend plan handler ----

  const handleExtendPlan = useCallback(async () => {
    if (!plan) return;
    setIsExtending(true);
    try {
      await supabase.functions.invoke("gsd-generate-plan", {
        body: { mode: "extend_plan", plan_id: plan.id, additional_weeks: 4 },
      });
      toast.success("Plan extended! New weeks have been added.");
      queryClient.invalidateQueries({ queryKey: ["learning-plan", userId] });
      queryClient.invalidateQueries({
        queryKey: ["plan-blocks-current", plan.id],
      });
    } catch {
      toast.error("Failed to extend plan.");
    } finally {
      setIsExtending(false);
      setShowExtendPrompt(false);
    }
  }, [plan, userId, queryClient]);

  // ---- Render ----

  // No-plan redirect — only if neither plan type exists
  if (
    !learningPlanLoading &&
    !interviewPlanLoading &&
    !learningPlan &&
    !interviewPlan &&
    userId
  ) {
    // After interview-only rewind, go to interview onboarding instead of context-upload
    const hasInterviewPillars = pillars?.some((p) => p.sort_order >= 100);
    const hasLearningPillars = pillars?.some((p) => p.sort_order < 100);
    if (hasInterviewPillars && !hasLearningPillars) {
      return <Navigate to="/interview-onboarding" replace />;
    }
    return <Navigate to="/context-upload" replace />;
  }

  // If current view's plan doesn't exist but the other does, auto-switch
  if (!planLoading && !plan && userId) {
    if (viewMode === "interview_prep" && learningPlan) {
      handleViewToggle("learning");
    } else if (viewMode === "learning" && interviewPlan) {
      handleViewToggle("interview_prep");
    }
  }

  // Loading state
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

  // Plan exists but blocks still generating (or generation failed)
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
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">
                Generating your first week...
              </p>
            </>
          )}
        </div>
      </Layout>
    );
  }

  // Plan complete (all blocks done)
  if (isPlanComplete && outline) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
          <Zap className="h-10 w-10 text-accent" />
          <h1 className="font-serif text-2xl font-bold">Plan complete!</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            You've finished your {outline.total_weeks}-week plan. Talk to your
            mentor about what's next, or start fresh.
          </p>
          <div className="flex gap-2 mt-2">
            <Button onClick={() => navigate("/mentor")}>What's next?</Button>
            <Button variant="outline" onClick={() => navigate("/onboarding")}>
              Start fresh
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
        {/* Plan type toggle (only when both plans exist) */}
        {hasBothPlans && (
          <div className="flex justify-center">
            <DashboardToggle viewMode={viewMode} onToggle={handleViewToggle} />
          </div>
        )}

        {/* Interview countdown (when in interview prep mode) */}
        {viewMode === "interview_prep" && interviewProfile && (
          <InterviewCountdown
            interviewDate={interviewProfile.interview_date}
            targetRole={interviewProfile.interview_target_role}
            intensity={interviewProfile.interview_intensity}
          />
        )}

        {/* Interview prep banner (when only learning plan exists) */}
        {!interviewPlan && learningPlan && viewMode === "learning" && (
          <Link to="/interview-onboarding" className="block">
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-orange-500/30 bg-orange-500/5 px-4 py-3 hover:bg-orange-500/10 transition-colors cursor-pointer">
              <Target className="h-4 w-4 text-orange-500 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Interview coming up?{" "}
                <span className="text-orange-500 font-medium">
                  Start a crash course
                </span>
              </p>
            </div>
          </Link>
        )}

        {/* Streak counter */}
        <StreakCounter progress={progress || null} />

        {/* Pacing banner */}
        <PacingBanner pacingNotes={pacingNotes} />

        {/* Extend plan prompt (exploratory plans nearing end) */}
        {showExtendPrompt && (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium">Your plan is almost done!</p>
            <p className="text-sm text-muted-foreground">
              Would you like to extend it with more weeks, or talk to your
              mentor about what's next?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleExtendPlan}
                disabled={isExtending}
              >
                {isExtending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />{" "}
                    Extending...
                  </>
                ) : (
                  "Extend plan"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowExtendPrompt(false);
                  navigate("/mentor");
                }}
              >
                Talk to mentor
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowExtendPrompt(false)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Weekly goal card */}
        {currentWeekNumber && pillarGoals.length > 0 && (
          <WeeklyGoalCard
            weekNumber={currentWeekNumber}
            pillarGoals={pillarGoals}
          />
        )}

        {/* Daily task list (primers now rendered inline per pillar) */}
        <DailyTaskList
          blocks={currentBlocks || []}
          tasks={tasks || []}
          pillars={(pillars || []).map((p) => ({ id: p.id, name: p.name }))}
          onToggleTask={handleToggleTask}
        />

        {/* Mistake journal (interview prep only) */}
        {viewMode === "interview_prep" && userId && (
          <MistakeJournalDisplay userId={userId} />
        )}

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

export default Dashboard;
