import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {};

// ---------------------------------------------------------------------------
// System prompts by interview type
// ---------------------------------------------------------------------------

const COMMON_RULES = `
INTERVIEW RULES:
- Stay in character as the interviewer at all times. Do not break character to explain, teach, or coach.
- Ask one question at a time. Wait for the answer before asking the next.
- After each answer, briefly acknowledge it (1-2 sentences), then ask a follow-up OR move to the next question.
- Follow-ups should probe for specifics: "Can you quantify that impact?", "What specifically did YOU do vs. the team?", "Walk me through the edge cases."
- Be professional but not robotic. A real interviewer, not a quiz machine.
- Include your final conversational message BEFORE the [INTERVIEW_COMPLETE] block.

COMPLETION:
After your final question has been answered, produce feedback wrapped in:
[INTERVIEW_COMPLETE]
{
  "overall_score": 1-10,
  "strengths": ["specific strength 1", "specific strength 2"],
  "areas_to_improve": ["specific area 1", "specific area 2"],
  "key_mistakes": ["mistake 1", "mistake 2"],
  "question_scores": [
    { "question": "brief question text", "score": 1-10, "note": "brief note" }
  ],
  "suggested_follow_up": "One sentence suggesting what to practice next"
}
[/INTERVIEW_COMPLETE]
`;

function buildSystemPrompt(
  interviewType: string,
  targetRole: string | null,
  companyContext: string | null,
  turnCount: number,
): string {
  const role = targetRole || "the target role";
  const companyLine = companyContext
    ? `\nCOMPANY CONTEXT (tailor questions to this):\n${companyContext}`
    : "";

  let typePrompt: string;

  switch (interviewType) {
    case "behavioral":
      typePrompt = `You are a senior hiring manager conducting a behavioral interview for a ${role} position.

QUESTION STRATEGY:
- Use the STAR method to evaluate answers. Look for: Situation specificity, Task clarity, Action detail, Result impact.
- Ask 5-7 questions total. Mix categories: teamwork, conflict resolution, leadership, failure/learning, achievement, initiative.
- Follow-ups should probe for specifics: "Can you quantify that impact?", "What was YOUR specific contribution vs. the team?"
- Look for red flags: vague answers, inability to name specific examples, taking credit for team work, no metrics.`;
      break;

    case "technical":
    case "sql":
      typePrompt = `You are a technical interviewer testing analytical and SQL skills for a ${role} position.

QUESTION STRATEGY:
- Ask conceptual SQL and data problems one at a time, increasing in difficulty.
- Start with fundamentals (JOINs, GROUP BY, aggregation), move to window functions, CTEs, optimization.
- Ask candidates to describe their approach and walk through their logic step by step.
- Do NOT ask them to write actual code — ask them to explain HOW they'd solve it and what SQL constructs they'd use.
- Include a data modeling or schema design question.
- Ask 4-6 questions total.
- Follow up on edge cases: "What about NULLs?", "How would this perform on a billion rows?", "What index would help here?"`;
      break;

    case "system_design":
      typePrompt = `You are a system design interviewer for a ${role} position.

QUESTION STRATEGY:
- Present ONE system design problem: "Design a..." appropriate for their role and level.
- Guide through the standard framework: requirements gathering → high-level design → component deep dives → trade-offs → scaling.
- Let them drive, but redirect if they go off track or skip important areas.
- Probe trade-offs: "Why this over that?", "What happens if this component fails?", "How would you scale to 10x?"
- Evaluate: communication clarity, systematic thinking, trade-off awareness, depth of knowledge.
- This should feel like 30-45 minutes of structured discussion, not a Q&A quiz.`;
      break;

    case "case_study":
      typePrompt = `You are a product/case study interviewer for a ${role} position.

QUESTION STRATEGY:
- Present ONE case study scenario relevant to the role and company (if known).
- Guide through: problem framing → data/metrics identification → analysis approach → recommendation.
- Ask probing questions: "What data would you need?", "How would you measure success?", "What are the risks?"
- Evaluate: structured thinking, business acumen, data-driven reasoning, communication.
- 3-5 rounds of questions within the case study.`;
      break;

    default:
      typePrompt = `You are conducting a mixed-format interview for a ${role} position.

QUESTION STRATEGY:
- Start with 2-3 behavioral questions (STAR method), then move to 2-3 technical/role-specific questions.
- Adapt your questions based on the role and the candidate's responses.
- Ask 5-7 questions total across both formats.`;
      break;
  }

  let prompt = `${typePrompt}
${companyLine}
${COMMON_RULES}`;

  if (turnCount >= 6) {
    prompt +=
      "\n\nIMPORTANT: The interview has had sufficient exchanges. Wrap up the interview soon and produce the [INTERVIEW_COMPLETE] evaluation after the next answer.";
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Derive interview type from task action text
// ---------------------------------------------------------------------------

function deriveInterviewType(actionText: string): string {
  const lower = actionText.toLowerCase();
  if (lower.includes("behavioral") || lower.includes("star")) return "behavioral";
  if (lower.includes("sql") || lower.includes("technical")) return "technical";
  if (lower.includes("system design")) return "system_design";
  if (lower.includes("case study") || lower.includes("case_study") || lower.includes("product sense")) return "case_study";
  return "behavioral"; // default
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // ---- Rate limit ----
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = await checkRateLimit(supabaseAdmin, userId, ip, "mock-interview", 200);
    if (!rateCheck.allowed) {
      return jsonRes({ error: rateCheck.message }, 429);
    }

    // ---- Parse request ----
    const body = await req.json();
    const { action } = body;

    if (!["start", "continue", "complete"].includes(action)) {
      return jsonRes({ error: "Invalid action. Must be: start, continue, complete" }, 400);
    }

    // ====================================================================
    // ACTION: START
    // ====================================================================
    if (action === "start") {
      const { task_id } = body;
      if (!task_id) {
        return jsonRes({ error: "task_id is required" }, 400);
      }

      // Fetch the plan task to get action text
      const { data: task, error: taskErr } = await supabase
        .from("plan_tasks")
        .select("id, action, plan_block_id")
        .eq("id", task_id)
        .maybeSingle();

      if (taskErr || !task) {
        return jsonRes({ error: "Task not found" }, 404);
      }

      // Fetch user interview context
      const { data: profile } = await supabase
        .from("user_profile")
        .select("interview_target_role, interview_company, interview_company_context")
        .eq("user_id", userId)
        .maybeSingle();

      const interviewType = deriveInterviewType(task.action || "");
      const targetRole = profile?.interview_target_role || null;
      const company = profile?.interview_company || null;
      const companyContext = profile?.interview_company_context || null;

      const systemPrompt = buildSystemPrompt(interviewType, targetRole, companyContext, 0);

      // Call Gemini for the opening question
      const contents = [
        { role: "user", parts: [{ text: "Start the mock interview." }] },
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
            generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
          }),
        },
      );

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return jsonRes({ error: "The AI service is temporarily unavailable due to high demand. Please try again in a few minutes." }, 429);
        }
        const errText = await aiResponse.text();
        throw new Error(`AI API error: ${aiResponse.status} ${errText}`);
      }

      const aiData = await aiResponse.json();
      const aiText: string = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Create mock_interviews row
      const { data: mockRow, error: insertErr } = await supabaseAdmin
        .from("mock_interviews")
        .insert({
          user_id: userId,
          plan_task_id: task_id,
          interview_type: interviewType,
          target_role: targetRole,
          company_context: companyContext
            ? `${company || ""}: ${companyContext}`
            : company || null,
          messages: [{ role: "assistant", content: aiText }],
          status: "in_progress",
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("Error creating mock interview:", insertErr);
        return jsonRes({ error: "Failed to create mock interview session" }, 500);
      }

      return jsonRes({
        mock_id: mockRow.id,
        message: aiText,
        interview_type: interviewType,
      });
    }

    // ====================================================================
    // ACTION: CONTINUE
    // ====================================================================
    if (action === "continue") {
      const { mock_id, message } = body;
      if (!mock_id) {
        return jsonRes({ error: "mock_id is required" }, 400);
      }
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return jsonRes({ error: "message is required" }, 400);
      }
      if (message.length > 2000) {
        return jsonRes({ error: "Message too long (max 2000 characters)" }, 400);
      }

      // Fetch the mock interview row
      const { data: mock, error: mockErr } = await supabaseAdmin
        .from("mock_interviews")
        .select("*")
        .eq("id", mock_id)
        .single();

      if (mockErr || !mock) {
        return jsonRes({ error: "Mock interview not found" }, 404);
      }
      if (mock.user_id !== userId) {
        return jsonRes({ error: "Unauthorized" }, 401);
      }
      if (mock.status !== "in_progress") {
        return jsonRes({ error: "This interview is already completed" }, 400);
      }

      // Build messages array with user's new message
      const existingMessages: { role: string; content: string }[] = mock.messages || [];
      const updatedMessages = [
        ...existingMessages,
        { role: "user", content: message.trim() },
      ];

      // Count user turns for system prompt hints
      const turnCount = updatedMessages.filter((m) => m.role === "user").length;

      // Build Gemini contents
      const contents = updatedMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const systemPrompt = buildSystemPrompt(
        mock.interview_type,
        mock.target_role,
        mock.company_context,
        turnCount,
      );

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
          return jsonRes({ error: "The AI service is temporarily unavailable due to high demand. Please try again in a few minutes." }, 429);
        }
        const errText = await aiResponse.text();
        throw new Error(`AI API error: ${aiResponse.status} ${errText}`);
      }

      const aiData = await aiResponse.json();
      const fullContent: string = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Check for completion
      const completeMatch = fullContent.match(
        /\[INTERVIEW_COMPLETE\]\s*([\s\S]*?)\s*\[\/INTERVIEW_COMPLETE\]/,
      );

      const finalMessages = [
        ...updatedMessages,
        { role: "assistant", content: fullContent },
      ];

      if (completeMatch) {
        try {
          const feedback = JSON.parse(completeMatch[1]);
          const conversational = fullContent
            .replace(/\[INTERVIEW_COMPLETE\][\s\S]*?\[\/INTERVIEW_COMPLETE\]/, "")
            .trim();

          // Calculate duration
          const createdAt = new Date(mock.created_at).getTime();
          const durationMinutes = Math.max(1, Math.round((Date.now() - createdAt) / 60000));

          // Update row as completed
          await supabaseAdmin
            .from("mock_interviews")
            .update({
              messages: finalMessages,
              status: "completed",
              ai_feedback: feedback,
              score: feedback.overall_score || null,
              duration_minutes: durationMinutes,
              completed_at: new Date().toISOString(),
            })
            .eq("id", mock_id);

          return jsonRes({
            message: conversational || "Great interview! Here's your feedback.",
            feedback,
            completed: true,
          });
        } catch {
          // JSON parse failed — treat as normal message
          await supabaseAdmin
            .from("mock_interviews")
            .update({ messages: finalMessages })
            .eq("id", mock_id);

          return jsonRes({ message: fullContent, completed: false });
        }
      }

      // Not complete — save messages and continue
      await supabaseAdmin
        .from("mock_interviews")
        .update({ messages: finalMessages })
        .eq("id", mock_id);

      return jsonRes({ message: fullContent, completed: false });
    }

    // ====================================================================
    // ACTION: COMPLETE (forced early end)
    // ====================================================================
    if (action === "complete") {
      const { mock_id } = body;
      if (!mock_id) {
        return jsonRes({ error: "mock_id is required" }, 400);
      }

      const { data: mock, error: mockErr } = await supabaseAdmin
        .from("mock_interviews")
        .select("*")
        .eq("id", mock_id)
        .single();

      if (mockErr || !mock) {
        return jsonRes({ error: "Mock interview not found" }, 404);
      }
      if (mock.user_id !== userId) {
        return jsonRes({ error: "Unauthorized" }, 401);
      }
      if (mock.status !== "in_progress") {
        return jsonRes({ error: "This interview is already completed" }, 400);
      }

      const existingMessages: { role: string; content: string }[] = mock.messages || [];

      // Build Gemini contents
      const contents = existingMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // Add a final user message to trigger evaluation
      contents.push({
        role: "user",
        parts: [{ text: "I'd like to end the interview here. Please provide your evaluation." }],
      });

      const forcePrompt = buildSystemPrompt(
        mock.interview_type,
        mock.target_role,
        mock.company_context,
        999, // force wrap-up hint
      ) + "\n\nThe candidate has ended the interview early. Based on the conversation so far, provide your evaluation. You MUST include the [INTERVIEW_COMPLETE] block with your feedback.";

      const aiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiApiKey,
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: forcePrompt }] },
            contents,
            generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
          }),
        },
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
        /\[INTERVIEW_COMPLETE\]\s*([\s\S]*?)\s*\[\/INTERVIEW_COMPLETE\]/,
      );

      const createdAt = new Date(mock.created_at).getTime();
      const durationMinutes = Math.max(1, Math.round((Date.now() - createdAt) / 60000));

      let feedback = null;
      let conversational = fullContent;

      if (completeMatch) {
        try {
          feedback = JSON.parse(completeMatch[1]);
          conversational = fullContent
            .replace(/\[INTERVIEW_COMPLETE\][\s\S]*?\[\/INTERVIEW_COMPLETE\]/, "")
            .trim() || "Thanks for the interview. Here's your feedback.";
        } catch {
          // JSON parse failed — build minimal feedback
          feedback = {
            overall_score: 5,
            strengths: ["Attempted the interview"],
            areas_to_improve: ["Interview ended early — practice completing full mock sessions"],
            key_mistakes: [],
            question_scores: [],
            suggested_follow_up: "Try completing a full mock interview next time.",
          };
        }
      } else {
        // AI didn't include the tag — build minimal feedback
        feedback = {
          overall_score: 5,
          strengths: ["Attempted the interview"],
          areas_to_improve: ["Interview ended early — practice completing full mock sessions"],
          key_mistakes: [],
          question_scores: [],
          suggested_follow_up: "Try completing a full mock interview next time.",
        };
      }

      const finalMessages = [
        ...existingMessages,
        { role: "assistant", content: fullContent },
      ];

      await supabaseAdmin
        .from("mock_interviews")
        .update({
          messages: finalMessages,
          status: "completed",
          ai_feedback: feedback,
          score: feedback.overall_score || null,
          duration_minutes: durationMinutes,
          completed_at: new Date().toISOString(),
        })
        .eq("id", mock_id);

      return jsonRes({
        message: conversational,
        feedback,
        completed: true,
      });
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error(err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
