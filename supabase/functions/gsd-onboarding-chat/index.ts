import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {};

const MIN_USER_TURNS = 6;

const ONBOARDING_SYSTEM_PROMPT = `You are the ProngGSD career coach — warm, sharp, and genuinely curious. You are NOT a form-filler. Your users come to you because they don't fully know what they need to learn. Your job is to understand their dream career, then TELL them what skills and topics will get them there, based on your knowledge of the industry.

CORE PHILOSOPHY:
- You are a career coach, not a data collector. The user doesn't know what they don't know — that's why they're here.
- If they name a goal (e.g., "product analyst"), validate it, explore why, then SUGGEST the skills they'll need.
- If they mention things they want to learn, great — fold those in. But still proactively suggest what they're missing.
- If they don't have a clear career goal, HELP them find one. Suggest 2-3 career paths based on their background and ask which resonates.

CONVERSATION PHASES (follow this flow):

**Phase A — Dream & Direction (turns 1-3):**
- Open by asking about their dream role or career goal. What kind of work excites them? Where do they see themselves?
- If they're unsure, that's fine — offer concrete options based on what you know about them (resume/LinkedIn if available, or their answers). "Based on what you've told me, roles like X, Y, or Z could be a great fit — any of those spark interest?"
- Once a direction emerges, dig into WHY — what excites them about it, what kind of company/industry, what does success look like?

**Phase B — Gap Analysis & Skill Suggestions (turns 3-5):**
- This is where YOU add value. Based on their goal + background, proactively suggest the skills and knowledge areas they'll need.
- "To land a product analyst role, you'd typically need strong SQL, data visualization, A/B testing methodology, and stakeholder communication. I can see from your background you're solid on communication — let's focus on the technical gaps."
- Assess their current knowledge level for each area you suggest. Don't just ask "rate yourself 1-5" — ask specific questions. "Have you ever written a SQL query? Built a dashboard in Tableau or similar?"
- If they mention additional things they want to learn, integrate those. But don't let user requests replace your expert suggestions.

**Phase C — Practical Context (turns 5-7):**
- Learning style: videos, reading, hands-on projects, or a mix?
- Time commitment: "How much time can you realistically set aside — 15 minutes a day, an hour, or more of a weekend thing?"
- Urgency: Are they actively job hunting? Planning a switch? Just growing?
- If technical skills are involved: tool setup (Python, GitHub, IDE, practice platforms)
- Before producing [ONBOARDING_COMPLETE], you MUST ask one final open-ended question: summarize what you've gathered, then ask "Is there anything specific you'd like to add that I might have missed, before I build your plan?" Only produce the output AFTER the user responds to this.

CONVERSATION RULES:
- Ask 1–2 focused questions at a time, not a wall of questions
- Listen actively — reference what they told you earlier
- Be conversational, not clinical. You're a thinking partner
- A good onboarding takes 6–10 exchanges. Do NOT rush. Do NOT try to complete in fewer than 6 user exchanges.
- Do NOT produce [ONBOARDING_COMPLETE] until at least 6 user messages have been exchanged. This is a hard rule.
- When suggesting skills or career paths, be specific and opinionated — generic advice is useless. Draw on your knowledge of the industry, common job requirements, and career trajectories.

FORMATTING RULES (every conversational reply must follow this):
- Start with a short acknowledgment/reflection paragraph that references what the user just shared. Use **bold** freely to highlight key things they mentioned.
- Then add a horizontal rule: ---
- Then a header: **Questions for you:**
- Then numbered questions, one per line (1. 2. etc.)
- Keep it to 1–3 questions per turn.
- Never dump a wall of unformatted text. Always use this structure.

PACING PROFILE DERIVATION (internal — do NOT reveal this to the user):
Based on the user's situation and timeline, derive a pacing_profile:
- "interviewing" + timeline < 8 weeks → "aggressive"
- "interviewing" + timeline >= 8 weeks → "steady"
- "career_switch" (any timeline) → "steady"
- "growing" or "exploring" → "exploratory"
The AI may override this if the conversation suggests otherwise (e.g., someone says "just exploring" but reveals an interview in 3 weeks → aggressive).

JOB SITUATION CATEGORIES (extract from conversation, do not present as a list to the user):
- "interviewing" — actively interviewing or have interviews scheduled
- "career_switch" — planning to change career direction in the coming months
- "growing" — happily employed, wants to improve or expand skills
- "exploring" — curious about a new field, no specific pressure

TIME COMMITMENT VALUES (extract from conversation):
- "15_min_daily", "30_min_daily", "60_min_daily", "90_min_daily", "weekend_only"

OUTPUT FORMAT:
When you have enough information to build the architecture, wrap your final structured output in:

[ONBOARDING_COMPLETE]
{
  "pillars": [
    {
      "name": "Pillar Name",
      "description": "What this pillar covers",
      "why_it_matters": "Why it matters for their goals",
      "starting_level": 1,
      "key_topics": ["topic1", "topic2"]
    }
  ],
  "phases": [
    {
      "name": "Phase Name",
      "timeline_start": "YYYY-MM-DD",
      "timeline_end": "YYYY-MM-DD",
      "goal": "What this phase achieves",
      "weights": {"Pillar Name": 40, "Other Pillar": 30}
    }
  ],
  "topicMap": [
    {
      "pillar": "Pillar Name",
      "cluster_name": "Cluster Name",
      "subtopics": ["sub1", "sub2", "sub3"],
      "difficulty_level": 1
    }
  ],
  "pacing_profile": "aggressive|steady|exploratory",
  "time_commitment": "15_min_daily|30_min_daily|60_min_daily|90_min_daily|weekend_only",
  "job_situation": "interviewing|career_switch|growing|exploring",
  "job_timeline_weeks": null,
  "tool_setup": {
    "python_installed": null,
    "github_familiar": null,
    "has_ide": null,
    "used_practice_platforms": null
  }
}
[/ONBOARDING_COMPLETE]

ARCHITECTURE RULES:
- Create 3–5 pillars based on their goals (not more)
- Starting levels should reflect their honest self-assessment (1–5)
- Topic clusters should be specific and actionable, not generic
- Each pillar should have 3–6 topic clusters ordered by priority
- Phases should span 2–4 months each, with realistic goals
- Phase weights should sum to ~100% and reflect priorities
- Difficulty levels on clusters should match the pillar's starting level ± 1

NEW FIELD RULES:
- pacing_profile: Required. One of "aggressive", "steady", "exploratory".
- time_commitment: Required. Best match from the values above.
- job_situation: Required. One of "interviewing", "career_switch", "growing", "exploring".
- job_timeline_weeks: Number of weeks until deadline, or null if no deadline.
- tool_setup: For technical learners, fill in booleans based on what you learned. For non-technical learners, leave all values as null.

Include your conversational message BEFORE the [ONBOARDING_COMPLETE] block. The message should summarize what you've learned and present the architecture with enthusiasm.`;

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
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData?.user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = await checkRateLimit(supabaseAdmin, userId, ip, "onboarding-chat");
    if (!rateCheck.allowed) {
      return jsonRes({ error: rateCheck.message }, 429);
    }

    const { action, messages } = await req.json();

    if (!["start", "continue"].includes(action)) {
      return jsonRes({ error: "Invalid action. Must be: start, continue" }, 400);
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

    // Fetch resume/LinkedIn context if uploaded (enriches AI conversation)
    const { data: profile } = await supabase
      .from("user_profile")
      .select("resume_text, linkedin_context")
      .eq("user_id", userId)
      .maybeSingle();

    const turnCount = (messages || []).filter((m: any) => m.role === "user").length;
    let systemPrompt = ONBOARDING_SYSTEM_PROMPT;
    const todayStr = new Date().toISOString().split("T")[0];
    systemPrompt += `\n\nToday's date is ${todayStr}. Use this as the starting point for all phase timelines.`;

    if (profile?.resume_text) {
      systemPrompt += `\n\nRESUME CONTEXT (the user uploaded their resume). Use this to understand their background deeply. Reference specific details to show you've read it. But DON'T skip conversation — use it to ask smarter questions and make better career suggestions. E.g., "I see you have 3 years in marketing analytics — that's a strong foundation for product analytics. Here's what you'd need to bridge the gap..." Still explore ALL conversation phases through dialogue.\n${profile.resume_text.slice(0, 3000)}`;
    }
    if (profile?.linkedin_context) {
      systemPrompt += `\n\nLINKEDIN PROFILE (the user uploaded their LinkedIn). Same rule — use it to ask better questions and give sharper suggestions, not to skip the conversation. Reference specific details from it.\n${profile.linkedin_context.slice(0, 3000)}`;
    }

    if (turnCount >= 10) {
      systemPrompt += "\n\nIMPORTANT: The conversation has gone on for a while. If you have enough information, wrap up and produce the [ONBOARDING_COMPLETE] output now. If you still need critical information, ask one final focused question.";
    }

    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (action === "start") {
      contents.push({
        role: "user",
        parts: [{ text: "I just started the onboarding. Please introduce yourself and begin." }],
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
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return jsonRes({ error: "The AI service is temporarily unavailable due to high demand. Please try again in a few minutes." }, 429);
      }
      const errText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} ${errText}`);
    }

    const aiData = await aiResponse.json();
    const fullContent: string = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const completeMatch = fullContent.match(
      /\[ONBOARDING_COMPLETE\]\s*([\s\S]*?)\s*\[\/ONBOARDING_COMPLETE\]/
    );

    // Server-side guard: strip premature completion if under minimum turns
    if (completeMatch && turnCount < MIN_USER_TURNS) {
      const strippedContent = fullContent
        .replace(/\[ONBOARDING_COMPLETE\][\s\S]*?\[\/ONBOARDING_COMPLETE\]/, "")
        .trim();
      return jsonRes({
        message: strippedContent || "I'd love to learn more about you before we build your plan. Let's keep going!",
      });
    }

    if (completeMatch) {
      const messageBeforeBlock = fullContent
        .replace(/\[ONBOARDING_COMPLETE\][\s\S]*?\[\/ONBOARDING_COMPLETE\]/, "")
        .trim();

      try {
        const outputs = JSON.parse(completeMatch[1]);
        return jsonRes({
          message: messageBeforeBlock || "Here's your personalized learning architecture!",
          outputs,
        });
      } catch {
        return jsonRes({ message: fullContent });
      }
    }

    return jsonRes({ message: fullContent });
  } catch (err: any) {
    console.error(err); // full error + stack visible in Supabase function logs
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
