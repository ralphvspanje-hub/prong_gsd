# Phase 3: Main Onboarding Detection — Execution Plan

> **For the implementing agent:** This is a small, surgical change across 2 files. Read both files fully before editing.

## Context

Phase 1 added interview prep as a parallel mode. Phase 2 added mock interviews. Currently, users access interview prep via:
- Settings page → "Start Interview Prep" button
- Dashboard banner → "Interview coming up? Start a crash course"

Phase 3 makes the **main onboarding** smart enough to detect when interview prep is the user's primary need and route them there automatically.

## What We're Building

When a new user goes through the standard 6+ turn onboarding and their **primary goal** is interview prep with a tight deadline (≤3 weeks), the system should:
1. Detect this from the onboarding outputs
2. Skip generating a long-term learning plan
3. Route the user to `/interview-onboarding` instead

This should be **conservative** — only trigger when interview prep is clearly the dominant need. A user who mentions interviewing casually alongside career growth should still get a normal learning plan.

## Implementation

### 3A. Modify: `supabase/functions/gsd-onboarding-chat/index.ts`

**What to change:** Add a `primary_focus` field to the output format.

**Location in the file:** The `ONBOARDING_SYSTEM_PROMPT` string (starts at line 9, ends at line 130). Specifically:

1. **Add to the OUTPUT FORMAT section** (around line 73-112), inside the JSON block:

```json
"primary_focus": "interview_prep" | "long_term_learning"
```

2. **Add a new section to the system prompt** (after the `NEW FIELD RULES` section, around line 123-128):

```
PRIMARY FOCUS DETECTION:
Based on the full conversation, determine the user's primary focus:
- Set to "interview_prep" ONLY when ALL of these are true:
  1. The user's PRIMARY stated goal is preparing for specific upcoming interviews
  2. Their timeline is 3 weeks or less
  3. Interview preparation dominated the conversation (not mentioned casually alongside other goals)
- Set to "long_term_learning" in ALL other cases, including:
  - User mentions interviewing but also wants general career growth
  - Timeline is longer than 3 weeks
  - Interview prep is secondary to skill building
  - User is exploring or career switching, even if they mention interviews
Be conservative. When in doubt, default to "long_term_learning". It's better to let a user manually start interview prep than to force them into it when they wanted a full learning plan.
```

3. **Add to the field rules section:**

```
- primary_focus: Required. Either "interview_prep" or "long_term_learning". See PRIMARY FOCUS DETECTION rules above.
```

**That's the only backend change.** The function already returns `outputs` to the client — adding a field to the JSON is backwards-compatible.

### 3B. Modify: `src/pages/Onboarding.tsx`

**What to change:** In the `handleConfirm` function (starts at line 187), add routing logic before the existing save flow.

**Current flow (simplified):**
```typescript
const handleConfirm = async () => {
  // 1. Save to user_profile
  // 2. Create pillars + topic maps
  // 3. Create phases
  // 4. Update onboarding_conversations
  // 5. Call gsd-generate-plan with mode: "full_plan"
  // 6. Navigate to /dashboard
};
```

**New flow — add this at the TOP of handleConfirm, before any saves:**

```typescript
const handleConfirm = async () => {
  if (!outputs || !user) return;

  // Interview prep detection: route to dedicated flow if primary focus is interview prep
  if (
    outputs.primary_focus === "interview_prep" &&
    outputs.job_timeline_weeks != null &&
    outputs.job_timeline_weeks <= 3
  ) {
    // Save basic profile data so it persists
    await supabase.from("user_profile").upsert({
      user_id: user.id,
      name: user.email?.split("@")[0] || "Learner",
      job_situation: outputs.job_situation || "interviewing",
      job_timeline_weeks: outputs.job_timeline_weeks,
    });
    // Mark onboarding as completed
    await supabase.from("onboarding_conversations").update({ status: "completed" }).eq("user_id", user.id);

    toast.info("Looks like you need interview prep! Let's set that up.");
    navigate("/interview-onboarding");
    return;  // Skip the rest of handleConfirm
  }

  // ... existing save flow continues unchanged ...
  setSaving(true);
  // ...
};
```

**Important:** The `outputs` type needs updating. Add `primary_focus` to the `OnboardingOutputs` interface (line 44-54):

```typescript
interface OnboardingOutputs {
  pillars: Pillar[];
  phases: Phase[];
  topicMap: TopicCluster[];
  pacing_profile?: string;
  time_commitment?: string;
  job_situation?: string;
  job_timeline_weeks?: number | null;
  tool_setup?: Record<string, boolean | null>;
  primary_focus?: string;  // "interview_prep" | "long_term_learning"
}
```

**Also import `toast` if needed** — it's already imported at line 12 (`import { toast } from "sonner"`), so no change needed.

## Files to Modify

| File | Change | Size of change |
|------|--------|----------------|
| `supabase/functions/gsd-onboarding-chat/index.ts` | Add `primary_focus` to output format + detection rules in system prompt | ~15 lines added to prompt |
| `src/pages/Onboarding.tsx` | Add routing check at top of `handleConfirm` + update interface | ~15 lines of code |

## Files to Update (Documentation)

| File | Change |
|------|--------|
| `CLAUDE.md` (root) | Add gotcha about onboarding detection |
| `supabase/functions/CLAUDE.md` | Update onboarding-chat output shape |
| `src/pages/CLAUDE.md` | Note on Onboarding.tsx interview prep routing |

## Verification

1. **New user, interview-focused:** Create a new user → during onboarding, make interview prep the clear primary focus ("I have an interview at Google in 2 weeks, that's all I care about right now") → after confirming the blueprint, should be redirected to `/interview-onboarding` with a toast message
2. **New user, casual mention:** Create a new user → mention interviewing alongside other goals ("I'm growing my skills and might interview soon, maybe in a few months") → should proceed normally to dashboard with a learning plan
3. **New user, tight timeline but secondary:** "I'm switching careers to data science. I also have an interview in 2 weeks but my main goal is learning Python" → should get a learning plan, NOT interview prep
4. **Existing users:** Verify existing onboarding flow is completely unaffected (the `primary_focus` field defaults to `"long_term_learning"` when not present)

## Risk Assessment

**Low risk.** This change is:
- Additive only (new field in AI output, new early-return in handleConfirm)
- Conservative by design (defaults to normal flow)
- Backwards-compatible (old outputs without `primary_focus` won't trigger the redirect)
- Easily reversible (remove the if-block in handleConfirm)

The main risk is the AI being too aggressive with `"interview_prep"` detection. The prompt rules are written to be conservative, but test with edge cases.
