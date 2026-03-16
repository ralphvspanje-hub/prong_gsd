import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseCheckinComplete(text: string): any | null {
  const match = text.match(
    /\[CHECKIN_COMPLETE\]([\s\S]*?)\[\/CHECKIN_COMPLETE\]/,
  );
  if (!match) return null;

  let cleaned = match[1].trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gemini API
// ---------------------------------------------------------------------------

async function callGemini(
  geminiApiKey: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

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
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      }),
    },
  );

  if (!aiResponse.ok) {
    if (aiResponse.status === 429) {
      throw Object.assign(
        new Error("AI service temporarily unavailable. Try again shortly."),
        { status: 429 },
      );
    }
    const errText = await aiResponse.text();
    throw new Error(`AI API error: ${aiResponse.status} ${errText}`);
  }

  const aiData = await aiResponse.json();
  return aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ---------------------------------------------------------------------------
// Build system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  sprintNumber: number,
  careerGoal: string,
  focusPillars: string[],
  completionStats: { completed: number; total: number },
  pillarLevels: Array<{ name: string; level: number }>,
  allPillars: Array<{ name: string; level: number; description: string }>,
  pillarRationale: Record<string, string>,
  turnCount: number,
): string {
  const pillarLevelStr = pillarLevels
    .map((p) => `- ${p.name}: level ${p.level}/5`)
    .join("\n");

  const allPillarStr = allPillars
    .map((p) => {
      const rationale = pillarRationale[p.name] || "";
      return `- ${p.name} (level ${p.level}/5): ${p.description}${rationale ? ` — Why: ${rationale}` : ""}`;
    })
    .join("\n");

  const wrapUpHint =
    turnCount >= 4
      ? "\n\nIMPORTANT: The conversation has had enough turns. Wrap up now — provide your final summary and recommendation, then emit the [CHECKIN_COMPLETE] block."
      : "";

  return `You are the learner's sprint coach. Sprint ${sprintNumber} of their focused learning plan just ended.

CAREER GOAL: ${careerGoal}
SPRINT ${sprintNumber} FOCUS: ${focusPillars.join(", ")}
COMPLETION: ${completionStats.completed} of ${completionStats.total} practice units completed

CURRENT PILLAR LEVELS:
${pillarLevelStr}

ALL PILLARS (the learner's full skill map):
${allPillarStr}

CONVERSATION FLOW:
1. Start by reflecting on the sprint — what the data shows (completion rate, which pillar was focused on)
2. Ask how they felt about the difficulty and what was most/least useful
3. Based on their response, recommend 1-2 pillars for the next sprint with clear reasoning
4. When ready, emit your structured summary

BEHAVIOR RULES:
- Be conversational and encouraging, not formal
- Reference specific pillars and their levels when making recommendations
- If they completed very few units, explore why (too hard? life got busy? not interesting?) without judgment
- Suggest continuing the same pillar if they're mid-level and making progress
- Suggest switching if they hit a natural stopping point or need variety
- Keep to 3-5 turns total. Be efficient but warm.
${wrapUpHint}

COMPLETION FORMAT:
When ready to conclude, emit (after your final conversational message):
[CHECKIN_COMPLETE]
{
  "sprint_review": "2-3 sentence summary of how this sprint went",
  "difficulty_signals": {"Pillar Name": "harder|easier|same"},
  "suggested_focus": [{"pillar_name": "Name", "reason": "Why this pillar next"}],
  "pacing_note": "Brief note about pacing for next sprint"
}
[/CHECKIN_COMPLETE]`;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function handleStart(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  geminiApiKey: string,
  planId: string,
): Promise<Response> {
  // Fetch plan
  const { data: plan } = await supabase
    .from("learning_plans")
    .select("id, plan_outline, sprint_started_at")
    .eq("id", planId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!plan) return jsonRes({ error: "Plan not found" }, 404);

  const outline = plan.plan_outline as any;
  const sprintNumber = outline?.current_sprint?.sprint_number || 1;

  // Get completion stats for this sprint
  const { data: sprintBlocks } = await supabase
    .from("plan_blocks")
    .select("id, pillar_id")
    .eq("plan_id", planId)
    .eq("week_number", sprintNumber);

  const blockIds = (sprintBlocks || []).map((b: any) => b.id);
  let completedCount = 0;
  let totalCount = 0;

  if (blockIds.length > 0) {
    const { data: tasks } = await supabase
      .from("plan_tasks")
      .select("id, is_completed")
      .in("plan_block_id", blockIds);

    totalCount = tasks?.length || 0;
    completedCount = (tasks || []).filter((t: any) => t.is_completed).length;
  }

  // Fetch all pillars
  const { data: pillars } = await supabase
    .from("pillars")
    .select("id, name, current_level, description, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("sort_order");

  const allPillars = (pillars || []).map((p: any) => ({
    name: p.name,
    level: p.current_level,
    description: p.description || "",
  }));

  const pillarLevels = allPillars.map((p: any) => ({
    name: p.name,
    level: p.level,
  }));

  const focusPillars = (outline?.current_sprint?.focus_pillars || []).map(
    (fp: any) => fp.pillar_name,
  );

  const careerGoal = outline?.career_goal || "Career development";
  const pillarRationale = outline?.pillar_rationale || {};

  // Check for existing in-progress checkin
  const { data: existingCheckin } = await supabaseAdmin
    .from("sprint_checkins")
    .select("id, messages")
    .eq("plan_id", planId)
    .eq("sprint_number", sprintNumber)
    .eq("status", "in_progress")
    .maybeSingle();

  if (existingCheckin) {
    // Resume existing checkin
    return jsonRes({
      checkin_id: existingCheckin.id,
      messages: existingCheckin.messages,
      sprint_number: sprintNumber,
    });
  }

  // Build system prompt and get first AI message
  const systemPrompt = buildSystemPrompt(
    sprintNumber,
    careerGoal,
    focusPillars,
    { completed: completedCount, total: totalCount },
    pillarLevels,
    allPillars,
    pillarRationale,
    0,
  );

  const firstMessage = await callGemini(
    geminiApiKey,
    systemPrompt,
    [{ role: "user", content: "I just finished my sprint. Let's review!" }],
    2048,
  );

  const messages = [{ role: "assistant", content: firstMessage }];

  // Create checkin row
  const { data: checkin, error: checkinErr } = await supabaseAdmin
    .from("sprint_checkins")
    .insert({
      user_id: userId,
      plan_id: planId,
      sprint_number: sprintNumber,
      messages,
      status: "in_progress",
    })
    .select()
    .single();

  if (checkinErr) throw checkinErr;

  return jsonRes({
    checkin_id: checkin.id,
    message: firstMessage,
    messages,
    sprint_number: sprintNumber,
  });
}

async function handleContinue(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  geminiApiKey: string,
  checkinId: string,
  userMessage: string,
): Promise<Response> {
  if (!userMessage || userMessage.length > 2000) {
    return jsonRes({ error: "Message required (max 2000 chars)" }, 400);
  }

  // Fetch checkin
  const { data: checkin } = await supabaseAdmin
    .from("sprint_checkins")
    .select("*")
    .eq("id", checkinId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!checkin) return jsonRes({ error: "Check-in not found" }, 404);
  if (checkin.status === "completed") {
    return jsonRes({ error: "Check-in already completed" }, 400);
  }

  // Fetch plan for context
  const { data: plan } = await supabase
    .from("learning_plans")
    .select("id, plan_outline, sprint_started_at")
    .eq("id", checkin.plan_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!plan) return jsonRes({ error: "Plan not found" }, 404);

  const outline = plan.plan_outline as any;
  const sprintNumber = checkin.sprint_number;

  // Get completion stats
  const { data: sprintBlocks } = await supabase
    .from("plan_blocks")
    .select("id")
    .eq("plan_id", checkin.plan_id)
    .eq("week_number", sprintNumber);

  const blockIds = (sprintBlocks || []).map((b: any) => b.id);
  let completedCount = 0;
  let totalCount = 0;

  if (blockIds.length > 0) {
    const { data: tasks } = await supabase
      .from("plan_tasks")
      .select("id, is_completed")
      .in("plan_block_id", blockIds);
    totalCount = tasks?.length || 0;
    completedCount = (tasks || []).filter((t: any) => t.is_completed).length;
  }

  // Fetch pillars
  const { data: pillars } = await supabase
    .from("pillars")
    .select("id, name, current_level, description, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("sort_order");

  const allPillars = (pillars || []).map((p: any) => ({
    name: p.name,
    level: p.current_level,
    description: p.description || "",
  }));

  const pillarLevels = allPillars.map((p: any) => ({
    name: p.name,
    level: p.level,
  }));

  const focusPillars = (outline?.current_sprint?.focus_pillars || []).map(
    (fp: any) => fp.pillar_name,
  );

  const careerGoal = outline?.career_goal || "Career development";
  const pillarRationale = outline?.pillar_rationale || {};

  // Build messages with user's new message
  const messages = [
    ...(checkin.messages || []),
    { role: "user", content: userMessage },
  ];
  const turnCount = messages.filter((m: any) => m.role === "user").length;

  const systemPrompt = buildSystemPrompt(
    sprintNumber,
    careerGoal,
    focusPillars,
    { completed: completedCount, total: totalCount },
    pillarLevels,
    allPillars,
    pillarRationale,
    turnCount,
  );

  const aiText = await callGemini(geminiApiKey, systemPrompt, messages, 3072);

  // Check for completion tag
  const summary = parseCheckinComplete(aiText);

  // Clean AI message (remove the tag block for display)
  const displayMessage = aiText
    .replace(/\[CHECKIN_COMPLETE\][\s\S]*?\[\/CHECKIN_COMPLETE\]/, "")
    .trim();

  const updatedMessages = [
    ...messages,
    { role: "assistant", content: displayMessage },
  ];

  if (summary) {
    // Check-in complete — apply pillar level adjustments
    if (summary.difficulty_signals) {
      for (const [pillarName, signal] of Object.entries(
        summary.difficulty_signals,
      )) {
        if (signal === "harder" || signal === "easier") {
          const pillar = (pillars || []).find(
            (p: any) => p.name.toLowerCase() === pillarName.toLowerCase(),
          );
          if (pillar) {
            const currentLevel = pillar.current_level;
            let newLevel = currentLevel;
            if (signal === "harder" && currentLevel < 5) {
              newLevel = currentLevel + 1;
            } else if (signal === "easier" && currentLevel > 1) {
              newLevel = currentLevel - 1;
            }
            if (newLevel !== currentLevel) {
              await supabaseAdmin
                .from("pillars")
                .update({
                  current_level: newLevel,
                  blocks_completed_at_level: 0,
                  last_difficulty_signal: null,
                  trend: signal === "harder" ? "up" : "down",
                })
                .eq("id", pillar.id);
            }
          }
        }
      }
    }

    // Update checkin as completed
    await supabaseAdmin
      .from("sprint_checkins")
      .update({
        messages: updatedMessages,
        status: "completed",
        ai_summary: summary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", checkinId);

    return jsonRes({
      message: displayMessage,
      messages: updatedMessages,
      completed: true,
      summary,
      suggested_pillars: summary.suggested_focus || [],
    });
  }

  // Not complete yet — save messages
  await supabaseAdmin
    .from("sprint_checkins")
    .update({ messages: updatedMessages })
    .eq("id", checkinId);

  return jsonRes({
    message: displayMessage,
    messages: updatedMessages,
    completed: false,
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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

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

    // Rate limiting
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = await checkRateLimit(
      supabaseAdmin,
      userId,
      ip,
      "sprint-checkin",
    );
    if (!rateCheck.allowed) {
      return jsonRes({ error: rateCheck.message }, 429);
    }

    const body = await req.json();
    const { action } = body;

    if (action === "start") {
      const { plan_id } = body;
      if (!plan_id) {
        return jsonRes({ error: "plan_id is required" }, 400);
      }
      return await handleStart(
        supabase,
        supabaseAdmin,
        userId,
        geminiApiKey,
        plan_id,
      );
    }

    if (action === "continue") {
      const { checkin_id, message } = body;
      if (!checkin_id || !message) {
        return jsonRes({ error: "checkin_id and message are required" }, 400);
      }
      return await handleContinue(
        supabase,
        supabaseAdmin,
        userId,
        geminiApiKey,
        checkin_id,
        message,
      );
    }

    return jsonRes({ error: "Invalid action. Must be: start, continue" }, 400);
  } catch (err: any) {
    console.error(err);
    if (err.status === 429) {
      return jsonRes({ error: err.message }, 429);
    }
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
