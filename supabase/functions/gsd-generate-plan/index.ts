import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_COMMITMENT_MINUTES: Record<string, number> = {
  "15_min_daily": 15,
  "30_min_daily": 30,
  "60_min_daily": 60,
  "90_min_daily": 90,
  weekend_only: 120,
};

const TOKEN_BUDGET: Record<number, number> = {
  5: 800,
  10: 1200,
  15: 1800,
  30: 3000,
  45: 4000,
  60: 5000,
  90: 5000,
  120: 5000,
};

const PACING_WEEKS: Record<string, [number, number]> = {
  aggressive: [4, 8],
  steady: [8, 12],
  exploratory: [12, 16],
  intensive: [1, 3],
};

const PACING_TASKS: Record<string, [number, number]> = {
  aggressive: [4, 6],
  steady: [3, 4],
  exploratory: [2, 3],
  intensive: [5, 8],
};

const PACING_TONE: Record<string, string> = {
  aggressive:
    'Direct and urgent. "You need this for interviews." Push for action.',
  steady:
    'Encouraging and milestone-focused. "Great progress — here\'s your next step."',
  exploratory:
    'Relaxed and curiosity-driven. "Explore this when you feel like it."',
  intensive:
    'High-pressure sprint. "Interview is coming. Every hour counts. Do this NOW." No fluff.',
  sprint:
    'Focused and encouraging. "Deep dive time — master this before moving on." Celebrate depth over breadth.',
};

// Sprint unit counts based on time commitment
const SPRINT_UNITS: Record<string, [number, number]> = {
  light: [6, 8], // ~15-30min/day commitment
  moderate: [8, 12], // ~60min/day
  intensive: [10, 15], // ~90min+/day
};

function getSprintIntensity(dailyMinutes: number): string {
  if (dailyMinutes <= 30) return "light";
  if (dailyMinutes <= 60) return "moderate";
  return "intensive";
}

// Maps pillar name keywords → curated_resources skill_area values
const SKILL_AREA_MAP: Record<string, string[]> = {
  sql: ["sql_basics", "sql_intermediate", "sql_advanced"],
  python: ["python_basics", "python_data"],
  interview: ["interview_technical", "interview_behavioral"],
  data: ["python_data", "data_viz"],
  visualization: ["data_viz"],
  coding: ["general_coding"],
  github: ["general_coding"],
  programming: ["general_coding"],
  behavioral: ["interview_behavioral", "interview_behavioral_prep"],
  star: ["interview_behavioral_prep"],
  system: ["interview_system_design"],
  design: ["interview_system_design"],
  statistics: ["interview_stats"],
  probability: ["interview_stats"],
  stats: ["interview_stats"],
  mock: ["interview_mock_external"],
};

// skill_area suffixes that imply level ranges
const LEVEL_TIERS: Record<string, [number, number]> = {
  _basics: [1, 2],
  _intermediate: [2, 4],
  _advanced: [3, 5],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDifficultyContext(params: BlockParams): string {
  let ctx = "";
  if (params.difficultyAdjustment === "harder") {
    ctx +=
      "\n\nDIFFICULTY ADJUSTMENT: The learner found the previous block too easy. Increase complexity, use more challenging exercises and intermediate/advanced resources.";
  } else if (params.difficultyAdjustment === "easier") {
    ctx +=
      "\n\nDIFFICULTY ADJUSTMENT: The learner found the previous block too hard. Simplify tasks, add more scaffolding, include beginner-friendly resources and more explanation.";
  }
  if (params.feedbackContext) {
    ctx += `\n\nLEARNER FEEDBACK FROM LAST BLOCK: ${params.feedbackContext}`;
  }
  return ctx;
}

function parseTimeCommitment(profile: any): number {
  // Prefer explicit hours_per_day if available (crash courses)
  if (profile?.hours_per_day && profile.hours_per_day > 0) {
    return Math.round(profile.hours_per_day * 60);
  }
  if (
    profile?.time_commitment &&
    TIME_COMMITMENT_MINUTES[profile.time_commitment]
  ) {
    return TIME_COMMITMENT_MINUTES[profile.time_commitment];
  }
  return profile?.daily_time_commitment || 20;
}

function getMaxTokens(dailyTime: number): number {
  const keys = Object.keys(TOKEN_BUDGET)
    .map(Number)
    .sort((a, b) => a - b);
  for (const k of keys) {
    if (dailyTime <= k) return TOKEN_BUDGET[k];
  }
  return 5000;
}

function parseJSON(text: string): any {
  let cleaned = text.trim();
  // Strip markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting from first { to last }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Gemini API wrapper
// ---------------------------------------------------------------------------

async function callGemini(
  geminiApiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
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
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      }),
    },
  );

  if (!aiResponse.ok) {
    if (aiResponse.status === 429) {
      throw Object.assign(
        new Error(
          "The AI service is temporarily unavailable due to high demand. Please try again in a few minutes.",
        ),
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
// Resource matching
// ---------------------------------------------------------------------------

function mapSkillAreas(pillarName: string, pillarLevel: number): string[] {
  const words = pillarName.toLowerCase().split(/[\s\-_,&]+/);
  const allAreas = new Set<string>();

  for (const word of words) {
    const mapped = SKILL_AREA_MAP[word];
    if (mapped) mapped.forEach((a) => allAreas.add(a));
  }

  if (allAreas.size === 0) return [];

  // Filter by level tier
  return [...allAreas].filter((area) => {
    for (const [suffix, [min, max]] of Object.entries(LEVEL_TIERS)) {
      if (area.endsWith(suffix)) {
        return pillarLevel >= min && pillarLevel <= max;
      }
    }
    // Non-tiered areas always included
    return true;
  });
}

async function fetchResourcesForPillar(
  supabaseAdmin: any,
  pillarName: string,
  pillarLevel: number,
): Promise<any[]> {
  const skillAreas = mapSkillAreas(pillarName, pillarLevel);
  if (skillAreas.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("curated_resources")
    .select("*")
    .in("skill_area", skillAreas)
    .lte("min_level", pillarLevel)
    .gte("max_level", pillarLevel);

  if (error) {
    console.error("Error fetching curated resources:", error);
    return [];
  }
  return data || [];
}

// ---------------------------------------------------------------------------
// Match pillar names from AI output back to actual pillar IDs
// ---------------------------------------------------------------------------

function matchPillarByName(aiName: string, pillars: any[]): any | null {
  const normalized = aiName.toLowerCase().trim();
  // Exact match first
  const exact = pillars.find((p) => p.name.toLowerCase().trim() === normalized);
  if (exact) return exact;
  // Substring match
  const sub = pillars.find(
    (p) =>
      normalized.includes(p.name.toLowerCase().trim()) ||
      p.name.toLowerCase().trim().includes(normalized),
  );
  return sub || null;
}

// ---------------------------------------------------------------------------
// Full plan generation (outline + week 1 blocks)
// ---------------------------------------------------------------------------

async function generateOutline(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  geminiApiKey: string,
  planType: string = "learning",
): Promise<{ plan_id: string; total_weeks: number; warnings: string[] }> {
  const warnings: string[] = [];

  // Fetch all context
  const [profileRes, pillarsRes, phasesRes] = await Promise.all([
    supabase
      .from("user_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("pillars")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("phases")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order"),
  ]);

  const profile = profileRes.data;
  const pillars = pillarsRes.data || [];
  const phases = phasesRes.data || [];

  if (pillars.length === 0) {
    throw Object.assign(
      new Error("No pillars found. Complete onboarding first."),
      { status: 400 },
    );
  }

  // Fetch topic maps for all pillars
  const pillarIds = pillars.map((p: any) => p.id);
  const { data: topicMaps } = await supabase
    .from("topic_map")
    .select("*")
    .in("pillar_id", pillarIds)
    .order("priority_order");

  const pacingProfile = profile?.pacing_profile || "steady";
  const dailyMinutes = parseTimeCommitment(profile);
  const [minWeeks, maxWeeks] = PACING_WEEKS[pacingProfile] || [8, 12];

  // Build pillar summaries for AI
  const pillarSummaries = pillars
    .map((p: any) => {
      const clusters = (topicMaps || []).filter(
        (t: any) => t.pillar_id === p.id,
      );
      return `- ${p.name} (level ${p.current_level}/5): ${p.description || ""}
    Topics: ${clusters.map((c: any) => `${c.cluster_name} [${c.subtopics?.join(", ") || ""}]`).join("; ")}`;
    })
    .join("\n");

  const phaseSummary =
    phases.length > 0
      ? phases
          .map(
            (ph: any) =>
              `- ${ph.name}: ${ph.goal || ""} (${ph.timeline_start} to ${ph.timeline_end})`,
          )
          .join("\n")
      : "No phases defined.";

  // Build optional context
  let extraContext = "";
  if (profile?.resume_text) {
    extraContext += `\n\nRESUME CONTEXT:\n${profile.resume_text.slice(0, 3000)}`;
  }
  if (profile?.linkedin_context) {
    extraContext += `\n\nLINKEDIN CONTEXT:\n${profile.linkedin_context.slice(0, 3000)}`;
  }

  const jobContext = profile?.job_situation
    ? `Job situation: ${profile.job_situation}${profile.job_timeline_weeks ? `, deadline in ${profile.job_timeline_weeks} weeks` : ""}`
    : "";

  const systemPrompt = `You are ProngGSD, an AI learning plan architect. Given the learner's profile, pillars, and topic map, generate a multi-week learning plan outline.

LEARNER PROFILE:
- Pacing: ${pacingProfile}
- Time commitment: ${dailyMinutes} minutes/day
- ${jobContext || "No specific job deadline."}

PILLARS:
${pillarSummaries}

PHASES:
${phaseSummary}
${extraContext}

PLAN STRUCTURE RULES:
- Target ${minWeeks}–${maxWeeks} weeks total. Shorter if the user's goals are focused, longer if broad.
- Start with the highest-priority pillar first. Do NOT activate all pillars in week 1.
- Stagger pillar introductions — introduce new pillars every 2–3 weeks.
- Each week should have 1–3 active pillars, not more.
- Earlier weeks focus on foundational topics (lower difficulty clusters).
- Use the topic clusters to decide what each week covers.
- If the user has a deadline of N weeks, the plan must fit within N weeks.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "total_weeks": <number>,
  "weeks": [
    {
      "week_number": 1,
      "pillars": [
        {
          "pillar_name": "exact pillar name",
          "weekly_goal": "specific goal for this pillar this week",
          "difficulty": 1
        }
      ]
    }
  ]
}`;

  const userPrompt = "Generate the learning plan outline for this learner.";

  let rawText = await callGemini(geminiApiKey, systemPrompt, userPrompt, 4000);
  let outline: any;
  try {
    outline = parseJSON(rawText);
  } catch {
    // Retry once with stricter instruction
    rawText = await callGemini(
      geminiApiKey,
      systemPrompt +
        "\n\nCRITICAL: Respond with raw JSON only. No markdown, no commentary, no code fences.",
      userPrompt,
      4000,
    );
    outline = parseJSON(rawText);
  }

  // Validate and enrich with pillar IDs
  if (!outline.total_weeks || !Array.isArray(outline.weeks)) {
    throw new Error("AI returned invalid plan outline structure");
  }

  for (const week of outline.weeks) {
    if (!Array.isArray(week.pillars)) continue;
    for (const wp of week.pillars) {
      const matched = matchPillarByName(wp.pillar_name, pillars);
      if (matched) {
        wp.pillar_id = matched.id;
      } else {
        warnings.push(
          `Week ${week.week_number}: pillar "${wp.pillar_name}" not found in DB, skipping.`,
        );
      }
    }
    // Remove unmatched pillars
    week.pillars = week.pillars.filter((wp: any) => wp.pillar_id);
  }

  // Remove empty weeks
  outline.weeks = outline.weeks.filter(
    (w: any) => w.pillars && w.pillars.length > 0,
  );
  if (outline.weeks.length === 0) {
    throw new Error(
      "AI plan outline matched zero pillars to the user's actual pillars.",
    );
  }
  outline.total_weeks = outline.weeks.length;

  // Deactivate any existing active plan of the same type
  await supabaseAdmin
    .from("learning_plans")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("plan_type", planType);

  // Insert new plan
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("learning_plans")
    .insert({
      user_id: userId,
      total_weeks: outline.total_weeks,
      pacing_profile: pacingProfile,
      plan_outline: outline,
      is_active: true,
      plan_type: planType,
    })
    .select()
    .single();

  if (planErr) throw planErr;

  // Generate week 1 plan blocks
  const week1 =
    outline.weeks.find((w: any) => w.week_number === 1) || outline.weeks[0];
  const activePillarCount = week1.pillars.length;

  for (const wp of week1.pillars) {
    try {
      await generateBlock(supabase, supabaseAdmin, geminiApiKey, {
        userId,
        planId: plan.id,
        weekNumber: wp.week_number || 1,
        pillarId: wp.pillar_id,
        pillarName: wp.pillar_name,
        weeklyGoal: wp.weekly_goal,
        profile,
        activePillarCount,
      });
    } catch (err: any) {
      console.error(`Block gen failed for pillar ${wp.pillar_name}:`, err);
      warnings.push(
        `Failed to generate week 1 block for "${wp.pillar_name}": ${err.message}`,
      );
    }
  }

  // Initialize user_progress (upsert)
  const { data: existingProgress } = await supabaseAdmin
    .from("user_progress")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingProgress) {
    await supabaseAdmin
      .from("user_progress")
      .update({
        current_day: 1,
        current_streak: 0,
        total_tasks_completed: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingProgress.id);
  } else {
    await supabaseAdmin.from("user_progress").insert({
      user_id: userId,
      current_day: 1,
      current_streak: 0,
      longest_streak: 0,
      total_tasks_completed: 0,
    });
  }

  return { plan_id: plan.id, total_weeks: outline.total_weeks, warnings };
}

// ---------------------------------------------------------------------------
// Plan block generation (single week + pillar)
// ---------------------------------------------------------------------------

interface BlockParams {
  userId: string;
  planId: string;
  weekNumber: number;
  pillarId: string;
  pillarName?: string;
  weeklyGoal: string;
  profile?: any;
  activePillarCount?: number;
  difficultyAdjustment?: "harder" | "easier" | "same";
  feedbackContext?: string;
  planType?: "learning" | "interview_prep";
  planFormat?: "weekly" | "sprint";
  sprintUnitCount?: number;
}

async function generateBlock(
  supabase: any,
  supabaseAdmin: any,
  geminiApiKey: string,
  params: BlockParams,
): Promise<{ block_id: string }> {
  const { userId, planId, weekNumber, pillarId, weeklyGoal } = params;

  // Fetch context if not passed
  const profile =
    params.profile ||
    (
      await supabase
        .from("user_profile")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
    ).data;

  const { data: pillar } = await supabase
    .from("pillars")
    .select("*")
    .eq("id", pillarId)
    .maybeSingle();
  const pillarName = params.pillarName || pillar?.name || "Unknown";
  const pillarLevel = pillar?.current_level || 1;

  // Fetch topic map for this pillar
  const { data: topicClusters } = await supabase
    .from("topic_map")
    .select("*")
    .eq("pillar_id", pillarId)
    .order("priority_order");

  // Fetch curated resources
  const resources = await fetchResourcesForPillar(
    supabaseAdmin,
    pillarName,
    pillarLevel,
  );

  // Fetch previous blocks for continuity
  const { data: prevBlocks } = await supabase
    .from("plan_blocks")
    .select("title, weekly_goal, week_number")
    .eq("plan_id", planId)
    .eq("pillar_id", pillarId)
    .order("week_number");

  // Check if this is the first block for this pillar
  const isFirstBlock = !prevBlocks || prevBlocks.length === 0;

  // For interview/crash course plans, always use intensive pacing
  const isInterviewPlan = params.planType === "interview_prep";
  const isSprint = params.planFormat === "sprint";
  const blockLabel = isSprint ? "sprint" : "week";
  const unitLabel = isSprint ? "practice units" : "tasks";
  const pacingProfile = isSprint
    ? "sprint"
    : isInterviewPlan
      ? "intensive"
      : profile?.pacing_profile || "steady";
  const dailyMinutes = isInterviewPlan
    ? profile.interview_intensity === "100_percent"
      ? profile?.hours_per_day
        ? Math.round(profile.hours_per_day * 60)
        : 360
      : parseTimeCommitment(profile)
    : parseTimeCommitment(profile);
  const activePillars = params.activePillarCount || 1;
  const minutesForThisPillar = Math.round(dailyMinutes / activePillars);
  const daysPerWeek =
    isInterviewPlan && profile?.days_per_week ? profile.days_per_week : 5;
  const weeklyBudget = isSprint
    ? minutesForThisPillar * 10 // Sprint budget: ~10 practice days
    : minutesForThisPillar * daysPerWeek;

  let minTasks: number, maxTasks: number;
  if (isSprint && params.sprintUnitCount) {
    // Sprint: use the unit count from the sprint outline
    minTasks = params.sprintUnitCount;
    maxTasks = params.sprintUnitCount;
  } else if (isSprint) {
    const intensity = getSprintIntensity(dailyMinutes);
    [minTasks, maxTasks] = SPRINT_UNITS[intensity];
  } else {
    [minTasks, maxTasks] = PACING_TASKS[pacingProfile] || [3, 4];
  }

  // Build resource list for prompt
  const resourceList =
    resources.length > 0
      ? resources
          .map(
            (r: any) =>
              `- ${r.title} (${r.platform}, ${r.resource_type}): ${r.url}${r.description ? ` — ${r.description}` : ""}`,
          )
          .join("\n")
      : "No curated resources available for this skill area. Generate search queries for all tasks.";

  const prevBlocksSummary =
    prevBlocks && prevBlocks.length > 0
      ? prevBlocks
          .map(
            (b: any) =>
              `- ${isSprint ? "Sprint" : "Week"} ${b.week_number}: ${b.title} — ${b.weekly_goal}`,
          )
          .join("\n")
      : `First ${blockLabel} for this pillar.`;

  // Build tool_setup context for level 1 primers
  let setupContext = "";
  if (pillarLevel === 1 && profile?.tool_setup) {
    const ts = profile.tool_setup;
    const items: string[] = [];
    if (ts.python_installed === false)
      items.push("does NOT have Python installed");
    if (ts.python_installed === true) items.push("has Python installed");
    if (ts.github_familiar === false) items.push("is NOT familiar with GitHub");
    if (ts.github_familiar === true) items.push("is familiar with GitHub");
    if (ts.has_ide === false) items.push("does NOT have a code editor/IDE");
    if (ts.has_ide === true) items.push("has a code editor/IDE");
    if (ts.used_practice_platforms === false)
      items.push("has NOT used practice platforms like HackerRank");
    if (ts.used_practice_platforms === true)
      items.push("has used practice platforms");
    if (items.length > 0) {
      setupContext = `\n\nSETUP CONTEXT: The learner ${items.join(", ")}. Include any necessary setup steps in the first tasks and in the context_brief.`;
    }
  }

  // Build optional resume/linkedin context
  let extraContext = "";
  if (profile?.resume_text) {
    extraContext += `\n\nRESUME CONTEXT (use to personalize):\n${profile.resume_text.slice(0, 2000)}`;
  }
  if (profile?.linkedin_context) {
    extraContext += `\n\nLINKEDIN CONTEXT (use to personalize):\n${profile.linkedin_context.slice(0, 2000)}`;
  }

  const firstBlockInstruction = isFirstBlock
    ? `\n\nThis is the learner's FIRST ${blockLabel} with the "${pillarName}" pillar. In context_brief, include:
- What this skill/pillar is about in plain language
- Why it matters for their specific goals
- Practical setup instructions if needed (based on their tool setup)
- End with: "This primer is just context. The real learning happens when you start the ${unitLabel} below."`
    : "";

  const systemPrompt = `You are ProngGSD, generating a detailed ${isSprint ? "sprint practice block" : "weekly plan block"} for a learner.

LEARNER: ${pacingProfile} pacing, ${minutesForThisPillar} minutes/day for this pillar, level ${pillarLevel}/5
PILLAR: ${pillarName} — ${pillar?.description || ""}
WEEKLY GOAL: ${weeklyGoal}

TOPIC CLUSTERS FOR THIS PILLAR:
${(topicClusters || []).map((c: any) => `- ${c.cluster_name}: ${c.subtopics?.join(", ") || "no subtopics"} (difficulty ${c.difficulty_level})`).join("\n")}

PREVIOUS WEEKS FOR THIS PILLAR:
${prevBlocksSummary}

AVAILABLE CURATED RESOURCES (use these URLs when they match):
${resourceList}

TONE: ${PACING_TONE[pacingProfile] || PACING_TONE.steady}
${setupContext}${firstBlockInstruction}${extraContext}${buildDifficultyContext(params)}

TASK RULES:
- Generate ${minTasks === maxTasks ? `exactly ${minTasks}` : `${minTasks}–${maxTasks}`} ${unitLabel}.${isSprint ? `\n- This is a SPRINT block — each unit should be completable in one practice session (~${minutesForThisPillar} minutes). The learner does these at their own pace (1-2 per day).` : ""}
- ${isSprint ? "Sprint" : "Weekly"} time budget is approximately ${weeklyBudget} minutes (${minutesForThisPillar} min/day${isSprint ? "" : `, ${daysPerWeek} days/week`}), but this is a GUIDELINE — quality matters more than fitting a budget.
- Estimate each task INDIVIDUALLY based on what the resource actually requires:
  * YouTube videos/lectures: estimate the ACTUAL video length. A deep-dive lecture is 60–120 min, a tutorial 15–30 min. Do NOT compress to fit the daily budget.
  * Hands-on practice (drills, exercises, coding challenges): 20–60 min depending on complexity.
  * Reading (articles, docs, guides): 15–30 min.
  * Mock interviews: 20–40 min.
  * Setup/installation tasks: 15–30 min.
- A single task CAN exceed the daily per-pillar budget. If a resource genuinely takes 90 minutes, say 90 minutes. The learner will adjust their day.
- It is BETTER to have fewer tasks with accurate estimates than many tasks with artificially low estimates.
- Use curated resource URLs when they match. Set resource_type to "curated" and provide the url.
- When no curated resource fits, set resource_type to "search_query", url to null, and provide a specific search_query.
- For mock interview practice tasks, set resource_type to "mock_interview", platform to "ProngGSD", url to null, search_query to null. Action should describe the interview type with a "MOCK:" prefix (e.g., "MOCK: Behavioral interview — STAR method practice", "MOCK: SQL mock — window functions and CTEs"). These are handled in-app.
- Each task should be concrete and completable in one sitting.
- Include a healthy mix: hands-on practice (exercises, challenges), reading (docs, articles), AND video content (YouTube lectures, talks, tutorials).
- For conceptual, theory, or lecture-style tasks, generate YouTube-specific search queries (prefix with "youtube: "). E.g., "youtube: Stanford CS229 introduction to machine learning lecture" or "youtube: Andrej Karpathy LLM explained". Be specific — name known educators, universities, or channels when relevant to the topic.
- For hands-on practice tasks, keep using platform-specific resources or general search queries.
- The "why_text" should connect the task to their goals and explain the learning value.
${pacingProfile === "intensive" ? '- PACING NOTE: Write a short motivational message about their deadline or goal. Focus on urgency and encouragement — reference their target company or role if known. Do NOT mention time budgets or minutes per day. Examples: "Your interview is around the corner — nail this block and you\'ll walk in confident.", "Every rep here is one less surprise in the real interview. Push through."' : pacingProfile === "sprint" ? '- PACING NOTE: Write an encouraging note about deep-diving into this pillar. Emphasize depth over breadth. Example: "This sprint is all about mastering the fundamentals — take your time with each unit and build real understanding."' : "- PACING NOTE: Write a brief note about the learner's pace and what to focus on this week."}

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "title": "Block title",
  "weekly_goal": "Refined weekly goal",
  "context_brief": "2-4 sentence context for the learner",
  "tasks": [
    {
      "task_order": 1,
      "action": "Specific action description",
      "platform": "Platform name",
      "resource_type": "curated",
      "url": "https://...",
      "search_query": null,
      "estimated_time_minutes": 45,
      "why_text": "Why this task matters"
    },
    {
      "task_order": 2,
      "action": "MOCK: Behavioral interview — STAR method practice",
      "platform": "ProngGSD",
      "resource_type": "mock_interview",
      "url": null,
      "search_query": null,
      "estimated_time_minutes": 30,
      "why_text": "Practicing under pressure reveals gaps before the real interview."
    }
  ],
  "pacing_note": "Brief pacing/motivational note for the learner",
  "completion_criteria": "How to know when this block is done"
}`;

  const userPrompt = isSprint
    ? `Generate the sprint ${weekNumber} practice block for the "${pillarName}" pillar with the goal: "${weeklyGoal}"`
    : `Generate the week ${weekNumber} plan block for the "${pillarName}" pillar with the goal: "${weeklyGoal}"`;

  const maxTokens = getMaxTokens(minutesForThisPillar);

  let rawText = await callGemini(
    geminiApiKey,
    systemPrompt,
    userPrompt,
    maxTokens,
  );
  let block: any;
  try {
    block = parseJSON(rawText);
  } catch {
    // Retry once
    rawText = await callGemini(
      geminiApiKey,
      systemPrompt +
        "\n\nCRITICAL: Respond with raw JSON only. No markdown, no commentary, no code fences.",
      userPrompt,
      maxTokens,
    );
    block = parseJSON(rawText);
  }

  // Insert plan_block
  const { data: savedBlock, error: blockErr } = await supabaseAdmin
    .from("plan_blocks")
    .insert({
      user_id: userId,
      plan_id: planId,
      pillar_id: pillarId,
      week_number: weekNumber,
      title:
        block.title ||
        `${isSprint ? "Sprint" : "Week"} ${weekNumber} — ${pillarName}`,
      weekly_goal: block.weekly_goal || weeklyGoal,
      context_brief: block.context_brief || null,
      pacing_note: block.pacing_note || null,
      completion_criteria: block.completion_criteria || null,
      is_completed: false,
    })
    .select()
    .single();

  if (blockErr) throw blockErr;

  // Insert plan_tasks
  const tasks = Array.isArray(block.tasks) ? block.tasks : [];
  for (const task of tasks) {
    const { error: taskErr } = await supabaseAdmin.from("plan_tasks").insert({
      plan_block_id: savedBlock.id,
      user_id: userId,
      task_order: task.task_order || 1,
      action: task.action || "Complete the task",
      platform: task.platform || "Google",
      resource_type: ["curated", "mock_interview"].includes(task.resource_type)
        ? task.resource_type
        : "search_query",
      url: task.resource_type === "curated" ? task.url || null : null,
      search_query:
        task.resource_type !== "curated" &&
        task.resource_type !== "mock_interview"
          ? task.search_query || null
          : null,
      estimated_time_minutes: task.estimated_time_minutes || null,
      why_text: task.why_text || null,
      is_completed: false,
    });

    if (taskErr) {
      console.error("Error inserting task:", taskErr);
    }
  }

  return { block_id: savedBlock.id };
}

// ---------------------------------------------------------------------------
// Plan extension (add more weeks to an exploratory plan)
// ---------------------------------------------------------------------------

async function extendPlan(
  supabase: any,
  supabaseAdmin: any,
  geminiApiKey: string,
  userId: string,
  planId: string,
  additionalWeeks: number,
): Promise<{ new_total_weeks: number }> {
  // Fetch existing plan
  const { data: plan, error: planErr } = await supabase
    .from("learning_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", userId)
    .maybeSingle();

  if (planErr || !plan) {
    throw Object.assign(new Error("Plan not found"), { status: 400 });
  }

  const outline = plan.plan_outline as any;
  const existingWeeks = outline?.weeks || [];
  const lastWeekNumber =
    existingWeeks.length > 0
      ? Math.max(...existingWeeks.map((w: any) => w.week_number))
      : 0;

  // Fetch user profile and pillars
  const { data: profile } = await supabase
    .from("user_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: pillars } = await supabase
    .from("pillars")
    .select("id, name, current_level, description")
    .eq("user_id", userId)
    .eq("is_active", true);

  // Fetch completed blocks with feedback for continuity
  const { data: completedBlocks } = await supabase
    .from("plan_blocks")
    .select("pillar_id, week_number, title, weekly_goal, checkin_feedback")
    .eq("plan_id", planId)
    .eq("is_completed", true)
    .order("week_number");

  const completedSummary = (completedBlocks || [])
    .map((b: any) => {
      const feedback = b.checkin_feedback?.difficulty
        ? ` (rated: ${b.checkin_feedback.difficulty})`
        : "";
      return `- Week ${b.week_number}: ${b.title}${feedback}`;
    })
    .join("\n");

  const pillarList = (pillars || [])
    .map(
      (p: any) =>
        `- ${p.name} (level ${p.current_level}/5): ${p.description || ""}`,
    )
    .join("\n");

  const pacingProfile = profile?.pacing_profile || "exploratory";

  // Call Gemini to generate additional week outlines
  const prompt = `You are ProngGSD, extending a learning plan.

The learner has completed ${lastWeekNumber} weeks. Generate ${additionalWeeks} MORE weeks continuing from week ${lastWeekNumber + 1}.

PACING: ${pacingProfile}
PILLARS:
${pillarList}

COMPLETED SO FAR:
${completedSummary || "No blocks completed yet."}

Generate a continuation that:
- Advances the learner's skills based on their progress and feedback
- Introduces more advanced topics for pillars where they've been rating "too_easy"
- Reinforces areas where they rated "too_hard"
- Maintains the same JSON structure as the existing plan outline

Respond with ONLY valid JSON, no markdown fences:
{
  "weeks": [
    {
      "week_number": ${lastWeekNumber + 1},
      "pillars": [
        {
          "pillar_name": "Pillar Name",
          "weekly_goal": "What to accomplish this week",
          "difficulty": 2
        }
      ]
    }
  ]
}`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiApiKey}`;
  const geminiRes = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 3000, temperature: 0.7 },
    }),
  });

  const geminiData = await geminiRes.json();
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse JSON (strip markdown fences if present)
  const cleaned = rawText
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  let newWeeks: any[];
  try {
    const parsed = JSON.parse(cleaned);
    newWeeks = parsed.weeks || [];
  } catch {
    throw Object.assign(
      new Error("Failed to parse AI response for plan extension"),
      { status: 500 },
    );
  }

  // Append new weeks to outline
  const updatedWeeks = [...existingWeeks, ...newWeeks];
  const newTotalWeeks = plan.total_weeks + additionalWeeks;

  await supabaseAdmin
    .from("learning_plans")
    .update({
      plan_outline: {
        ...outline,
        total_weeks: newTotalWeeks,
        weeks: updatedWeeks,
      },
      total_weeks: newTotalWeeks,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  // Generate first new week's blocks
  const firstNewWeek = newWeeks[0];
  if (firstNewWeek) {
    const activePillarCount = firstNewWeek.pillars?.length || 1;
    for (const wp of firstNewWeek.pillars || []) {
      const pillarId = (pillars || []).find(
        (p: any) =>
          p.name.toLowerCase().includes(wp.pillar_name.toLowerCase()) ||
          wp.pillar_name.toLowerCase().includes(p.name.toLowerCase()),
      )?.id;

      if (!pillarId) continue;

      await generateBlock(supabase, supabaseAdmin, geminiApiKey, {
        userId,
        planId,
        weekNumber: firstNewWeek.week_number,
        pillarId,
        weeklyGoal: wp.weekly_goal,
        activePillarCount,
      });
    }
  }

  return { new_total_weeks: newTotalWeeks };
}

// ---------------------------------------------------------------------------
// Interview prep plan generation
// ---------------------------------------------------------------------------

async function generateInterviewPlan(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  geminiApiKey: string,
  opts?: {
    crashcourse_type?: string;
    crashcourse_topic?: string;
    crashcourse_deadline?: string;
  },
): Promise<{ plan_id: string; total_weeks: number; warnings: string[] }> {
  const crashcourseType = opts?.crashcourse_type || "interview";
  const isGeneric = crashcourseType === "generic";
  const warnings: string[] = [];

  // Fetch interview context + pillars
  const [profileRes, pillarsRes] = await Promise.all([
    supabase
      .from("user_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("pillars")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const profile = profileRes.data;
  const allPillars = pillarsRes.data || [];

  // Use interview-specific pillars (high sort_order, created by interview onboarding)
  // Filter to pillars created for interview prep (sort_order >= 100)
  const interviewPillars = allPillars.filter((p: any) => p.sort_order >= 100);
  const pillars = interviewPillars.length > 0 ? interviewPillars : allPillars;

  if (pillars.length === 0) {
    throw Object.assign(
      new Error("No pillars found. Complete interview prep setup first."),
      { status: 400 },
    );
  }

  // Fetch topic maps for interview pillars
  const pillarIds = pillars.map((p: any) => p.id);
  const { data: topicMaps } = await supabase
    .from("topic_map")
    .select("*")
    .in("pillar_id", pillarIds)
    .order("priority_order");

  // Determine plan duration — use crashcourse_deadline for generic, interview_date for interview
  const deadlineStr = isGeneric
    ? opts?.crashcourse_deadline
    : profile?.interview_date;
  let planWeeks = deadlineStr
    ? Math.max(
        1,
        Math.min(
          3,
          Math.ceil(
            (new Date(deadlineStr).getTime() - Date.now()) /
              (7 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
    : 2;

  const intensity = isGeneric
    ? "adapted"
    : profile?.interview_intensity || "adapted";
  const dailyMinutes =
    intensity === "100_percent"
      ? profile?.hours_per_day
        ? Math.round(profile.hours_per_day * 60)
        : 360
      : parseTimeCommitment(profile);

  const pillarSummaries = pillars
    .map((p: any) => {
      const clusters = (topicMaps || []).filter(
        (t: any) => t.pillar_id === p.id,
      );
      return `- ${p.name} (level ${p.current_level}/5): ${p.description || ""}
    Topics: ${clusters.map((c: any) => `${c.cluster_name} [${c.subtopics?.join(", ") || ""}]`).join("; ")}`;
    })
    .join("\n");

  // Build context section — differs for interview vs generic crash courses
  let interviewContext = "";
  if (isGeneric) {
    if (opts?.crashcourse_topic) {
      interviewContext += `\nTOPIC: ${opts.crashcourse_topic}`;
    }
    if (opts?.crashcourse_deadline) {
      interviewContext += `\nDEADLINE: ${opts.crashcourse_deadline}`;
    }
  } else {
    if (profile?.interview_target_role) {
      interviewContext += `\nTARGET ROLE: ${profile.interview_target_role}`;
    }
    if (profile?.interview_company) {
      interviewContext += `\nCOMPANY: ${profile.interview_company}`;
    }
    if (profile?.interview_company_context) {
      interviewContext += `\nCOMPANY CONTEXT: ${profile.interview_company_context}`;
    }
    if (profile?.interview_format) {
      interviewContext += `\nINTERVIEW FORMAT: ${profile.interview_format}`;
    }
    if (profile?.interview_weak_areas?.length > 0) {
      interviewContext += `\nWEAK AREAS: ${profile.interview_weak_areas.join(", ")}`;
    }
  }

  let extraContext = "";
  if (profile?.resume_text) {
    extraContext += `\n\nRESUME CONTEXT:\n${profile.resume_text.slice(0, 3000)}`;
  }
  if (profile?.linkedin_context) {
    extraContext += `\n\nLINKEDIN CONTEXT:\n${profile.linkedin_context.slice(0, 3000)}`;
  }

  const crashCourseLabel = isGeneric ? "Crash Course" : "Interview Prep";
  const architectLabel = isGeneric
    ? "ProngGSD Crash Course Architect"
    : "ProngGSD Interview Prep Architect";
  const contextLabel = isGeneric ? "CRASH COURSE CONTEXT" : "INTERVIEW CONTEXT";

  const planRules = isGeneric
    ? `CRASH COURSE PLAN RULES:
- Generate a ${planWeeks}-week plan with DAILY milestones — every single day must have a clear focus.
- Each week has ALL pillars active. This is a crash course — parallel study, not sequential.
- For each pillar each week, provide a specific weekly_goal that builds on the previous week.
- Week 1 starts with FOUNDATIONS: key concepts, terminology, and structure of the topic.
- Final week focuses on review, practice tests, and consolidation.
- Difficulty should ramp: Week 1 = foundation, Week 2+ = deep practice at target difficulty.
- ${intensity === "100_percent" ? "This is a full-time sprint. Pack every day with meaningful work." : "Respect the time budget but don't waste a single minute."}
- Do NOT include mock interview slots (this is not interview prep).`
    : `INTERVIEW PREP PLAN RULES:
- Generate a ${planWeeks}-week plan with DAILY milestones — every single day must have a clear focus.
- Each week has ALL pillars active. Interview prep is parallel, not sequential.
- For each pillar each week, provide a specific weekly_goal that builds on the previous week.
- Include mock interview slots: 1-3 per day depending on intensity. Mark these clearly with "MOCK:" prefix in the weekly_goal.
- Week 1 starts with CONTEXT: how companies typically test each skill. Then practice.
- Final week is heavy on mock interviews and review — simulating real interview conditions.
- Difficulty should ramp: Week 1 = foundation + context, Week 2+ = practice + mocks at interview difficulty.
- ${intensity === "100_percent" ? "This is a full-time sprint. Pack every day with meaningful work." : "Respect the time budget but don't waste a single minute."}`;

  const contextFirstApproach = isGeneric
    ? `FOUNDATIONS-FIRST APPROACH (critical):
For each pillar's first week, the weekly_goal MUST start with the key concepts and structure:
- Explain what the core concepts are and how they connect.
- Identify what's most commonly tested or assessed.
- Provide a clear learning path from basic to advanced.
Be specific to the actual topic.`
    : `CONTEXT-FIRST APPROACH (critical):
For each pillar's first week, the weekly_goal MUST start with explaining HOW companies test that skill:
- SQL: "Companies test window functions, CTEs, and optimization. Practice format: 45-min timed SQL test. Start with..."
- Behavioral: "STAR method is the standard. Interviewers look for specificity, impact metrics, and team dynamics. Start with..."
- System Design: "You'll get 45-60 min to design a system. They evaluate trade-offs, scalability thinking, and communication. Start with..."
- Etc. Be specific to the actual interview format.`;

  const systemPrompt = `You are ${architectLabel}. You build aggressive, daily-granularity crash course plans for ${isGeneric ? "intensive short-term learning goals" : "job interviews"}.

${contextLabel}:
${interviewContext}

LEARNER PROFILE:
- Intensity: ${intensity === "100_percent" ? "FULL COMMITMENT — maximize every available minute. Push difficulty, pack the schedule tight, no fluff." : `Adapted — ${dailyMinutes} minutes/day`}
- Plan duration: ${planWeeks} week${planWeeks > 1 ? "s" : ""}

PILLARS:
${pillarSummaries}
${extraContext}

${planRules}

${contextFirstApproach}

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "total_weeks": ${planWeeks},
  "weeks": [
    {
      "week_number": 1,
      "pillars": [
        {
          "pillar_name": "exact pillar name",
          "weekly_goal": "specific, detailed goal including HOW they test this + what to practice",
          "difficulty": 1
        }
      ]
    }
  ]
}`;

  const userPrompt = `Generate the ${planWeeks}-week interview prep crash course.`;

  let rawText = await callGemini(geminiApiKey, systemPrompt, userPrompt, 4000);
  let outline: any;
  try {
    outline = parseJSON(rawText);
  } catch {
    rawText = await callGemini(
      geminiApiKey,
      systemPrompt +
        "\n\nCRITICAL: Respond with raw JSON only. No markdown, no commentary, no code fences.",
      userPrompt,
      4000,
    );
    outline = parseJSON(rawText);
  }

  // Validate and enrich with pillar IDs
  if (!outline.total_weeks || !Array.isArray(outline.weeks)) {
    throw new Error("AI returned invalid interview plan outline structure");
  }

  for (const week of outline.weeks) {
    if (!Array.isArray(week.pillars)) continue;
    for (const wp of week.pillars) {
      const matched = matchPillarByName(wp.pillar_name, pillars);
      if (matched) {
        wp.pillar_id = matched.id;
      } else {
        warnings.push(
          `Week ${week.week_number}: pillar "${wp.pillar_name}" not found in DB, skipping.`,
        );
      }
    }
    week.pillars = week.pillars.filter((wp: any) => wp.pillar_id);
  }

  outline.weeks = outline.weeks.filter(
    (w: any) => w.pillars && w.pillars.length > 0,
  );
  if (outline.weeks.length === 0) {
    throw new Error("AI interview plan outline matched zero pillars.");
  }
  outline.total_weeks = outline.weeks.length;

  // Deactivate any existing active interview_prep plan (NOT the learning plan)
  await supabaseAdmin
    .from("learning_plans")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("plan_type", "interview_prep");

  // Store crash course metadata in the outline for dashboard display
  if (isGeneric) {
    outline.crashcourse_topic = opts?.crashcourse_topic || null;
    outline.crashcourse_deadline = opts?.crashcourse_deadline || null;
  }

  // Insert crash course plan
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("learning_plans")
    .insert({
      user_id: userId,
      total_weeks: outline.total_weeks,
      pacing_profile: "intensive",
      plan_outline: outline,
      is_active: true,
      plan_type: "interview_prep",
      crashcourse_type: crashcourseType,
    })
    .select()
    .single();

  if (planErr) throw planErr;

  // Generate ALL weeks' blocks immediately (short plan, need full visibility)
  // Process pillars in chunks of 2 to avoid Gemini RPM rate limits (15 RPM on free tier)
  for (const week of outline.weeks) {
    const activePillarCount = week.pillars.length;
    for (let i = 0; i < week.pillars.length; i += 2) {
      const chunk = week.pillars.slice(i, i + 2);
      const blockPromises = chunk.map((wp) =>
        generateBlock(supabase, supabaseAdmin, geminiApiKey, {
          userId,
          planId: plan.id,
          weekNumber: wp.week_number || week.week_number,
          pillarId: wp.pillar_id,
          pillarName: wp.pillar_name,
          weeklyGoal: wp.weekly_goal,
          profile,
          activePillarCount,
          planType: "interview_prep",
        }).catch((err: any) => {
          console.error(
            `Interview block gen failed for ${wp.pillar_name} week ${week.week_number}:`,
            err,
          );
          warnings.push(
            `Failed to generate week ${week.week_number} block for "${wp.pillar_name}": ${err.message}`,
          );
          return null;
        }),
      );
      await Promise.all(blockPromises);
    }
  }

  // Initialize user_progress if it doesn't exist (shared with learning plan)
  const { data: existingProgress } = await supabaseAdmin
    .from("user_progress")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingProgress) {
    await supabaseAdmin.from("user_progress").insert({
      user_id: userId,
      current_day: 1,
      current_streak: 0,
      longest_streak: 0,
      total_tasks_completed: 0,
    });
  }

  return { plan_id: plan.id, total_weeks: outline.total_weeks, warnings };
}

// ---------------------------------------------------------------------------
// Sprint plan generation (focused iterative cycles)
// ---------------------------------------------------------------------------

async function generateSprintPlan(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  geminiApiKey: string,
): Promise<{ plan_id: string; total_sprints: number; warnings: string[] }> {
  const warnings: string[] = [];

  // Fetch all context
  const [profileRes, pillarsRes, phasesRes] = await Promise.all([
    supabase
      .from("user_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("pillars")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("phases")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order"),
  ]);

  const profile = profileRes.data;
  const pillars = pillarsRes.data || [];
  const phases = phasesRes.data || [];

  if (pillars.length === 0) {
    throw Object.assign(
      new Error("No pillars found. Complete onboarding first."),
      { status: 400 },
    );
  }

  // Fetch topic maps for all pillars
  const pillarIds = pillars.map((p: any) => p.id);
  const { data: topicMaps } = await supabase
    .from("topic_map")
    .select("*")
    .in("pillar_id", pillarIds)
    .order("priority_order");

  const dailyMinutes = parseTimeCommitment(profile);
  const sprintIntensity = getSprintIntensity(dailyMinutes);
  const [minUnits, maxUnits] = SPRINT_UNITS[sprintIntensity];

  // Build pillar summaries for AI
  const pillarSummaries = pillars
    .map((p: any) => {
      const clusters = (topicMaps || []).filter(
        (t: any) => t.pillar_id === p.id,
      );
      return `- ${p.name} (level ${p.current_level}/5): ${p.description || ""}
    Topics: ${clusters.map((c: any) => `${c.cluster_name} [${c.subtopics?.join(", ") || ""}]`).join("; ")}`;
    })
    .join("\n");

  const phaseSummary =
    phases.length > 0
      ? phases
          .map(
            (ph: any) =>
              `- ${ph.name}: ${ph.goal || ""} (${ph.timeline_start} to ${ph.timeline_end})`,
          )
          .join("\n")
      : "No phases defined.";

  // Build optional context
  let extraContext = "";
  if (profile?.resume_text) {
    extraContext += `\n\nRESUME CONTEXT:\n${profile.resume_text.slice(0, 3000)}`;
  }
  if (profile?.linkedin_context) {
    extraContext += `\n\nLINKEDIN CONTEXT:\n${profile.linkedin_context.slice(0, 3000)}`;
  }

  const jobContext = profile?.job_situation
    ? `Job situation: ${profile.job_situation}${profile.job_timeline_weeks ? `, deadline in ${profile.job_timeline_weeks} weeks` : ""}`
    : "";

  const systemPrompt = `You are ProngGSD, an AI learning sprint architect. You design focused, iterative learning sprints.

CONCEPT: Instead of a rigid multi-week plan, the learner works in focused sprints. Each sprint concentrates on 1-2 pillars for deep learning. After completing a sprint, they review progress and pick the next focus area.

LEARNER PROFILE:
- Time commitment: ${dailyMinutes} minutes/day
- ${jobContext || "No specific job deadline."}

ALL PILLARS (the learner's full skill development goals):
${pillarSummaries}

PHASES:
${phaseSummary}
${extraContext}

SPRINT PLAN RULES:
- Design an arc of 3-5 sprints that progress the learner toward their career goal.
- Sprint 1 should focus on 1-2 of the HIGHEST PRIORITY pillars (lowest level, most foundational).
- Each sprint focuses on 1-2 pillars ONLY — this enables deep learning, not scattered surface coverage.
- Provide a clear career_goal summary and explain WHY each pillar matters for that goal.
- The arc shows the journey: which pillars are tackled when, building from foundations to mastery.
- Sprint 1 must have detailed pillar goals. Future sprints need only themes and target outcomes.
- Do NOT try to cover all pillars in every sprint. Rotate focus across sprints.
- suggested_first_focus should name the 1-2 pillars for sprint 1.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "career_goal": "One sentence describing the learner's career direction",
  "pillar_rationale": {
    "pillar_name": "Why this pillar matters for their career goal"
  },
  "arc": [
    {
      "sprint_number": 1,
      "focus_pillars": ["Pillar Name"],
      "theme": "Sprint theme",
      "target_outcome": "What the learner should be able to do after this sprint"
    }
  ],
  "current_sprint": {
    "sprint_number": 1,
    "focus_pillars": [
      {
        "pillar_name": "exact pillar name",
        "sprint_goal": "specific goal for this pillar in this sprint",
        "unit_count": ${Math.round((minUnits + maxUnits) / 2)},
        "focus_areas": ["topic1", "topic2"]
      }
    ]
  }
}`;

  const userPrompt =
    "Generate the sprint learning plan for this learner. Pick the best 1-2 pillars to start with.";

  let rawText = await callGemini(geminiApiKey, systemPrompt, userPrompt, 4000);
  let sprintOutline: any;
  try {
    sprintOutline = parseJSON(rawText);
  } catch {
    rawText = await callGemini(
      geminiApiKey,
      systemPrompt +
        "\n\nCRITICAL: Respond with raw JSON only. No markdown, no commentary, no code fences.",
      userPrompt,
      4000,
    );
    sprintOutline = parseJSON(rawText);
  }

  // Validate
  if (
    !sprintOutline.arc ||
    !Array.isArray(sprintOutline.arc) ||
    !sprintOutline.current_sprint
  ) {
    throw new Error("AI returned invalid sprint plan structure");
  }

  // Enrich current_sprint focus_pillars with pillar IDs
  const focusPillars = sprintOutline.current_sprint.focus_pillars || [];
  for (const fp of focusPillars) {
    const matched = matchPillarByName(fp.pillar_name, pillars);
    if (matched) {
      fp.pillar_id = matched.id;
    } else {
      warnings.push(
        `Sprint 1: pillar "${fp.pillar_name}" not found in DB, skipping.`,
      );
    }
  }
  sprintOutline.current_sprint.focus_pillars = focusPillars.filter(
    (fp: any) => fp.pillar_id,
  );

  if (sprintOutline.current_sprint.focus_pillars.length === 0) {
    throw new Error(
      "AI sprint plan matched zero pillars to the user's actual pillars.",
    );
  }

  // Add format marker
  sprintOutline.format = "sprint";

  // Deactivate any existing active learning plan
  await supabaseAdmin
    .from("learning_plans")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("plan_type", "learning");

  // Insert new sprint plan
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("learning_plans")
    .insert({
      user_id: userId,
      total_weeks: null, // Open-ended for sprint plans
      pacing_profile: profile?.pacing_profile || "steady",
      plan_outline: sprintOutline,
      is_active: true,
      plan_type: "learning",
      plan_format: "sprint",
      sprint_started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (planErr) throw planErr;

  // Generate sprint 1 blocks (1 per focus pillar)
  const activePillarCount = sprintOutline.current_sprint.focus_pillars.length;

  for (const fp of sprintOutline.current_sprint.focus_pillars) {
    try {
      await generateBlock(supabase, supabaseAdmin, geminiApiKey, {
        userId,
        planId: plan.id,
        weekNumber: 1, // sprint_number stored as week_number
        pillarId: fp.pillar_id,
        pillarName: fp.pillar_name,
        weeklyGoal: fp.sprint_goal,
        profile,
        activePillarCount,
        planFormat: "sprint",
        sprintUnitCount: fp.unit_count || Math.round((minUnits + maxUnits) / 2),
      });
    } catch (err: any) {
      console.error(
        `Sprint block gen failed for pillar ${fp.pillar_name}:`,
        err,
      );
      warnings.push(
        `Failed to generate sprint 1 block for "${fp.pillar_name}": ${err.message}`,
      );
    }
  }

  // Initialize user_progress (upsert)
  const { data: existingProgress } = await supabaseAdmin
    .from("user_progress")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingProgress) {
    await supabaseAdmin
      .from("user_progress")
      .update({
        current_day: 1,
        current_streak: 0,
        total_tasks_completed: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingProgress.id);
  } else {
    await supabaseAdmin.from("user_progress").insert({
      user_id: userId,
      current_day: 1,
      current_streak: 0,
      longest_streak: 0,
      total_tasks_completed: 0,
    });
  }

  return {
    plan_id: plan.id,
    total_sprints: sprintOutline.arc.length,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Next sprint generation (after sprint check-in)
// ---------------------------------------------------------------------------

async function generateNextSprint(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
  geminiApiKey: string,
  planId: string,
  sprintNumber: number,
  checkinSummary: any,
  focusPillarNames: string[],
): Promise<{ block_ids: string[]; warnings: string[] }> {
  const warnings: string[] = [];

  // Fetch plan + pillars + profile
  const [planRes, pillarsRes, profileRes] = await Promise.all([
    supabase
      .from("learning_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("pillars")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("user_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const plan = planRes.data;
  if (!plan) throw Object.assign(new Error("Plan not found"), { status: 400 });

  const pillars = pillarsRes.data || [];
  const profile = profileRes.data;

  // Fetch topic maps
  const pillarIds = pillars.map((p: any) => p.id);
  const { data: topicMaps } = await supabase
    .from("topic_map")
    .select("*")
    .in("pillar_id", pillarIds)
    .order("priority_order");

  // Fetch completed blocks for continuity
  const { data: completedBlocks } = await supabase
    .from("plan_blocks")
    .select("pillar_id, week_number, title, weekly_goal, checkin_feedback")
    .eq("plan_id", planId)
    .eq("is_completed", true)
    .order("week_number");

  const dailyMinutes = parseTimeCommitment(profile);
  const sprintIntensity = getSprintIntensity(dailyMinutes);
  const [minUnits, maxUnits] = SPRINT_UNITS[sprintIntensity];

  // Match focus pillar names to actual pillars
  const focusPillars = focusPillarNames
    .map((name) => matchPillarByName(name, pillars))
    .filter((p: any) => p !== null);

  if (focusPillars.length === 0) {
    throw Object.assign(
      new Error("No valid focus pillars selected for next sprint"),
      { status: 400 },
    );
  }

  const outline = plan.plan_outline as any;
  const nextSprintNumber = sprintNumber + 1;

  const pillarSummaries = pillars
    .map((p: any) => {
      const clusters = (topicMaps || []).filter(
        (t: any) => t.pillar_id === p.id,
      );
      return `- ${p.name} (level ${p.current_level}/5): ${p.description || ""}
    Topics: ${clusters.map((c: any) => `${c.cluster_name} [${c.subtopics?.join(", ") || ""}]`).join("; ")}`;
    })
    .join("\n");

  const completedSummary = (completedBlocks || [])
    .map((b: any) => {
      const feedback = b.checkin_feedback?.difficulty
        ? ` (rated: ${b.checkin_feedback.difficulty})`
        : "";
      return `- Sprint ${b.week_number}, ${b.title}${feedback}`;
    })
    .join("\n");

  const systemPrompt = `You are ProngGSD, generating the next sprint in a focused learning plan.

CAREER GOAL: ${outline.career_goal || "Career development"}
SPRINT CHECK-IN SUMMARY: ${JSON.stringify(checkinSummary)}

SELECTED FOCUS PILLARS FOR NEXT SPRINT: ${focusPillars.map((p: any) => p.name).join(", ")}

ALL PILLARS:
${pillarSummaries}

COMPLETED SPRINT HISTORY:
${completedSummary || "No previous sprints completed."}

CURRENT ARC:
${JSON.stringify(outline.arc || [])}

Generate sprint ${nextSprintNumber} details for the selected focus pillars. Also update the learning arc if needed based on progress.

RULES:
- Generate detailed goals for each focus pillar (1-2 pillars max)
- Each pillar gets ${minUnits}-${maxUnits} practice units
- Units should build on what was completed before
- Update the arc to reflect current progress and any adjustments

Respond with ONLY valid JSON, no markdown fences:
{
  "updated_arc": [
    {
      "sprint_number": 1,
      "focus_pillars": ["Pillar"],
      "theme": "Theme",
      "target_outcome": "Outcome"
    }
  ],
  "current_sprint": {
    "sprint_number": ${nextSprintNumber},
    "focus_pillars": [
      {
        "pillar_name": "exact pillar name",
        "sprint_goal": "specific goal",
        "unit_count": ${Math.round((minUnits + maxUnits) / 2)},
        "focus_areas": ["topic1", "topic2"]
      }
    ]
  }
}`;

  const userPrompt = `Generate sprint ${nextSprintNumber} for focus pillars: ${focusPillars.map((p: any) => p.name).join(", ")}`;

  let rawText = await callGemini(geminiApiKey, systemPrompt, userPrompt, 3000);
  let result: any;
  try {
    result = parseJSON(rawText);
  } catch {
    rawText = await callGemini(
      geminiApiKey,
      systemPrompt +
        "\n\nCRITICAL: Respond with raw JSON only. No markdown, no commentary, no code fences.",
      userPrompt,
      3000,
    );
    result = parseJSON(rawText);
  }

  // Enrich with pillar IDs
  const sprintFocusPillars = result.current_sprint?.focus_pillars || [];
  for (const fp of sprintFocusPillars) {
    const matched = matchPillarByName(fp.pillar_name, pillars);
    if (matched) {
      fp.pillar_id = matched.id;
    } else {
      warnings.push(
        `Sprint ${nextSprintNumber}: pillar "${fp.pillar_name}" not found, skipping.`,
      );
    }
  }
  result.current_sprint.focus_pillars = sprintFocusPillars.filter(
    (fp: any) => fp.pillar_id,
  );

  if (result.current_sprint.focus_pillars.length === 0) {
    throw new Error("No valid pillars matched for next sprint.");
  }

  // Update plan outline
  const updatedOutline = {
    ...outline,
    arc: result.updated_arc || outline.arc,
    current_sprint: result.current_sprint,
  };

  await supabaseAdmin
    .from("learning_plans")
    .update({
      plan_outline: updatedOutline,
      sprint_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  // Generate blocks for the new sprint
  const blockIds: string[] = [];
  const activePillarCount = result.current_sprint.focus_pillars.length;

  for (const fp of result.current_sprint.focus_pillars) {
    try {
      const blockResult = await generateBlock(
        supabase,
        supabaseAdmin,
        geminiApiKey,
        {
          userId,
          planId,
          weekNumber: nextSprintNumber, // sprint_number stored as week_number
          pillarId: fp.pillar_id,
          pillarName: fp.pillar_name,
          weeklyGoal: fp.sprint_goal,
          profile,
          activePillarCount,
          planFormat: "sprint",
          sprintUnitCount:
            fp.unit_count || Math.round((minUnits + maxUnits) / 2),
          difficultyAdjustment:
            checkinSummary?.difficulty_signals?.[fp.pillar_name] === "harder"
              ? "harder"
              : checkinSummary?.difficulty_signals?.[fp.pillar_name] ===
                  "easier"
                ? "easier"
                : "same",
        },
      );
      blockIds.push(blockResult.block_id);
    } catch (err: any) {
      console.error(`Next sprint block gen failed for ${fp.pillar_name}:`, err);
      warnings.push(
        `Failed to generate sprint ${nextSprintNumber} block for "${fp.pillar_name}": ${err.message}`,
      );
    }
  }

  return { block_ids: blockIds, warnings };
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
    const backgroundSecret = Deno.env.get("INTERNAL_BACKGROUND_SECRET");
    const bgToken = req.headers.get("x-background-token");
    const isBackgroundCall = !!(
      backgroundSecret &&
      bgToken &&
      bgToken === backgroundSecret
    );

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

    if (!isBackgroundCall) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const ip = req.headers.get("x-forwarded-for") || "unknown";
      const rateCheck = await checkRateLimit(
        supabaseAdmin,
        userId,
        ip,
        "generate-plan",
      );
      if (!rateCheck.allowed) {
        return jsonRes({ error: rateCheck.message }, 429);
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { mode } = body;

    if (mode === "full_plan") {
      const result = await generateOutline(
        supabase,
        supabaseAdmin,
        userId,
        geminiApiKey,
      );
      return jsonRes({
        success: true,
        plan_id: result.plan_id,
        total_weeks: result.total_weeks,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
      });
    }

    if (mode === "plan_block") {
      const {
        plan_id,
        week_number,
        pillar_id,
        weekly_goal,
        active_pillar_count,
        difficulty_adjustment,
        feedback_context,
      } = body;
      if (!plan_id || !week_number || !pillar_id || !weekly_goal) {
        return jsonRes(
          {
            error:
              "plan_id, week_number, pillar_id, and weekly_goal are required for plan_block mode",
          },
          400,
        );
      }
      const result = await generateBlock(
        supabase,
        supabaseAdmin,
        geminiApiKey,
        {
          userId,
          planId: plan_id,
          weekNumber: week_number,
          pillarId: pillar_id,
          weeklyGoal: weekly_goal,
          activePillarCount: active_pillar_count || 1,
          difficultyAdjustment: difficulty_adjustment,
          feedbackContext: feedback_context,
        },
      );
      return jsonRes({ success: true, block_id: result.block_id });
    }

    if (mode === "extend_plan") {
      const { plan_id, additional_weeks } = body;
      if (!plan_id || !additional_weeks) {
        return jsonRes(
          {
            error:
              "plan_id and additional_weeks are required for extend_plan mode",
          },
          400,
        );
      }
      const result = await extendPlan(
        supabase,
        supabaseAdmin,
        geminiApiKey,
        userId,
        plan_id,
        additional_weeks,
      );
      return jsonRes({
        success: true,
        new_total_weeks: result.new_total_weeks,
      });
    }

    if (mode === "interview_plan") {
      const result = await generateInterviewPlan(
        supabase,
        supabaseAdmin,
        userId,
        geminiApiKey,
        {
          crashcourse_type: body.crashcourse_type || "interview",
          crashcourse_topic: body.crashcourse_topic,
          crashcourse_deadline: body.crashcourse_deadline,
        },
      );
      return jsonRes({
        success: true,
        plan_id: result.plan_id,
        total_weeks: result.total_weeks,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
      });
    }

    if (mode === "sprint_plan") {
      const result = await generateSprintPlan(
        supabase,
        supabaseAdmin,
        userId,
        geminiApiKey,
      );
      return jsonRes({
        success: true,
        plan_id: result.plan_id,
        total_sprints: result.total_sprints,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
      });
    }

    if (mode === "next_sprint") {
      const { plan_id, sprint_number, checkin_summary, focus_pillars } = body;
      if (!plan_id || !sprint_number || !focus_pillars) {
        return jsonRes(
          {
            error:
              "plan_id, sprint_number, and focus_pillars are required for next_sprint mode",
          },
          400,
        );
      }
      const result = await generateNextSprint(
        supabase,
        supabaseAdmin,
        userId,
        geminiApiKey,
        plan_id,
        sprint_number,
        checkin_summary || {},
        focus_pillars,
      );
      return jsonRes({
        success: true,
        block_ids: result.block_ids,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
      });
    }

    return jsonRes(
      {
        error:
          "Invalid mode. Must be: full_plan, plan_block, extend_plan, interview_plan, sprint_plan, next_sprint",
      },
      400,
    );
  } catch (err: any) {
    console.error(err);
    if (err.status === 429) {
      return jsonRes({ error: err.message }, 429);
    }
    if (err.status === 400) {
      return jsonRes({ error: err.message }, 400);
    }
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
