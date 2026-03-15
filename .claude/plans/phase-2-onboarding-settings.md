# Phase 2: Onboarding Update + Settings — Implementation Plan

**Overall Progress:** `100%`

## TLDR
Update the onboarding chat to capture job situation, urgency, time commitment, and tool setup. Add a "Connect your context" section to Settings for optional LinkedIn/resume input. Deprecate `daily_time_commitment` in favor of the new `time_commitment` text field. Prep edge functions that already read profile data to fetch the new columns.

## Critical Decisions
- **New onboarding data storage:** Include new fields in the `[ONBOARDING_COMPLETE]` JSON, frontend writes them to DB — matches existing pattern, no new write path
- **Resume parsing:** Client-side with `pdfjs-dist` — no edge function, no storage bucket, no extra infra
- **Supabase types:** Manually add new column types with a `// MANUALLY ADDED` comment — regenerate later when CLI is configured
- **Time commitment:** Deprecate old `daily_time_commitment` (integer) in favor of new `time_commitment` (text) — single source of truth, more expressive
- **`weekend_only` maps to 120 minutes** for token budget calculation
- **Edge function updates:** Only update functions that already fetch profile (`gsd-mentor-chat`, `gsd-generate-plan`) — don't add profile queries to functions that don't need them
- **Existing Learning Preferences section:** Leave as-is this phase — coexists, not broken

## Tasks:

- [x] 🟩 **Step 1: Update Supabase types**
  - [x] 🟩 Manually add Phase 1 columns to `user_profile` type in `src/integrations/supabase/types.ts` (`pacing_profile`, `time_commitment`, `job_situation`, `job_timeline_weeks`, `tool_setup`, `resume_text`, `linkedin_context`)
  - [x] 🟩 Add `// MANUALLY ADDED — ProngGSD Phase 1 columns. Regenerate types when possible.` comment above additions

- [x] 🟩 **Step 2: Update `gsd-onboarding-chat` system prompt**
  - [x] 🟩 Add instructions for the AI to ask about job situation/urgency (interviewing, career_switch, growing, exploring)
  - [x] 🟩 Add instructions to ask about timeline (weeks until deadline, if applicable)
  - [x] 🟩 Add instructions to ask about time commitment (15/30/60/90 min daily, or weekend_only)
  - [x] 🟩 Add instructions to ask about tool setup for technical skills (Python, GitHub, IDE, practice platforms)
  - [x] 🟩 Add instructions for light-touch learning style preference question
  - [x] 🟩 Add pacing profile derivation rules to the prompt (interviewing + <8 weeks = aggressive, etc.)
  - [x] 🟩 Update the `[ONBOARDING_COMPLETE]` output schema in the prompt to include new fields: `pacing_profile`, `time_commitment`, `job_situation`, `job_timeline_weeks`, `tool_setup`
  - [x] 🟩 Instruct AI to NOT reveal pacing profile to the user — it's internal

- [x] 🟩 **Step 3: Update onboarding output parsing (edge function)**
  - [x] 🟩 No code change needed — `JSON.parse(completeMatch[1])` already passes through all fields the AI outputs

- [x] 🟩 **Step 4: Update frontend onboarding confirmation**
  - [x] 🟩 Update `OnboardingOutputs` interface in `Onboarding.tsx` to include new fields
  - [x] 🟩 Update `handleConfirm` to write `pacing_profile`, `time_commitment`, `job_situation`, `job_timeline_weeks`, `tool_setup` to `user_profile` via the existing upsert

- [x] 🟩 **Step 5: Add "Connect your context" section to Settings**
  - [x] 🟩 Install `pdfjs-dist` dependency
  - [x] 🟩 Add LinkedIn text area with save button — writes to `user_profile.linkedin_context`
  - [x] 🟩 Add resume PDF file input — extracts text client-side with `pdfjs-dist`, writes to `user_profile.resume_text`
  - [x] 🟩 Load existing values from `user_profile` on mount (show "Resume uploaded" state if `resume_text` exists)
  - [x] 🟩 Position section between Pillars and Danger Zone
  - [x] 🟩 Add brief explanation text: why this is useful, both fields optional

- [x] 🟩 **Step 6: Deprecate `daily_time_commitment` in `gsd-generate-plan`**
  - [x] 🟩 Add a `parseTimeCommitment(text) → minutes` mapping function (15_min_daily→15, 30→30, 60→60, 90→90, weekend_only→120)
  - [x] 🟩 Replace reads of `daily_time_commitment` with reads of `time_commitment` + the parser
  - [x] 🟩 Keep fallback: if `time_commitment` is null, fall back to `daily_time_commitment` for existing users

- [x] 🟩 **Step 7: Update profile fetching in `gsd-mentor-chat`**
  - [x] 🟩 Verified: `gsd-mentor-chat` uses `SELECT *` on `user_profile` — new columns automatically included. No code change needed.

- [x] 🟩 **Step 8: Build and verify**
  - [x] 🟩 `npm run build` — no TypeScript errors
  - [x] 🟩 Existing onboarding outputs (pillars, phases, topicMap) unaffected — no changes to parsing logic
  - [x] 🟩 Settings page imports and structure verified

- [x] 🟩 **Step 9: Update documentation**
  - [x] 🟩 Updated `supabase/functions/CLAUDE.md`: onboarding output shape, discovery dimensions, token budget source
  - [x] 🟩 Updated `CLAUDE.md`: status line, settings route description
  - [x] 🟩 Updated `src/pages/CLAUDE.md`: settings page description
  - [x] 🟩 Added entry to `AGENT_LOG.md`
