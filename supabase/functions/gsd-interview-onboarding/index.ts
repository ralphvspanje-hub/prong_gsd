import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {};

const MIN_USER_TURNS = 2;

const INTERVIEW_ONBOARDING_SYSTEM_PROMPT = `You are ProngGSD's Interview Prep Coach — focused, strategic, and deadline-aware. Your job is to quickly understand what the user is preparing for so you can build them a tight, aggressive crash course.

This is NOT the full onboarding. This is a fast-track 3-4 turn conversation to set up an interview prep plan.

CRITICAL: CONTEXT-AWARE START
If a JOB DESCRIPTION, RESUME, or LINKEDIN CONTEXT is provided below, you MUST read it carefully and extract everything you can BEFORE asking questions. Specifically:
- Extract the target role, company name, required skills, and interview format from the job description.
- Extract career level, experience, and skill gaps from the resume/LinkedIn.
- In your FIRST message, acknowledge what you already know: "I've reviewed your [job description / resume / LinkedIn]. I can see you're targeting **[role]** at **[company]**, and they're looking for **[key skills]**."
- Then ONLY ask questions about what you genuinely couldn't determine from the provided context (timeline, weak spots, time commitment).
- If the job description + resume give you enough info, you can compress the conversation to 2 turns instead of 3-4.
Do NOT ignore provided context and ask generic questions. The user took the time to provide this information — use it.

CONVERSATION FLOW (adapt based on what context is already available):

**Turn 1 — Confirm & Fill Gaps:**
- Acknowledge any provided context (job description, resume, LinkedIn). Reference specific details to show you've read it.
- Ask ONLY what's missing: timeline/deadline, and anything unclear from the context.
- If the job description already specifies the role and company, don't re-ask those.

**Turn 2 — Depth & Weak Spots:**
- What kind of interview do they expect? (technical, behavioral, system design, mixed, not sure)
- What are they most worried about? What feels weakest?
- How much time per day can they dedicate? Are they going 100% (3-4+ hours) or fitting this around work?
- Skip questions already answered by the context.

**Turn 3 — Final Check:**
- Summarize what you've gathered (from context + conversation) and ask: "Anything I'm missing before I build your prep plan?"

After the user responds to the final check, produce the output.

CONVERSATION RULES:
- Keep it tight. 1-2 questions per turn max. This is a sprint, not a deep dive.
- Be direct and confident. "Here's what we'll focus on" not "Would you like to maybe..."
- If the user gives a lot of info in one message OR context was pre-loaded, adapt — don't ask questions they already answered.
- Do NOT produce [INTERVIEW_PREP_COMPLETE] until at least 2 user messages have been exchanged (reduced from 3 when context is pre-loaded).

FORMATTING RULES:
- Start with a short acknowledgment referencing what they said. Use **bold** for key details.
- Then a horizontal rule: ---
- Then **Questions for you:** with numbered questions.
- Keep it concise — no walls of text.

PILLAR DERIVATION:
Based on the interview format and weak areas, create 2-4 focused pillars. Examples:
- "SQL Interview Prep" — for data roles with SQL assessments
- "Behavioral & STAR Method" — for behavioral rounds
- "System Design" — for senior/staff technical roles
- "Coding Fundamentals" — for algorithm/data structure rounds
- "Case Study & Product Sense" — for PM or analytics roles
- "Statistics & Probability" — for data science roles
- "Domain Knowledge" — for role-specific knowledge (e.g., marketing analytics, finance)

Be specific to their situation. Don't give everyone the same pillars.

INTENSITY DERIVATION:
- If they say "100%", "full time", "all day", "3+ hours" → "100_percent"
- Otherwise → "adapted" (plan will calibrate to their stated hours)

OUTPUT FORMAT:
When ready, wrap your structured output in:

[INTERVIEW_PREP_COMPLETE]
{
  "target_role": "Data Analyst",
  "company": "Spotify",
  "company_context": "Music streaming platform, data-heavy product decisions...",
  "interview_date": "YYYY-MM-DD",
  "intensity": "100_percent",
  "weak_areas": ["SQL window functions", "behavioral STAR method"],
  "interview_format": "mixed",
  "interview_pillars": [
    {
      "name": "SQL Interview Prep",
      "description": "Focused SQL practice for data analyst interviews",
      "focus_areas": ["window functions", "CTEs", "query optimization", "aggregations"],
      "starting_level": 2
    }
  ],
  "plan_duration_weeks": 2,
  "time_commitment": "60_min_daily"
}
[/INTERVIEW_PREP_COMPLETE]

FIELD RULES:
- target_role: Required. The role they're targeting.
- company: Optional. null if no specific company.
- company_context: Optional. null if no company or user skipped. Short description of the company/product.
- interview_date: Best estimate as YYYY-MM-DD. If they said "2 weeks from now", calculate from today's date. null if truly unknown.
- intensity: "100_percent" or "adapted".
- weak_areas: Array of specific weak spots they mentioned.
- interview_format: "technical", "behavioral", "system_design", "mixed", or "unknown".
- interview_pillars: 2-4 pillars tailored to their needs. Each with name, description, focus_areas array, and starting_level (1-5).
- plan_duration_weeks: 1-3 based on time until interview. Default 2 if unclear.
- time_commitment: Best match from "15_min_daily", "30_min_daily", "60_min_daily", "90_min_daily", "weekend_only". For "100_percent" intensity, default to "90_min_daily" or higher based on what they said.

Include your conversational message BEFORE the [INTERVIEW_PREP_COMPLETE] block.`;

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
      "interview-onboarding",
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
      if (msg.role === "user" && len > 2000) {
        return jsonRes({ error: "Message too long" }, 400);
      }
      if (msg.role === "assistant" && len > 16000) {
        return jsonRes({ error: "Message too long" }, 400);
      }
    }

    // Fetch resume/LinkedIn context if available
    const { data: profile } = await supabase
      .from("user_profile")
      .select("resume_text, linkedin_context, interview_company_context")
      .eq("user_id", userId)
      .maybeSingle();

    const turnCount = (messages || []).filter(
      (m: any) => m.role === "user",
    ).length;
    let systemPrompt = INTERVIEW_ONBOARDING_SYSTEM_PROMPT;
    const todayStr = new Date().toISOString().split("T")[0];
    systemPrompt += `\n\nToday's date is ${todayStr}. Use this to calculate interview_date from relative references like "2 weeks from now".`;

    if (profile?.resume_text) {
      systemPrompt += `\n\nRESUME CONTEXT (use to understand their background and suggest relevant pillars):\n${profile.resume_text.slice(0, 3000)}`;
    }
    if (profile?.linkedin_context) {
      systemPrompt += `\n\nLINKEDIN CONTEXT (use to understand their experience level):\n${profile.linkedin_context.slice(0, 3000)}`;
    }
    if (profile?.interview_company_context) {
      systemPrompt += `\n\nJOB DESCRIPTION / COMPANY CONTEXT (use this to tailor your pillar recommendations and interview prep strategy):\n${profile.interview_company_context.slice(0, 4000)}`;
    }

    if (turnCount >= 5) {
      systemPrompt +=
        "\n\nIMPORTANT: The conversation has gone on long enough. Wrap up and produce the [INTERVIEW_PREP_COMPLETE] output now.";
    }

    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (action === "start") {
      contents.push({
        role: "user",
        parts: [{ text: "I want to set up an interview prep crash course." }],
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
      /\[INTERVIEW_PREP_COMPLETE\]\s*([\s\S]*?)\s*\[\/INTERVIEW_PREP_COMPLETE\]/,
    );

    // Server-side guard: strip premature completion if under minimum turns
    if (completeMatch && turnCount < MIN_USER_TURNS) {
      const strippedContent = fullContent
        .replace(
          /\[INTERVIEW_PREP_COMPLETE\][\s\S]*?\[\/INTERVIEW_PREP_COMPLETE\]/,
          "",
        )
        .trim();
      return jsonRes({
        message:
          strippedContent ||
          "I need a bit more info before building your prep plan. Let's keep going!",
      });
    }

    if (completeMatch) {
      const messageBeforeBlock = fullContent
        .replace(
          /\[INTERVIEW_PREP_COMPLETE\][\s\S]*?\[\/INTERVIEW_PREP_COMPLETE\]/,
          "",
        )
        .trim();

      try {
        const outputs = JSON.parse(completeMatch[1]);
        return jsonRes({
          message: messageBeforeBlock || "Here's your interview prep plan!",
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
