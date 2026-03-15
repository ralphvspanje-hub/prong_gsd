import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

// --- Shared helpers ---

async function getActivePlan(supabase: any, userId: string) {
  const { data } = await supabase
    .from("learning_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data;
}

async function getCurrentWeek(supabase: any, planId: string): Promise<number | null> {
  const { data } = await supabase
    .from("plan_blocks")
    .select("week_number")
    .eq("plan_id", planId)
    .eq("is_completed", false)
    .order("week_number")
    .limit(1);
  return data?.[0]?.week_number ?? null;
}

async function cleanupFutureBlocks(
  supabase: any,
  planId: string,
  afterWeek: number,
  pillarIdFilter?: string
): Promise<number> {
  // Find uncompleted future blocks
  let blockQuery = supabase
    .from("plan_blocks")
    .select("id")
    .eq("plan_id", planId)
    .eq("is_completed", false)
    .gt("week_number", afterWeek);
  if (pillarIdFilter) {
    blockQuery = blockQuery.eq("pillar_id", pillarIdFilter);
  }
  const { data: blocks } = await blockQuery;
  if (!blocks || blocks.length === 0) return 0;

  const blockIds = blocks.map((b: any) => b.id);

  // Delete tasks first (RLS-safe, no cascade dependency)
  await supabase.from("plan_tasks").delete().in("plan_block_id", blockIds);
  // Then delete the blocks
  await supabase.from("plan_blocks").delete().in("id", blockIds);

  return blockIds.length;
}

function updateOutlinePillar(
  outline: any,
  action: "add" | "remove",
  pillarName: string,
  pillarId: string,
  currentWeek: number | null
) {
  if (!outline?.weeks) return outline;
  const afterWeek = currentWeek ?? 0;
  const updatedWeeks = outline.weeks.map((w: any) => {
    if (w.week_number <= afterWeek) return w;
    if (action === "add") {
      const alreadyHas = w.pillars.some(
        (p: any) => p.pillar_id === pillarId || p.pillar_name === pillarName
      );
      if (!alreadyHas) {
        return {
          ...w,
          pillars: [
            ...w.pillars,
            { pillar_id: pillarId, pillar_name: pillarName, weekly_goal: `${pillarName} tasks`, difficulty: 1 },
          ],
        };
      }
    } else if (action === "remove") {
      return {
        ...w,
        pillars: w.pillars.filter(
          (p: any) => p.pillar_id !== pillarId && p.pillar_name !== pillarName
        ),
      };
    }
    return w;
  });
  return { ...outline, weeks: updatedWeeks };
}

// --- Main handler ---

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { action, changes } = await req.json();

    // --- full_recalibration ---
    if (action === "full_recalibration") {
      return new Response(
        JSON.stringify({ success: true, redirect: "/onboarding" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- add_pillar ---
    if (action === "add_pillar") {
      const c = changes;
      const { data: existingPillars } = await supabase
        .from("pillars")
        .select("sort_order")
        .eq("user_id", userId)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existingPillars?.[0]?.sort_order ?? -1) + 1;

      const { data: pillarData, error: pillarError } = await supabase
        .from("pillars")
        .insert({
          user_id: userId,
          name: c.name,
          description: c.description,
          why_it_matters: c.why_it_matters,
          starting_level: c.starting_level || 1,
          current_level: c.starting_level || 1,
          phase_weight: c.phase_weight || 0,
          sort_order: nextOrder,
        })
        .select()
        .single();
      if (pillarError) throw pillarError;

      // Add topic clusters
      if (c.topic_clusters && pillarData) {
        for (let i = 0; i < c.topic_clusters.length; i++) {
          const tc = c.topic_clusters[i];
          await supabase.from("topic_map").insert({
            pillar_id: pillarData.id,
            cluster_name: tc.cluster_name,
            subtopics: tc.subtopics || [],
            priority_order: i,
          });
        }
      }

      // Plan cleanup: add pillar to future weeks and regenerate blocks
      const plan = await getActivePlan(supabase, userId);
      if (plan && pillarData) {
        const currentWeek = await getCurrentWeek(supabase, plan.id);
        const updatedOutline = updateOutlinePillar(
          plan.plan_outline,
          "add",
          c.name,
          pillarData.id,
          currentWeek
        );
        await supabase
          .from("learning_plans")
          .update({ plan_outline: updatedOutline, updated_at: new Date().toISOString() })
          .eq("id", plan.id);
        await cleanupFutureBlocks(supabase, plan.id, currentWeek ?? 0);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- delete_pillar ---
    if (action === "delete_pillar") {
      const pillarId = changes.pillar_id;

      // Get pillar name before deleting (for outline cleanup)
      const { data: pillarData } = await supabase
        .from("pillars")
        .select("name")
        .eq("id", pillarId)
        .maybeSingle();
      const pillarName = pillarData?.name || "";

      // Original cascade deletes
      await supabase.from("topic_map").delete().eq("pillar_id", pillarId);
      await supabase.from("phase_weights").delete().eq("pillar_id", pillarId);

      // Plan cleanup: remove pillar's blocks and update outline
      const plan = await getActivePlan(supabase, userId);
      if (plan) {
        const currentWeek = await getCurrentWeek(supabase, plan.id);

        // Delete uncompleted blocks for this pillar (any week)
        const { data: pillarBlocks } = await supabase
          .from("plan_blocks")
          .select("id")
          .eq("plan_id", plan.id)
          .eq("pillar_id", pillarId)
          .eq("is_completed", false);
        if (pillarBlocks && pillarBlocks.length > 0) {
          const blockIds = pillarBlocks.map((b: any) => b.id);
          await supabase.from("plan_tasks").delete().in("plan_block_id", blockIds);
          await supabase.from("plan_blocks").delete().in("id", blockIds);
        }

        // Update outline to remove pillar from future weeks
        const updatedOutline = updateOutlinePillar(
          plan.plan_outline,
          "remove",
          pillarName,
          pillarId,
          currentWeek
        );
        await supabase
          .from("learning_plans")
          .update({ plan_outline: updatedOutline, updated_at: new Date().toISOString() })
          .eq("id", plan.id);
      }

      // Delete the pillar itself
      await supabase.from("pillars").delete().eq("id", pillarId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- edit_pillar ---
    if (action === "edit_pillar") {
      const { pillar_id, fields_to_update } = changes;
      const allowedFields = ["name", "description", "why_it_matters", "phase_weight"];
      const updateObj: Record<string, any> = {};
      for (const [key, val] of Object.entries(fields_to_update)) {
        if (allowedFields.includes(key)) {
          updateObj[key] = val;
        }
      }
      if (Object.keys(updateObj).length > 0) {
        await supabase.from("pillars").update(updateObj).eq("id", pillar_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- swap_pillar ---
    if (action === "swap_pillar") {
      const removeId = changes.remove_pillar_id;

      // Get old pillar name
      const { data: oldPillar } = await supabase
        .from("pillars")
        .select("name")
        .eq("id", removeId)
        .maybeSingle();
      const oldPillarName = oldPillar?.name || "";

      // Delete old pillar dependencies
      await supabase.from("topic_map").delete().eq("pillar_id", removeId);
      await supabase.from("phase_weights").delete().eq("pillar_id", removeId);

      // Plan cleanup for old pillar
      const plan = await getActivePlan(supabase, userId);
      if (plan) {
        const { data: pillarBlocks } = await supabase
          .from("plan_blocks")
          .select("id")
          .eq("plan_id", plan.id)
          .eq("pillar_id", removeId)
          .eq("is_completed", false);
        if (pillarBlocks && pillarBlocks.length > 0) {
          const blockIds = pillarBlocks.map((b: any) => b.id);
          await supabase.from("plan_tasks").delete().in("plan_block_id", blockIds);
          await supabase.from("plan_blocks").delete().in("id", blockIds);
        }
      }

      // Delete old pillar
      await supabase.from("pillars").delete().eq("id", removeId);

      // Add new pillar
      const c = changes.add;
      const { data: existingPillars } = await supabase
        .from("pillars")
        .select("sort_order")
        .eq("user_id", userId)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existingPillars?.[0]?.sort_order ?? -1) + 1;

      const { data: pillarData } = await supabase
        .from("pillars")
        .insert({
          user_id: userId,
          name: c.name,
          description: c.description,
          why_it_matters: c.why_it_matters,
          starting_level: c.starting_level || 1,
          current_level: c.starting_level || 1,
          phase_weight: c.phase_weight || 0,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (c.topic_clusters && pillarData) {
        for (let i = 0; i < c.topic_clusters.length; i++) {
          const tc = c.topic_clusters[i];
          await supabase.from("topic_map").insert({
            pillar_id: pillarData.id,
            cluster_name: tc.cluster_name,
            subtopics: tc.subtopics || [],
            priority_order: i,
          });
        }
      }

      // Update plan outline: remove old pillar, add new one, cleanup future blocks
      if (plan && pillarData) {
        const currentWeek = await getCurrentWeek(supabase, plan.id);
        let updatedOutline = updateOutlinePillar(
          plan.plan_outline,
          "remove",
          oldPillarName,
          removeId,
          currentWeek
        );
        updatedOutline = updateOutlinePillar(
          updatedOutline,
          "add",
          c.name,
          pillarData.id,
          currentWeek
        );
        await supabase
          .from("learning_plans")
          .update({ plan_outline: updatedOutline, updated_at: new Date().toISOString() })
          .eq("id", plan.id);
        await cleanupFutureBlocks(supabase, plan.id, currentWeek ?? 0);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- change_level ---
    if (action === "change_level") {
      const { pillar_id, new_level } = changes;
      const clamped = Math.max(1, Math.min(5, new_level));
      await supabase
        .from("pillars")
        .update({ current_level: clamped, blocks_completed_at_level: 0 })
        .eq("id", pillar_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- adjust_pacing ---
    if (action === "adjust_pacing") {
      const validPacing = ["aggressive", "steady", "exploratory"];
      if (!validPacing.includes(changes.new_pacing)) {
        return new Response(
          JSON.stringify({ error: "Invalid pacing profile: " + changes.new_pacing }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await Promise.all([
        supabase
          .from("user_profile")
          .update({ pacing_profile: changes.new_pacing })
          .eq("user_id", userId),
        supabase
          .from("learning_plans")
          .update({ pacing_profile: changes.new_pacing, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- restructure_plan ---
    if (action === "restructure_plan") {
      const { plan_id, updated_outline_weeks } = changes;
      if (!plan_id || !Array.isArray(updated_outline_weeks)) {
        return new Response(
          JSON.stringify({ error: "restructure_plan requires plan_id and updated_outline_weeks array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: plan } = await supabase
        .from("learning_plans")
        .select("*")
        .eq("id", plan_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!plan) {
        return new Response(
          JSON.stringify({ error: "Active plan not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const currentWeek = await getCurrentWeek(supabase, plan_id);
      const afterWeek = currentWeek ?? 0;

      // Validate all provided weeks are future
      const invalidWeeks = updated_outline_weeks.filter((w: any) => w.week_number <= afterWeek);
      if (invalidWeeks.length > 0) {
        return new Response(
          JSON.stringify({ error: "Cannot modify past or current weeks" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build new outline: keep past/current weeks, replace future
      const outline = plan.plan_outline as any;
      const keptWeeks = (outline?.weeks || []).filter(
        (w: any) => w.week_number <= afterWeek
      );
      const newOutline = {
        ...outline,
        weeks: [...keptWeeks, ...updated_outline_weeks].sort(
          (a: any, b: any) => a.week_number - b.week_number
        ),
        total_weeks: Math.max(
          keptWeeks.length > 0 ? Math.max(...keptWeeks.map((w: any) => w.week_number)) : 0,
          updated_outline_weeks.length > 0
            ? Math.max(...updated_outline_weeks.map((w: any) => w.week_number))
            : 0
        ),
      };

      await supabase
        .from("learning_plans")
        .update({
          plan_outline: newOutline,
          total_weeks: newOutline.total_weeks,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plan_id);

      const deleted = await cleanupFutureBlocks(supabase, plan_id, afterWeek);

      return new Response(
        JSON.stringify({ success: true, deleted_blocks: deleted }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- swap_resource ---
    if (action === "swap_resource") {
      const { task_id } = changes;
      if (!task_id) {
        return new Response(
          JSON.stringify({ error: "swap_resource requires task_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch task and verify it's not completed
      const { data: task } = await supabase
        .from("plan_tasks")
        .select("is_completed")
        .eq("id", task_id)
        .maybeSingle();
      if (!task) {
        return new Response(
          JSON.stringify({ error: "Task not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (task.is_completed) {
        return new Response(
          JSON.stringify({ error: "Cannot swap a completed task" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Whitelist update fields
      const allowedTaskFields = [
        "action",
        "platform",
        "resource_type",
        "url",
        "search_query",
        "why_text",
        "estimated_time_minutes",
      ];
      const updateObj: Record<string, any> = {};
      for (const key of allowedTaskFields) {
        const newKey = key === "action" ? "new_action" : `new_${key}`;
        if (changes[newKey] !== undefined) {
          updateObj[key] = changes[newKey];
        }
      }

      if (Object.keys(updateObj).length > 0) {
        await supabase.from("plan_tasks").update(updateObj).eq("id", task_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- regenerate_upcoming ---
    if (action === "regenerate_upcoming") {
      const planId = changes.plan_id;
      if (!planId) {
        return new Response(
          JSON.stringify({ error: "regenerate_upcoming requires plan_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const currentWeek = await getCurrentWeek(supabase, planId);
      const deleted = await cleanupFutureBlocks(supabase, planId, currentWeek ?? 0);

      return new Response(
        JSON.stringify({ success: true, deleted_blocks: deleted }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Unknown action ---
    return new Response(
      JSON.stringify({ error: "Unknown action: " + action }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error(err); // full error + stack visible in Supabase function logs
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
