import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  BookOpen,
  Plus,
  ArrowRight,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type LearningPlan = Tables<"learning_plans">;

const MAX_CRASH_COURSES = 3;

// ---------------------------------------------------------------------------
// CrashCourseSelector — type picker + active crash course list at /crash-course
// ---------------------------------------------------------------------------

const CrashCourseSelector = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;

  // Fetch all active crash course plans
  const { data: crashPlans, isLoading } = useQuery({
    queryKey: ["crash-course-plans", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_plans")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .eq("plan_type", "interview_prep")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LearningPlan[];
    },
    enabled: !!userId,
  });

  // Fetch pillars for plan name display
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

  // Fetch completed task counts per plan for progress display
  const planIds = (crashPlans || []).map((p) => p.id);
  const { data: blockStats } = useQuery({
    queryKey: ["crash-course-block-stats", planIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_blocks")
        .select("plan_id, is_completed")
        .in("plan_id", planIds);
      if (error) throw error;
      return data || [];
    },
    enabled: planIds.length > 0,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4 py-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Layout>
    );
  }

  const hasActivePlans = (crashPlans?.length ?? 0) > 0;
  const canStartNew = (crashPlans?.length ?? 0) < MAX_CRASH_COURSES;

  // Derive a display name for each crash course plan
  const getPlanLabel = (plan: LearningPlan) => {
    const outline = plan.plan_outline as any;
    const topic = outline?.crashcourse_topic;
    if (topic) return topic;
    if (plan.crashcourse_type === "interview") return "Interview Prep";
    return "Crash Course";
  };

  const getPlanProgress = (planId: string) => {
    if (!blockStats) return null;
    const blocks = blockStats.filter((b) => b.plan_id === planId);
    if (blocks.length === 0) return null;
    const done = blocks.filter((b) => b.is_completed).length;
    return { done, total: blocks.length };
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8 py-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl font-bold">Crash Courses</h1>
          <p className="text-muted-foreground">
            {hasActivePlans
              ? "Your active crash courses and options to start a new one."
              : "Intensive short-term prep for interviews, exams, or anything urgent."}
          </p>
        </div>

        {/* Active crash courses */}
        {hasActivePlans && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Active Crash Courses
            </h2>
            <div className="grid gap-3">
              {crashPlans!.map((plan) => {
                const progress = getPlanProgress(plan.id);
                const isInterview = plan.crashcourse_type === "interview";
                return (
                  <Card
                    key={plan.id}
                    className="cursor-pointer hover:border-orange-500/50 transition-colors"
                    onClick={() => navigate(`/crash-course/${plan.id}`)}
                  >
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                        {isInterview ? (
                          <Target className="h-5 w-5 text-orange-500" />
                        ) : (
                          <Zap className="h-5 w-5 text-orange-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {getPlanLabel(plan)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400"
                          >
                            {isInterview ? "Interview" : "Crash Course"}
                          </Badge>
                          {progress && (
                            <span className="text-xs text-muted-foreground">
                              {progress.done}/{progress.total} blocks done
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Type selector cards */}
        <section className="space-y-3">
          {hasActivePlans && (
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Start a New Crash Course
            </h2>
          )}

          {canStartNew ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Job Interview Prep */}
              <Card
                className="cursor-pointer hover:border-orange-500/50 transition-colors group"
                onClick={() => navigate("/interview-onboarding")}
              >
                <CardContent className="pt-6 pb-5 space-y-3 text-center">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto group-hover:bg-orange-500/20 transition-colors">
                    <Target className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-serif font-semibold text-lg">
                      Job Interview Prep
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Land your next role with a targeted crash course
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Something Else */}
              <Card
                className="cursor-pointer hover:border-orange-500/50 transition-colors group"
                onClick={() => navigate("/crashcourse-onboarding")}
              >
                <CardContent className="pt-6 pb-5 space-y-3 text-center">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto group-hover:bg-orange-500/20 transition-colors">
                    <BookOpen className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-serif font-semibold text-lg">
                      Something Else
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      English test, certification exam, coding bootcamp, or
                      anything urgent
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              You've reached the maximum of {MAX_CRASH_COURSES} concurrent crash
              courses. Complete or remove one to start a new one.
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default CrashCourseSelector;
