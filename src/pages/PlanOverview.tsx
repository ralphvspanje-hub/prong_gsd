import { useMemo } from "react";
import { Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Check, Play, Circle } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LearningPlan = Tables<"learning_plans">;

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

const PACING_LABELS: Record<string, string> = {
  aggressive: "Aggressive",
  steady: "Steady",
  exploratory: "Exploratory",
};

const PACING_COLORS: Record<string, string> = {
  aggressive: "bg-red-500/10 text-red-500 border-red-500/20",
  steady: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  exploratory: "bg-green-500/10 text-green-500 border-green-500/20",
};

// ---------------------------------------------------------------------------
// PlanOverview
// ---------------------------------------------------------------------------

const PlanOverview = () => {
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

  // All plan blocks (to determine completion status per week)
  const { data: allBlocks } = useQuery({
    queryKey: ["plan-blocks-all", plan?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_blocks")
        .select("week_number, is_completed, pillar_id")
        .eq("plan_id", plan!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!plan?.id,
  });

  // Build week status map: completed / current / future
  const weekStatuses = useMemo(() => {
    if (!allBlocks)
      return new Map<number, "completed" | "current" | "future">();
    const statusMap = new Map<number, "completed" | "current" | "future">();
    const weekBlocks = new Map<number, boolean[]>();

    for (const block of allBlocks) {
      if (!weekBlocks.has(block.week_number))
        weekBlocks.set(block.week_number, []);
      weekBlocks.get(block.week_number)!.push(block.is_completed);
    }

    let foundCurrent = false;
    // Sort weeks and determine status
    const sortedWeeks = [...weekBlocks.keys()].sort((a, b) => a - b);
    for (const week of sortedWeeks) {
      const completions = weekBlocks.get(week)!;
      const allDone = completions.every(Boolean);
      if (allDone) {
        statusMap.set(week, "completed");
      } else if (!foundCurrent) {
        statusMap.set(week, "current");
        foundCurrent = true;
      } else {
        statusMap.set(week, "future");
      }
    }

    return statusMap;
  }, [allBlocks]);

  // No-plan redirect — crash course goes back to selector, learning to context upload
  if (!planLoading && !plan && userId) {
    return (
      <Navigate
        to={isCrashCourse ? "/crash-course" : "/context-upload"}
        replace
      />
    );
  }

  if (planLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4 py-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Layout>
    );
  }

  if (!plan)
    return (
      <Navigate
        to={isCrashCourse ? "/crash-course" : "/context-upload"}
        replace
      />
    );

  const outline = plan.plan_outline as unknown as PlanOutline;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Link
              to={
                isCrashCourse && activeCrashPlanId
                  ? `/crash-course/${activeCrashPlanId}`
                  : "/dashboard"
              }
            >
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 -ml-2 mb-1 text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />{" "}
                {isCrashCourse ? "Back to Prep" : "Back to Today"}
              </Button>
            </Link>
            <h1 className="font-serif text-2xl font-bold">
              {planType === "interview_prep" ? "Interview Prep" : "Your"}{" "}
              {outline.total_weeks}-Week Plan
            </h1>
          </div>
          <Badge
            variant="outline"
            className={PACING_COLORS[plan.pacing_profile] || ""}
          >
            {PACING_LABELS[plan.pacing_profile] || plan.pacing_profile}
          </Badge>
        </div>

        {/* Timeline */}
        <ScrollArea className="h-[calc(100vh-14rem)]">
          <div className="space-y-3 pr-4">
            {outline.weeks.map((week) => {
              const status = weekStatuses.get(week.week_number) || "future";
              const isCompleted = status === "completed";
              const isCurrent = status === "current";

              return (
                <Card
                  key={week.week_number}
                  className={`border-border transition-colors ${
                    isCurrent ? "border-accent/50" : ""
                  } ${isCompleted ? "opacity-60" : ""}`}
                >
                  <CardContent className="py-4 space-y-2">
                    {/* Week header */}
                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      {isCurrent && (
                        <Play className="h-4 w-4 text-accent fill-accent" />
                      )}
                      {status === "future" && (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}

                      <span className="text-sm font-serif font-medium">
                        Week {week.week_number}
                      </span>

                      {isCurrent && (
                        <Badge variant="secondary" className="text-[10px]">
                          Current
                        </Badge>
                      )}
                    </div>

                    {/* Pillar goals */}
                    {week.pillars.map((wp, i) => (
                      <div key={i} className="flex items-start gap-2 pl-6">
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent/60 shrink-0" />
                        <p className="text-sm">
                          <span className="font-medium">{wp.pillar_name}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            — {wp.weekly_goal}
                          </span>
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </Layout>
  );
};

export default PlanOverview;
