import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Layout } from "@/components/Layout";

// ---------------------------------------------------------------------------
// InterviewDashboard — backwards-compat redirect to /crash-course/:planId
// Finds the active interview_prep plan and redirects there.
// ---------------------------------------------------------------------------

const InterviewDashboard = () => {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: interviewPlan, isLoading } = useQuery({
    queryKey: ["interview-plan-redirect", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_plans")
        .select("id")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .eq("plan_type", "interview_prep")
        .eq("crashcourse_type", "interview")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4 py-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Layout>
    );
  }

  if (interviewPlan) {
    return <Navigate to={`/crash-course/${interviewPlan.id}`} replace />;
  }

  // No interview plan — go to main dashboard
  return <Navigate to="/dashboard" replace />;
};

export default InterviewDashboard;
