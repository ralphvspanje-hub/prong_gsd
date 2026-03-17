import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Auth ----
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

    // ---- Rate limit (100/user/day) ----
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = await checkRateLimit(
      supabaseAdmin,
      userId,
      ip,
      "practice-feedback",
      100,
    );
    if (!rateCheck.allowed) {
      return jsonRes({ error: rateCheck.message }, 429);
    }

    // ---- Parse request ----
    const body = await req.json();
    const { task_id, answer, attempt } = body;

    if (!task_id || typeof task_id !== "string") {
      return jsonRes({ error: "task_id is required" }, 400);
    }
    if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
      return jsonRes({ error: "answer is required" }, 400);
    }
    if (answer.length > 2000) {
      return jsonRes({ error: "Answer must be 2000 characters or less" }, 400);
    }
    if (attempt !== 1 && attempt !== 2) {
      return jsonRes({ error: "attempt must be 1 or 2" }, 400);
    }

    // ---- Fetch task + verify ownership ----
    const { data: task, error: taskErr } = await supabase
      .from("plan_tasks")
      .select(
        "id, action, resource_type, is_completed, attempt_count, user_answers, plan_block_id, user_id",
      )
      .eq("id", task_id)
      .maybeSingle();

    if (taskErr || !task) {
      return jsonRes({ error: "Task not found" }, 404);
    }
    if (task.user_id !== userId) {
      return jsonRes({ error: "Unauthorized" }, 403);
    }
    if (task.resource_type !== "practice_question") {
      return jsonRes({ error: "Task is not a practice question" }, 400);
    }
    if ((task.attempt_count ?? 0) >= 2) {
      return jsonRes({ error: "Maximum attempts reached" }, 400);
    }
    if (attempt !== (task.attempt_count ?? 0) + 1) {
      return jsonRes(
        { error: `Expected attempt ${(task.attempt_count ?? 0) + 1}` },
        400,
      );
    }

    // ---- Fetch parent block + pillar for context ----
    const { data: block } = await supabase
      .from("plan_blocks")
      .select("id, pillar_id, title, week_number")
      .eq("id", task.plan_block_id)
      .maybeSingle();

    let pillarName = "Unknown";
    let pillarLevel = 1;
    if (block?.pillar_id) {
      const { data: pillar } = await supabase
        .from("pillars")
        .select("name, current_level")
        .eq("id", block.pillar_id)
        .maybeSingle();
      if (pillar) {
        pillarName = pillar.name;
        pillarLevel = pillar.current_level ?? 1;
      }
    }

    // ---- Build AI prompt ----
    const question = task.action;
    const previousAnswers = (task.user_answers as any[]) || [];

    let previousContext = "";
    if (attempt === 2 && previousAnswers.length > 0) {
      const prev = previousAnswers[0];
      previousContext = `
PREVIOUS ATTEMPT:
Answer: ${prev.answer}
Feedback: ${prev.feedback}

The student is now submitting a revised answer. Evaluate improvement and remaining gaps.`;
    }

    const systemPrompt = `You are a concise practice question evaluator for a learning platform.

CONTEXT:
- Skill area: ${pillarName} (level ${pillarLevel}/5)
- Block: ${block?.title || "Practice"}

QUESTION:
${question}

STUDENT'S ANSWER (attempt ${attempt}/2):
${answer.trim()}
${previousContext}

INSTRUCTIONS:
- Be encouraging but honest. Don't sugarcoat gaps.
- Structure your response as:
  1. What's correct or strong in their answer
  2. What's missing or could be improved
  3. A key insight they should remember
${attempt === 1 ? "  4. One specific thing to focus on if they retry" : "  4. Final assessment of their understanding"}
- Keep your response under 200 words.
- Use plain text, no markdown headers. Use bullet points sparingly.`;

    // ---- Call Gemini ----
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.5,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      return jsonRes({ error: "AI feedback generation failed" }, 502);
    }

    const geminiData = await geminiRes.json();
    const feedback =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Unable to generate feedback. Please try again.";

    // ---- Update task ----
    const newAnswer = { answer: answer.trim(), feedback, attempt };
    const updatedAnswers = [...previousAnswers, newAnswer];
    const newAttemptCount = attempt;
    const shouldComplete = attempt === 2;

    const updatePayload: Record<string, unknown> = {
      attempt_count: newAttemptCount,
      user_answers: updatedAnswers,
      last_feedback: feedback,
    };
    if (shouldComplete) {
      updatePayload.is_completed = true;
      updatePayload.completed_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase
      .from("plan_tasks")
      .update(updatePayload)
      .eq("id", task_id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return jsonRes({ error: "Failed to save feedback" }, 500);
    }

    return jsonRes({
      feedback,
      attempt,
      completed: shouldComplete,
      can_retry: attempt === 1,
    });
  } catch (err) {
    console.error("Practice feedback error:", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
