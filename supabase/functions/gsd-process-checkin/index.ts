import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// ---------------------------------------------------------------------------
// Constants (configurable leveling thresholds)
// ---------------------------------------------------------------------------

/** Blocks needed at current level to trigger a level-up. */
const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 2, // L1 → L2
  2: 2, // L2 → L3
  3: 3, // L3 → L4
  4: 3, // L4 → L5
};

const CHECKIN_RATE_LIMIT = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let corsHeaders: Record<string, string> = {};

function jsonRes(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Return yesterday's date as YYYY-MM-DD in UTC. */
function getYesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// handleTaskComplete
// ---------------------------------------------------------------------------

async function handleTaskComplete(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  taskId: string,
): Promise<Response> {
  // 1. Verify task exists, belongs to user, and is completed
  const { data: task, error: taskErr } = await supabase
    .from("plan_tasks")
    .select("id, plan_block_id, is_completed")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskErr || !task) {
    return jsonRes({ error: "Task not found" }, 404);
  }
  if (!task.is_completed) {
    // Frontend hasn't written the completion yet (race), just return success
    return jsonRes({ success: true, no_op: true });
  }

  // 2. Authoritative streak update
  const { data: progress } = await supabaseAdmin
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!progress) {
    return jsonRes({ error: "No user_progress record found" }, 404);
  }

  const today = todayUTC();
  const yesterday = getYesterdayUTC();
  let gapReturn = false;

  if (progress.last_activity_date === today) {
    // Same day — just increment total_tasks_completed
    await supabaseAdmin
      .from("user_progress")
      .update({
        total_tasks_completed: progress.total_tasks_completed + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else if (progress.last_activity_date === yesterday) {
    // Consecutive day — extend streak
    const newStreak = progress.current_streak + 1;
    await supabaseAdmin
      .from("user_progress")
      .update({
        current_day: progress.current_day + 1,
        current_streak: newStreak,
        longest_streak: Math.max(progress.longest_streak, newStreak),
        last_activity_date: today,
        total_tasks_completed: progress.total_tasks_completed + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    // Gap — reset streak to 1
    gapReturn = !progress.last_activity_date ? false : true;
    await supabaseAdmin
      .from("user_progress")
      .update({
        current_day: progress.current_day + 1,
        current_streak: 1,
        longest_streak: Math.max(progress.longest_streak, 1),
        last_activity_date: today,
        total_tasks_completed: progress.total_tasks_completed + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  // Read back authoritative values
  const { data: updatedProgress } = await supabaseAdmin
    .from("user_progress")
    .select("current_day, current_streak, longest_streak, total_tasks_completed")
    .eq("user_id", userId)
    .single();

  // 3. Pacing detection
  const { data: block } = await supabase
    .from("plan_blocks")
    .select("id, created_at, pacing_note")
    .eq("id", task.plan_block_id)
    .maybeSingle();

  let pacingNote: string | null = null;

  if (block) {
    const daysElapsed = Math.floor(
      (Date.now() - new Date(block.created_at).getTime()) / 86_400_000,
    );

    // Count completed vs total tasks for this block
    const { data: blockTasks } = await supabase
      .from("plan_tasks")
      .select("id, is_completed")
      .eq("plan_block_id", block.id);

    if (blockTasks && blockTasks.length > 0) {
      const total = blockTasks.length;
      const completed = blockTasks.filter((t: any) => t.is_completed).length;
      const expected = Math.min(daysElapsed / 7, 1);
      const actual = completed / total;

      if (actual > expected + 0.3) {
        pacingNote = "You're ahead of schedule — nice work!";
      } else if (actual < expected - 0.3 && daysElapsed >= 2) {
        const remaining = total - completed;
        pacingNote = `A bit behind this week — ${remaining} task${remaining === 1 ? "" : "s"} remaining. An extra session tomorrow will catch you up.`;
      }

      // Write pacing note to the block if changed
      if (pacingNote !== block.pacing_note) {
        await supabaseAdmin
          .from("plan_blocks")
          .update({ pacing_note: pacingNote })
          .eq("id", block.id);
      }
    }
  }

  // 4. Block completion check — did this task complete the block?
  let blockAutoComplete = false;
  let completedBlockId: string | null = null;

  if (block) {
    const { data: blockTasks } = await supabase
      .from("plan_tasks")
      .select("id, is_completed")
      .eq("plan_block_id", block.id);

    if (blockTasks && blockTasks.length > 0) {
      const allDone = blockTasks.every((t: any) => t.is_completed);
      if (allDone) {
        blockAutoComplete = true;
        completedBlockId = block.id;
      }
    }
  }

  return jsonRes({
    success: true,
    streak: updatedProgress || {
      current_day: progress.current_day,
      current_streak: progress.current_streak,
      longest_streak: progress.longest_streak,
      total_tasks_completed: progress.total_tasks_completed,
    },
    pacing_note: pacingNote,
    block_auto_complete: blockAutoComplete,
    block_id: completedBlockId,
    gap_return: gapReturn,
  });
}

// ---------------------------------------------------------------------------
// handleBlockComplete
// ---------------------------------------------------------------------------

async function handleBlockComplete(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  blockId: string,
  difficulty: string | null,
  note: string | null,
): Promise<Response> {
  // 1. Verify block exists and belongs to user
  const { data: block, error: blockErr } = await supabase
    .from("plan_blocks")
    .select("id, plan_id, pillar_id, week_number, is_completed")
    .eq("id", blockId)
    .eq("user_id", userId)
    .maybeSingle();

  if (blockErr || !block) {
    return jsonRes({ error: "Plan block not found" }, 404);
  }

  // 2. Mark block completed + store feedback
  const feedback = difficulty ? { difficulty, note: note || "" } : null;
  await supabaseAdmin
    .from("plan_blocks")
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      checkin_feedback: feedback,
    })
    .eq("id", blockId);

  // 3. Pillar leveling
  let levelUp: { pillar_id: string; pillar_name: string; old_level: number; new_level: number } | null = null;

  const { data: pillar } = await supabase
    .from("pillars")
    .select("id, name, current_level, last_difficulty_signal, blocks_completed_at_level, trend")
    .eq("id", block.pillar_id)
    .maybeSingle();

  if (pillar && difficulty) {
    const currentLevel = pillar.current_level;
    const threshold = LEVEL_THRESHOLDS[currentLevel];
    const newBlockCount = (pillar.blocks_completed_at_level || 0) + 1;
    let newLevel = currentLevel;
    let newBlocksAtLevel = newBlockCount;
    let newSignal: string | null = difficulty;
    let newTrend = pillar.trend || "stable";

    // Acceleration: two consecutive "too_easy" → immediate level up
    if (
      difficulty === "too_easy" &&
      pillar.last_difficulty_signal === "too_easy" &&
      currentLevel < 5
    ) {
      newLevel = currentLevel + 1;
      newBlocksAtLevel = 0;
      newSignal = null;
      newTrend = "up";
    }
    // Deceleration: two consecutive "too_hard" → block level up, stay at level
    else if (
      difficulty === "too_hard" &&
      pillar.last_difficulty_signal === "too_hard"
    ) {
      // Do NOT level up even if threshold met. Reset signal.
      newSignal = null;
      newTrend = "stable";
    }
    // Normal threshold check
    else if (threshold && newBlockCount >= threshold && currentLevel < 5) {
      newLevel = currentLevel + 1;
      newBlocksAtLevel = 0;
      newSignal = null;
      newTrend = "up";
    }

    // Apply pillar update
    await supabaseAdmin
      .from("pillars")
      .update({
        current_level: newLevel,
        blocks_completed_at_level: newBlocksAtLevel,
        last_difficulty_signal: newSignal,
        trend: newTrend,
      })
      .eq("id", pillar.id);

    if (newLevel !== currentLevel) {
      levelUp = {
        pillar_id: pillar.id,
        pillar_name: pillar.name,
        old_level: currentLevel,
        new_level: newLevel,
      };
    }
  } else if (pillar && !difficulty) {
    // No feedback given — still increment block count
    await supabaseAdmin
      .from("pillars")
      .update({
        blocks_completed_at_level: (pillar.blocks_completed_at_level || 0) + 1,
      })
      .eq("id", pillar.id);
  }

  // 4. Difficulty adjustment signal for next block generation
  let difficultyAdjustment: "harder" | "easier" | "same" = "same";
  if (difficulty === "too_easy") difficultyAdjustment = "harder";
  else if (difficulty === "too_hard") difficultyAdjustment = "easier";

  // Build feedback context for AI
  const feedbackContext = difficulty
    ? `User rated last week "${difficulty}"${note ? `. Note: "${note}"` : ""}.`
    : null;

  // 5. Plan progression
  const { data: plan } = await supabase
    .from("learning_plans")
    .select("id, total_weeks, pacing_profile, plan_outline")
    .eq("id", block.plan_id)
    .maybeSingle();

  let planStatus: "in_progress" | "plan_complete" | "nearing_end" = "in_progress";
  let nextBlock: Record<string, unknown> | null = null;
  let planCompleteData: Record<string, unknown> | null = null;
  let nearingEnd = false;

  if (plan) {
    // Count remaining uncompleted blocks
    const { count: remainingCount } = await supabase
      .from("plan_blocks")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", plan.id)
      .eq("is_completed", false);

    if (remainingCount === 0) {
      // All current blocks done — check if more weeks exist in outline
      const { data: allBlocks } = await supabase
        .from("plan_blocks")
        .select("week_number")
        .eq("plan_id", plan.id);

      const maxGeneratedWeek = Math.max(
        ...(allBlocks || []).map((b: any) => b.week_number),
        0,
      );

      const outline = plan.plan_outline as any;

      if (maxGeneratedWeek >= plan.total_weeks) {
        // Plan is truly complete
        planStatus = "plan_complete";

        // Build summary
        const { data: userPillars } = await supabase
          .from("pillars")
          .select("name, current_level")
          .eq("user_id", userId)
          .eq("is_active", true);

        const { data: progressData } = await supabaseAdmin
          .from("user_progress")
          .select("total_tasks_completed")
          .eq("user_id", userId)
          .maybeSingle();

        planCompleteData = {
          total_weeks_completed: maxGeneratedWeek,
          total_tasks_completed: progressData?.total_tasks_completed || 0,
          pillars_summary: (userPillars || []).map((p: any) => ({
            name: p.name,
            final_level: p.current_level,
          })),
        };
      } else {
        // More weeks to generate
        const nextWeekNumber = maxGeneratedWeek + 1;
        const weekOutline = outline?.weeks?.find(
          (w: any) => w.week_number === nextWeekNumber,
        );

        if (weekOutline) {
          nextBlock = {
            should_generate: true,
            week_number: nextWeekNumber,
            pillars: weekOutline.pillars,
          };
        }

        // Near-end detection for exploratory plans
        if (
          plan.pacing_profile === "exploratory" &&
          plan.total_weeks - nextWeekNumber <= 1
        ) {
          planStatus = "nearing_end";
          nearingEnd = true;
        }
      }
    } else {
      // Other blocks still pending in current week
      planStatus = "in_progress";

      // Near-end detection even when blocks remain
      if (plan.pacing_profile === "exploratory") {
        const { data: allBlocks } = await supabase
          .from("plan_blocks")
          .select("week_number")
          .eq("plan_id", plan.id);
        const maxWeek = Math.max(
          ...(allBlocks || []).map((b: any) => b.week_number),
          0,
        );
        if (plan.total_weeks - maxWeek <= 1) {
          nearingEnd = true;
        }
      }
    }
  }

  return jsonRes({
    success: true,
    level_up: levelUp,
    difficulty_adjustment: difficultyAdjustment,
    feedback_context: feedbackContext,
    plan_status: planStatus,
    next_block: nextBlock,
    plan_complete_data: planCompleteData,
    nearing_end: nearingEnd,
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !userData?.user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    // Rate limiting (200/day)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = await checkRateLimit(
      supabaseAdmin, userId, ip, "process-checkin", CHECKIN_RATE_LIMIT,
    );
    if (!rateCheck.allowed) {
      return jsonRes({ error: rateCheck.message }, 429);
    }

    const body = await req.json();
    const { event_type } = body;

    if (event_type === "task_complete") {
      const { task_id } = body;
      if (!task_id) {
        return jsonRes({ error: "task_id is required" }, 400);
      }
      return await handleTaskComplete(supabase, supabaseAdmin, userId, task_id);
    }

    if (event_type === "block_complete") {
      const { block_id, difficulty, note } = body;
      if (!block_id) {
        return jsonRes({ error: "block_id is required" }, 400);
      }
      return await handleBlockComplete(
        supabase, supabaseAdmin, userId, block_id,
        difficulty || null, note || null,
      );
    }

    return jsonRes({ error: "Invalid event_type. Must be: task_complete, block_complete" }, 400);
  } catch (err: any) {
    console.error(err);
    if (err.status === 429) {
      return jsonRes({ error: err.message }, 429);
    }
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
