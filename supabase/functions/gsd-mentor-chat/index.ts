import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface PlanOutlineWeek {
  week_number: number;
  pillars: { pillar_id?: string; pillar_name: string; weekly_goal: string; difficulty?: number }[];
}

function detectPatterns(
  feedbacks: { checkin_feedback: any; pillar_id: string; pillar_name?: string }[],
  progress: any
): string[] {
  const alerts: string[] = [];
  const difficulties = feedbacks
    .map((f) => f.checkin_feedback?.difficulty)
    .filter(Boolean);

  if (difficulties.length >= 3) {
    const hardCount = difficulties.filter((d: string) => d === "too_hard").length;
    const easyCount = difficulties.filter((d: string) => d === "too_easy").length;
    if (hardCount >= 3)
      alerts.push(
        `STRUGGLING: ${hardCount} of last ${difficulties.length} blocks rated "too hard". Consider reducing difficulty or adding foundation weeks.`
      );
    if (easyCount >= 3)
      alerts.push(
        `UNDER-CHALLENGED: ${easyCount} of last ${difficulties.length} blocks rated "too easy". Consider increasing difficulty or accelerating pacing.`
      );
  }

  // Per-pillar consecutive signals
  const pillarFeedbacks = new Map<string, string[]>();
  for (const f of feedbacks) {
    const pid = f.pillar_id;
    const diff = f.checkin_feedback?.difficulty;
    if (pid && diff) {
      if (!pillarFeedbacks.has(pid)) pillarFeedbacks.set(pid, []);
      pillarFeedbacks.get(pid)!.push(diff);
    }
  }
  for (const [_pid, diffs] of pillarFeedbacks) {
    if (diffs.length >= 2 && diffs[0] === "too_hard" && diffs[1] === "too_hard") {
      const name = feedbacks.find((f) => f.pillar_id === _pid)?.pillar_name;
      if (name)
        alerts.push(
          `PILLAR STRUGGLING: "${name}" has been rated "too hard" for 2+ consecutive blocks.`
        );
    }
  }

  if (
    progress &&
    progress.current_streak === 0 &&
    progress.longest_streak > 3
  ) {
    alerts.push(
      `STREAK BROKEN: Had a ${progress.longest_streak}-day streak but currently at 0. Check in on motivation.`
    );
  }

  return alerts;
}

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

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

    // Rate limiting
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = await checkRateLimit(supabaseAdmin, userId, ip, "mentor-chat");
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateCheck.message }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { message } = await req.json();
    if (!message || typeof message !== "string" || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Invalid message" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load user context — round 1 (parallel)
    const [profileRes, pillarsRes, phasesRes, cyclesRes, planRes, progressRes] =
      await Promise.all([
        supabase.from("user_profile").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("pillars")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("phases").select("*").eq("user_id", userId).eq("is_active", true).limit(1),
        supabase
          .from("cycles")
          .select("*")
          .eq("user_id", userId)
          .order("cycle_number", { ascending: false })
          .limit(3),
        supabase
          .from("learning_plans")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
        supabase.from("user_progress").select("*").eq("user_id", userId).maybeSingle(),
      ]);

    const profile = profileRes.data;
    const pillars = pillarsRes.data || [];
    const phase = phasesRes.data?.[0];
    const recentCycles = cyclesRes.data || [];
    const plan = planRes.data;
    const progress = progressRes.data;

    // Build pillar ID→name map
    const pillarMap = new Map<string, string>();
    for (const p of pillars) pillarMap.set(p.id, p.name);

    // Load plan-related context — round 2 (needs plan ID)
    let allBlocks: any[] = [];
    let currentWeekTasks: any[] = [];

    if (plan) {
      const { data: blocksData } = await supabase
        .from("plan_blocks")
        .select("*")
        .eq("plan_id", plan.id)
        .order("week_number");
      allBlocks = blocksData || [];

      // Determine current week (lowest week of uncompleted blocks)
      const uncompletedBlocks = allBlocks.filter((b: any) => !b.is_completed);
      const currentWeek = uncompletedBlocks.length > 0
        ? Math.min(...uncompletedBlocks.map((b: any) => b.week_number))
        : null;

      if (currentWeek !== null) {
        const currentBlockIds = uncompletedBlocks
          .filter((b: any) => b.week_number === currentWeek)
          .map((b: any) => b.id);

        if (currentBlockIds.length > 0) {
          const { data: tasksData } = await supabase
            .from("plan_tasks")
            .select("*")
            .in("plan_block_id", currentBlockIds)
            .order("task_order");
          currentWeekTasks = tasksData || [];
        }
      }
    }

    // Load conversation history (last 30 messages)
    const { data: history } = await supabase
      .from("mentor_conversations")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(30);

    const mentorDisplayName = profile?.mentor_name || "Mentor";

    // Compute plan context for system prompt
    let planSection = "No active plan.";
    let weekStatusSection = "";
    let taskIdsSection = "";
    let feedbackSection = "";
    let patternSection = "";
    let planIdSection = "";

    if (plan) {
      planIdSection = `PLAN ID: ${plan.id}`;
      const outline = plan.plan_outline as { total_weeks: number; weeks: PlanOutlineWeek[] } | null;
      const outlineWeeks = outline?.weeks || [];

      // Determine current week
      const uncompletedBlocks = allBlocks.filter((b: any) => !b.is_completed);
      const completedWeeks = new Set(
        allBlocks.filter((b: any) => b.is_completed).map((b: any) => b.week_number)
      );
      const currentWeek = uncompletedBlocks.length > 0
        ? Math.min(...uncompletedBlocks.map((b: any) => b.week_number))
        : null;

      // Summarize plan outline
      const outlineSummary = outlineWeeks
        .map((w: PlanOutlineWeek) => {
          const pillarNames = w.pillars.map((p) => p.pillar_name).join(" + ");
          const weekNum = w.week_number;
          let status = "";
          if (completedWeeks.has(weekNum)) status = " (done)";
          else if (weekNum === currentWeek) status = " (current)";
          return `  Week ${weekNum}: ${pillarNames}${status}`;
        })
        .join("\n");

      const weeksRemaining = currentWeek !== null
        ? plan.total_weeks - currentWeek + 1
        : 0;

      planSection = `Total weeks: ${plan.total_weeks}, Current week: ${currentWeek ?? "all done"}, Weeks remaining: ${weeksRemaining}, Pacing: ${plan.pacing_profile}
Plan outline:
${outlineSummary || "  (empty)"}`;

      // Current week status
      if (currentWeek !== null) {
        const currentBlocks = uncompletedBlocks.filter(
          (b: any) => b.week_number === currentWeek
        );
        // Also include completed blocks from current week
        const allCurrentWeekBlocks = allBlocks.filter(
          (b: any) => b.week_number === currentWeek
        );
        weekStatusSection = allCurrentWeekBlocks
          .map((b: any) => {
            const pillarName = pillarMap.get(b.pillar_id) || "Unknown";
            const blockTasks = currentWeekTasks.filter(
              (t: any) => t.plan_block_id === b.id
            );
            const completedCount = blockTasks.filter((t: any) => t.is_completed).length;
            const totalCount = blockTasks.length;
            const pacingNote = b.pacing_note ? ` — Pacing: ${b.pacing_note}` : "";
            return `- ${pillarName}: "${b.weekly_goal}" (${completedCount}/${totalCount} tasks done${b.is_completed ? ", block complete" : ""}${pacingNote})`;
          })
          .join("\n");

        // Task IDs for current week (uncompleted only, needed for swap_resource)
        const uncompletedTasks = currentWeekTasks.filter((t: any) => !t.is_completed);
        if (uncompletedTasks.length > 0) {
          taskIdsSection = uncompletedTasks
            .map((t: any) => `- ${t.id}: "${t.action}" (${t.platform})`)
            .join("\n");
        }
      }

      // Recent check-in feedback (from completed blocks)
      const blocksWithFeedback = allBlocks
        .filter((b: any) => b.checkin_feedback && b.is_completed)
        .sort((a: any, b: any) => {
          const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5);

      if (blocksWithFeedback.length > 0) {
        feedbackSection = blocksWithFeedback
          .map((b: any) => {
            const pillarName = pillarMap.get(b.pillar_id) || "Unknown";
            const fb = b.checkin_feedback;
            const note = fb?.note ? ` — "${fb.note}"` : "";
            return `- Week ${b.week_number} / ${pillarName}: rated "${fb?.difficulty || "unknown"}"${note}`;
          })
          .join("\n");
      }

      // Pattern detection
      const feedbacksForPatterns = blocksWithFeedback.map((b: any) => ({
        checkin_feedback: b.checkin_feedback,
        pillar_id: b.pillar_id,
        pillar_name: pillarMap.get(b.pillar_id),
      }));
      const patterns = detectPatterns(feedbacksForPatterns, progress);
      if (patterns.length > 0) {
        patternSection = patterns.map((p) => `⚠ ${p}`).join("\n");
      }
    }

    // Progress section
    let progressSection = "No progress data.";
    if (progress) {
      progressSection = `Day ${progress.current_day} | Streak: ${progress.current_streak} days (longest: ${progress.longest_streak}) | Total tasks completed: ${progress.total_tasks_completed}`;
    }

    // Resume/LinkedIn context
    let extraContext = "";
    if (profile?.resume_text) {
      extraContext += `\nRESUME CONTEXT (user-provided):\n${profile.resume_text.substring(0, 1500)}\n`;
    }
    if (profile?.linkedin_context) {
      extraContext += `\nLINKEDIN CONTEXT (user-provided):\n${profile.linkedin_context.substring(0, 1500)}\n`;
    }

    // Build system prompt
    const systemPrompt = `You are ${mentorDisplayName}, the ProngGSD career mentor — a sharp, thoughtful thinking partner focused on the user's long-term career growth. You ask before you act. Never change pillars, plan structure, or settings without explicit user confirmation.

USER PROFILE:
- Name: ${profile?.name || "Unknown"}
- Current Role: ${profile?.current_role || "Not set"}
- Target Role: ${profile?.target_role || "Not set"}
- Long-term Ambition: ${profile?.long_term_ambition || "Not set"}
- Pacing Profile: ${profile?.pacing_profile || "Not set"}
- Time Commitment: ${profile?.time_commitment || "Not set"}
- Job Situation: ${profile?.job_situation || "Not set"}${profile?.job_timeline_weeks ? ` (${profile.job_timeline_weeks} weeks)` : ""}
${extraContext}
ACTIVE PILLARS:
${pillars.map((p: any) => `- ${p.name} (Level ${p.current_level}/5, Weight: ${p.phase_weight || 0}%, Trend: ${p.trend || "stable"}, Blocks at level: ${p.blocks_completed_at_level || 0})`).join("\n") || "None"}

CURRENT PHASE:
${phase ? `${phase.name} (${phase.timeline_start} to ${phase.timeline_end}) — Goal: ${phase.goal}` : "No active phase"}

RECENT CYCLES:
${recentCycles.map((c: any) => `- Cycle ${c.cycle_number}: ${c.theme || "No theme"} (${c.status})`).join("\n") || "None"}

ACTIVE PLAN:
${planSection}
${planIdSection ? `\n${planIdSection}` : ""}
${weekStatusSection ? `\nCURRENT WEEK STATUS:\n${weekStatusSection}` : ""}
${taskIdsSection ? `\nCURRENT TASK IDS (for swap_resource — use these exact IDs):\n${taskIdsSection}` : ""}

PROGRESS:
${progressSection}
${feedbackSection ? `\nRECENT CHECK-IN FEEDBACK:\n${feedbackSection}` : ""}
${patternSection ? `\nPATTERN ALERTS:\n${patternSection}` : ""}

BEHAVIOR RULES:
- When the user wants to add, swap, edit, or delete pillars: ask clarifying questions first (2–4 turns), then summarize proposed changes clearly, then wait for confirmation.
- When the user wants to change a pillar level: ask 3–5 diagnostic questions about their experience with the topic to assess their actual level, then recommend a specific level with reasoning.
- When the user is stuck on a topic: ask what specifically is hard before proposing changes. Offer encouragement and concrete tips before resorting to plan modifications.
- When proposing pacing changes: explain the tradeoff (faster = more daily work, shorter timeline; slower = less per day, longer timeline).
- When proposing plan restructuring: summarize what will change clearly (which weeks are affected, what topics move) before the PROPOSED_CHANGES block.
- For swap_resource: suggest a specific alternative platform or resource with reasoning, using the exact task_id from CURRENT TASK IDS.
- If PATTERN ALERTS exist, proactively reference them in conversation (e.g., "I notice you've rated the last few blocks as too hard — want me to add a foundations week?").
- When discussing career direction: be honest, curious, and specific. Reference their actual goals, pillars, and plan progress.
- Keep responses focused and actionable. No filler.
- You are not a general chatbot — stay within career growth, learning strategy, and the user's ProngGSD setup.
- When you propose changes, always end your confirmation message with a PROPOSED_CHANGES block so the app can parse and apply it.
- You can propose multiple actions at once by using an array in PROPOSED_CHANGES.

PROPOSED_CHANGES FORMAT:
When proposing changes, end your message with:
PROPOSED_CHANGES
[{"action": "<action>", "changes": {<changes>}}]

You can include multiple actions in the array when they go together (e.g., adding a pillar and regenerating upcoming blocks).
A single action is also valid: {"action": "<action>", "changes": {<changes>}}

PILLAR ACTIONS:
- add_pillar: {"name": "", "description": "", "why_it_matters": "", "starting_level": 1, "phase_weight": 0, "topic_clusters": [{"cluster_name": "", "subtopics": []}]}
- delete_pillar: {"pillar_id": ""}
- edit_pillar: {"pillar_id": "", "fields_to_update": {"name?": "", "description?": "", "why_it_matters?": "", "phase_weight?": 0}}
- swap_pillar: {"remove_pillar_id": "", "add": {same as add_pillar}}
- change_level: {"pillar_id": "", "new_level": 1}
- full_recalibration: {"redirect": true}

PLAN ACTIONS:
- adjust_pacing: {"new_pacing": "aggressive"|"steady"|"exploratory"}
- restructure_plan: {"plan_id": "<plan_id>", "updated_outline_weeks": [{"week_number": N, "pillars": [{"pillar_name": "", "weekly_goal": "", "difficulty": 1-5}]}]}
  — Provide the COMPLETE list of future weeks (all weeks after the current week). Past/current weeks are preserved automatically.
- swap_resource: {"task_id": "<task_id>", "new_action": "description of new task", "new_platform": "YouTube|HackerRank|LeetCode|GitHub|Google|Kaggle|etc", "new_resource_type": "curated"|"search_query", "new_url": null|"https://...", "new_search_query": null|"search query string"}
- regenerate_upcoming: {"plan_id": "<plan_id>"}
  — Deletes all future uncompleted blocks so they regenerate fresh with current settings.

AVAILABLE PILLAR IDS:
${pillars.map((p: any) => `- ${p.name}: ${p.id}`).join("\n") || "None"}`;

    const contents = [
      ...(history || []).map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          {
            text:
              m.role === "user"
                ? `[USER MESSAGE]: ${m.content} [/USER MESSAGE]`
                : m.content,
          },
        ],
      })),
      {
        role: "user",
        parts: [{ text: `[USER MESSAGE]: ${message} [/USER MESSAGE]` }],
      },
    ];

    const aiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 3072, temperature: 0.7 },
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error:
              "The AI service is temporarily unavailable due to high demand. Please try again in a few minutes.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} ${errText}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't generate a response.";

    return new Response(JSON.stringify({ message: assistantMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err); // full error + stack visible in Supabase function logs
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
