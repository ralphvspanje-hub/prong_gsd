import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { BlockCard } from "@/components/history/BlockCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type PlanBlock = Tables<"plan_blocks">;
type PlanTask = Tables<"plan_tasks">;

const History = () => {
  const { user } = useAuth();
  const userId = user?.id;

  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("all");

  // Determine which plan type to show based on dashboard view mode
  const planType =
    (localStorage.getItem("pronggsd-dashboard-view") as
      | "learning"
      | "interview_prep") || "learning";
  const activeCrashPlanId = localStorage.getItem(
    "pronggsd-active-crashcourse-id",
  );
  const isCrashCourse = planType === "interview_prep";

  // Active plan (to scope blocks)
  const { data: activePlan } = useQuery({
    queryKey: ["active-plan-for-history", userId, planType, activeCrashPlanId],
    queryFn: async () => {
      let query = supabase
        .from("learning_plans")
        .select("id")
        .eq("user_id", userId!)
        .eq("is_active", true);

      if (isCrashCourse && activeCrashPlanId) {
        query = query.eq("id", activeCrashPlanId);
      } else {
        query = query.eq("plan_type", planType);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Pillars (for filter dropdown + name lookup, scoped by plan type)
  const { data: pillars = [] } = useQuery({
    queryKey: ["pillars", userId, isCrashCourse],
    queryFn: async () => {
      let query = supabase
        .from("pillars")
        .select("id, name")
        .eq("user_id", userId!)
        .eq("is_active", true);

      if (isCrashCourse) {
        query = query.gte("sort_order", 100);
      } else {
        query = query.lt("sort_order", 100);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Plan blocks scoped to active plan
  const { data: allBlocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: ["plan-blocks-history", activePlan?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_blocks")
        .select("*")
        .eq("plan_id", activePlan!.id)
        .order("completed_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as PlanBlock[];
    },
    enabled: !!activePlan?.id,
  });

  // All tasks for those blocks
  const blockIds = useMemo(() => allBlocks.map((b) => b.id), [allBlocks]);

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["plan-tasks-history", blockIds],
    queryFn: async () => {
      if (blockIds.length === 0) return [] as PlanTask[];
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

  // Build pillar name map
  const pillarNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pillars) m.set(p.id, p.name);
    return m;
  }, [pillars]);

  // Build task map: block_id → tasks
  const tasksByBlock = useMemo(() => {
    const m = new Map<string, PlanTask[]>();
    for (const t of allTasks) {
      if (!m.has(t.plan_block_id)) m.set(t.plan_block_id, []);
      m.get(t.plan_block_id)!.push(t);
    }
    return m;
  }, [allTasks]);

  // Available week numbers for filter
  const availableWeeks = useMemo(() => {
    const weeks = [...new Set(allBlocks.map((b) => b.week_number))].sort(
      (a, b) => a - b,
    );
    return weeks;
  }, [allBlocks]);

  // Filter blocks
  const filteredBlocks = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return allBlocks.filter((b) => {
      // Pillar filter
      if (pillarFilter !== "all" && b.pillar_id !== pillarFilter) return false;
      // Week filter
      if (weekFilter !== "all" && b.week_number !== Number(weekFilter))
        return false;
      // Search filter — match block title, weekly_goal, or any task action
      if (lowerSearch) {
        const blockMatch =
          b.title.toLowerCase().includes(lowerSearch) ||
          b.weekly_goal.toLowerCase().includes(lowerSearch);
        const blockTasks = tasksByBlock.get(b.id) || [];
        const taskMatch = blockTasks.some((t) =>
          t.action.toLowerCase().includes(lowerSearch),
        );
        if (!blockMatch && !taskMatch) return false;
      }
      return true;
    });
  }, [allBlocks, pillarFilter, weekFilter, search, tasksByBlock]);

  // Sort: completed first (most recent), then incomplete
  const sortedBlocks = useMemo(() => {
    return [...filteredBlocks].sort((a, b) => {
      if (a.is_completed && !b.is_completed) return -1;
      if (!a.is_completed && b.is_completed) return 1;
      // Both completed: sort by completed_at desc
      if (a.completed_at && b.completed_at)
        return (
          new Date(b.completed_at).getTime() -
          new Date(a.completed_at).getTime()
        );
      // Both incomplete: sort by week_number
      return a.week_number - b.week_number;
    });
  }, [filteredBlocks]);

  const loading = blocksLoading || tasksLoading;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="font-serif text-2xl font-bold">History</h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blocks & tasks..."
              className="pl-9"
            />
          </div>
          <Select value={pillarFilter} onValueChange={setPillarFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Pillar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pillars</SelectItem>
              {pillars.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={weekFilter} onValueChange={setWeekFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Weeks</SelectItem>
              {availableWeeks.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Week {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Block list */}
        <div className="space-y-2">
          {sortedBlocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              tasks={tasksByBlock.get(block.id) || []}
              pillarName={pillarNameMap.get(block.pillar_id) || "Unknown"}
            />
          ))}
          {sortedBlocks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {allBlocks.length === 0
                ? "No plan blocks yet. Start learning from the dashboard!"
                : "No matches found."}
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default History;
