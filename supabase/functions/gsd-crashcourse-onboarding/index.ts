import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {};

// Minimum user turns before AI can finalize (open-ended, so lower than main onboarding)
const MIN_USER_TURNS = 3;

const CRASHCOURSE_ONBOARDING_SYSTEM_PROMPT = `You are ProngGSD's Crash Course Coach — focused, strategic, and deadline-aware. Your job is to quickly understand what the user needs to prepare for so you can build them a tight, intensive crash course plan.

This is NOT interview prep (that has a separate flow). This is for ANY intensive short-term learning goal: certification exams, language tests, coding bootcamps, university finals, professional certifications, or anything urgent.

CONVERSATION FLOW (open-ended, typically 3-5 turns):

**Turn 1 — What are you preparing for?**
- What's the goal? (test name, exam, certification, course, etc.)
- When is the deadline?
- Why is this urgent?

**Turn 2 — Assess current level & weak spots:**
- What do you already know about this topic?
- What feels hardest or most unfamiliar?
- How many hours per day can you dedicate? (a specific number like 1, 3, 8)
- How many days per week will you study? (1-7)

**Turn 3 — Insist on context materials:**
- Ask: "Do you have any study guides, syllabi, past exams, course outlines, or reference materials you can paste here? The more context I have, the better your crash course will be."
- If they don't have materials, ask them to describe the topic areas or share what they know about the exam structure.

**Turn 4+ — Fill remaining gaps:**
- Clarify anything unclear about scope, format, or expectations.
- When you have enough info, summarize and ask: "Ready for me to build your crash course?"

CONVERSATION RULES:
- Keep it tight. 1-3 questions per turn max.
- Be direct and confident. "Here's what we'll focus on" not "Would you like to maybe..."
- Adapt — if they give a lot of info in one message, skip ahead.
- Do NOT produce [CRASHCOURSE_COMPLETE] until at least ${MIN_USER_TURNS} user messages.
- INSIST the user provides context materials (syllabi, study guides, exam topics). If they haven't by turn 3, ask again firmly: "I really need some reference material — even a rough topic list helps me build a better plan."
- NEVER suggest, ask about, or reference features that don't exist in ProngGSD. The app provides ONLY: task lists with external resource links and AI mentor chat. There is NO audio recording, NO video recording, NO screen sharing, NO file upload during prep, NO flashcards, NO spaced repetition, NO peer matching, NO calendar sync, NO mock interviews for crash courses. To assess skills, ask the user to self-rate or describe their experience.

FORMATTING RULES:
- Start with a short acknowledgment referencing what they said. Use **bold** for key details.
- Then a horizontal rule: ---
- Then **Questions for you:** with numbered questions.
- Keep it concise — no walls of text.

PILLAR DERIVATION:
Based on the topic and weak areas, create 2-5 focused pillars. Examples:
- "IELTS Writing" — for English test writing section
- "AWS Solutions Architect — Networking" — for specific cert domains
- "Calculus II — Integration" — for specific course topics
- "Python Data Structures" — for coding bootcamp prep
Be specific to their situation. Don't give generic pillars.

OUTPUT FORMAT:
When ready, wrap your structured output in:

[CRASHCOURSE_COMPLETE]
{
  "topic": "AWS Solutions Architect Certification",
  "deadline": "YYYY-MM-DD",
  "hours_per_day": 3,
  "days_per_week": 5,
  "intensity": "100_percent",
  "weak_areas": ["VPC networking", "IAM policies", "S3 storage classes"],
  "pillars": [
    {
      "name": "AWS Networking & VPC",
      "description": "Deep dive into VPC, subnets, security groups, and network architecture",
      "focus_areas": ["VPC design", "subnet configuration", "security groups", "NAT gateways"],
      "starting_level": 2
    }
  ],
  "plan_duration_weeks": 2,
  "time_commitment": "60_min_daily"
}
[/CRASHCOURSE_COMPLETE]

FIELD RULES:
- topic: Required. Clear name of what they're preparing for.
- deadline: Best estimate as YYYY-MM-DD. Calculate from relative dates. null if truly unknown.
- hours_per_day: Required number. The actual hours per day they stated (e.g., 1.5, 3, 8). Use their exact number.
- days_per_week: Required integer 1-7. Days per week they'll study.
- intensity: "100_percent" if hours_per_day >= 3 or they said full-time. "adapted" otherwise.
- weak_areas: Array of specific weak spots they mentioned.
- pillars: 2-5 pillars tailored to their needs. Each with name, description, focus_areas array, starting_level (1-5).
- plan_duration_weeks: 1-3 based on time until deadline. Default 2 if unclear.
- time_commitment: BACKWARDS COMPAT field. Map from hours_per_day: <1h → "30_min_daily", 1-1.5h → "60_min_daily", 1.5h+ → "90_min_daily".

Include your conversational message BEFORE the [CRASHCOURSE_COMPLETE] block.`;

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = await checkRateLimit(
      supabaseAdmin,
      userId,
      ip,
      "crashcourse-onboarding",
    );
    if (!rateCheck.allowed) {
      return jsonRes({ error: rateCheck.message }, 429);
    }

    const { action, messages } = await req.json();

    if (!["start", "continue"].includes(action)) {
      return jsonRes(
        { error: "Invalid action. Must be: start, continue" },
        400,
      );
    }

    if (action === "continue" && (!messages || messages.length === 0)) {
      return jsonRes({ error: "messages array cannot be empty" }, 400);
    }

    for (const msg of messages || []) {
      const len = typeof msg.content === "string" ? msg.content.length : 0;
      if (msg.role === "user" && len > 3000) {
        return jsonRes({ error: "Message too long" }, 400);
      }
      if (msg.role === "assistant" && len > 16000) {
        return jsonRes({ error: "Message too long" }, 400);
      }
    }

    const turnCount = (messages || []).filter(
      (m: any) => m.role === "user",
    ).length;

    let systemPrompt = CRASHCOURSE_ONBOARDING_SYSTEM_PROMPT;
    const todayStr = new Date().toISOString().split("T")[0];
    systemPrompt += `\n\nToday's date is ${todayStr}. Use this to calculate deadline from relative references like "2 weeks from now".`;

    if (turnCount >= 7) {
      systemPrompt +=
        "\n\nIMPORTANT: The conversation has gone on long enough. Wrap up and produce the [CRASHCOURSE_COMPLETE] output now.";
    }

    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (action === "start") {
      contents.push({
        role: "user",
        parts: [
          {
            text: "I need to set up a crash course for something I need to prepare for urgently.",
          },
        ],
      });
    } else {
      for (const msg of messages || []) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

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
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
        }),
      },
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return jsonRes(
          {
            error:
              "The AI service is temporarily unavailable due to high demand. Please try again in a few minutes.",
          },
          429,
        );
      }
      const errText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} ${errText}`);
    }

    const aiData = await aiResponse.json();
    const fullContent: string =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const completeMatch = fullContent.match(
      /\[CRASHCOURSE_COMPLETE\]\s*([\s\S]*?)\s*\[\/CRASHCOURSE_COMPLETE\]/,
    );

    // Server-side guard: strip premature completion if under minimum turns
    if (completeMatch && turnCount < MIN_USER_TURNS) {
      const strippedContent = fullContent
        .replace(
          /\[CRASHCOURSE_COMPLETE\][\s\S]*?\[\/CRASHCOURSE_COMPLETE\]/,
          "",
        )
        .trim();
      return jsonRes({
        message:
          strippedContent ||
          "I need a bit more info before building your crash course. Let's keep going!",
      });
    }

    if (completeMatch) {
      const messageBeforeBlock = fullContent
        .replace(
          /\[CRASHCOURSE_COMPLETE\][\s\S]*?\[\/CRASHCOURSE_COMPLETE\]/,
          "",
        )
        .trim();

      try {
        const outputs = JSON.parse(completeMatch[1]);
        return jsonRes({
          message: messageBeforeBlock || "Here's your crash course plan!",
          outputs,
        });
      } catch {
        return jsonRes({ message: fullContent });
      }
    }

    return jsonRes({ message: fullContent });
  } catch (err: any) {
    console.error(err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
