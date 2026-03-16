import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { ProgressSummaryCards } from "@/components/progress/ProgressSummaryCards";
import { ActivitySection } from "@/components/progress/ActivitySection";
import { WeeklyCompletionChart } from "@/components/progress/WeeklyCompletionChart";
import { PillarLevelCards } from "@/components/progress/PillarLevelCards";
import { PillarCompletionChart } from "@/components/progress/PillarCompletionChart";
import { PlanSummaryStrip } from "@/components/progress/PlanSummaryStrip";
import { Loader2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type LearningPlan = Tables<"learning_plans">;
type PlanBlock = Tables<"plan_blocks">;
type PlanTask = Tables<"plan_tasks">;
type UserProgress = Tables<"user_progress">;
type Pillar = Tables<"pillars">;

interface PlanOutline {
  total_weeks: number;
  weeks: {
    week_number: number;
    pillars: { pillar_name: string; weekly_goal: string }[];
  }[];
}

const Progress = () => {
  const { user } = useAuth();
  const userId = user?.id;

  // Determine which plan type to show based on dashboard view mode
  const planType =
    (localStorage.getItem("pronggsd-dashboard-view") as
      | "learning"
      | "interview_prep") || "learning";
  const activeCrashPlanId = localStorage.getItem(
    "pronggsd-active-crashcourse-id",
  );
  const isCrashCourse = planType === "interview_prep";

  // Active plan (scoped by plan_type, and specific crash course ID if available)
  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["learning-plan", userId, planType, activeCrashPlanId],
    queryFn: async () => {
      let query = supabase
        .from("learning_plans")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_active", true);

      if (isCrashCourse && activeCrashPlanId) {
        query = query.eq("id", activeCrashPlanId);
      } else {
        query = query.eq("plan_type", planType);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as LearningPlan | null;
    },
    enabled: !!userId,
  });

  // Pillars (crash course pillars use sort_order >= 100)
  const { data: pillars = [], isLoading: pillarsLoading } = useQuery({
    queryKey: ["pillars", userId, isCrashCourse],
    queryFn: async () => {
      let query = supabase
        .from("pillars")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_active", true);

      if (isCrashCourse) {
        query = query.gte("sort_order", 100);
      } else {
        query = query.lt("sort_order", 100);
      }

      const { data, error } = await query.order("sort_order");
      if (error) throw error;
      return (data || []) as Pillar[];
    },
    enabled: !!userId,
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

  // All plan blocks
  const { data: allBlocks = [] } = useQuery({
    queryKey: ["plan-blocks-all", plan?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_blocks")
        .select("*")
        .eq("plan_id", plan!.id);
      if (error) throw error;
      return (data || []) as PlanBlock[];
    },
    enabled: !!plan?.id,
  });

  // All tasks for this plan (for charts)
  const blockIds = useMemo(() => allBlocks.map((b) => b.id), [allBlocks]);

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["completed-tasks-progress", plan?.id],
    queryFn: async () => {
      // Supabase .in() has a limit, batch if needed
      if (blockIds.length === 0) return [] as PlanTask[];
      const { data, error } = await supabase
        .from("plan_tasks")
        .select("*")
        .in("plan_block_id", blockIds);
      if (error) throw error;
      return (data || []) as PlanTask[];
    },
    enabled: blockIds.length > 0,
  });

  // Derived
  const outline = plan?.plan_outline as unknown as PlanOutline | null;

  const completedBlocks = useMemo(
    () => allBlocks.filter((b) => b.is_completed).length,
    [allBlocks],
  );

  const planCompletionPercent = useMemo(() => {
    if (allBlocks.length === 0) return 0;
    return Math.round((completedBlocks / allBlocks.length) * 100);
  }, [completedBlocks, allBlocks]);

  const completedTasks = useMemo(
    () => allTasks.filter((t) => t.is_completed),
    [allTasks],
  );

  const loading = planLoading || pillarsLoading || tasksLoading;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  // No plan — show minimal state
  if (!plan || !outline) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto space-y-8">
          <h1 className="font-serif text-2xl font-bold">Progress</h1>
          <p className="text-sm text-muted-foreground text-center py-8">
            No active plan yet. Complete onboarding to start tracking your
            progress.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="font-serif text-2xl font-bold">Progress</h1>

        {/* A. Summary stats */}
        <ProgressSummaryCards
          totalTasksCompleted={progress?.total_tasks_completed ?? 0}
          currentStreak={progress?.current_streak ?? 0}
          longestStreak={progress?.longest_streak ?? 0}
          currentDay={progress?.current_day ?? 0}
          planCompletionPercent={planCompletionPercent}
        />

        {/* B. Big streak + Activity heatmap */}
        <ActivitySection
          progress={progress || null}
          completedTasks={completedTasks}
        />

        {/* C. Weekly completion chart */}
        <WeeklyCompletionChart
          tasks={allTasks}
          blocks={allBlocks}
          planFormat={(plan as any).plan_format}
        />

        {/* D. Pillar levels snapshot */}
        <PillarLevelCards pillars={pillars} />

        {/* E. Completion by pillar */}
        <PillarCompletionChart
          tasks={allTasks}
          blocks={allBlocks}
          pillars={pillars.map((p) => ({ id: p.id, name: p.name }))}
        />

        {/* F. Compact plan summary */}
        <PlanSummaryStrip
          planOutline={outline}
          pacingProfile={plan.pacing_profile}
          allBlocks={allBlocks.map((b) => ({
            week_number: b.week_number,
            is_completed: b.is_completed,
          }))}
          planFormat={(plan as any).plan_format}
        />
      </div>
    </Layout>
  );
};

export default Progress;
