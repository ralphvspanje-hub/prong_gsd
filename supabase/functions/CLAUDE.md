# supabase/functions/ — Agent Context

## \_shared/

Shared Deno modules imported by multiple edge functions.

| Module         | Export           | Used by                                                                                              |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `rateLimit.ts` | `checkRateLimit` | mentor-chat, generate-plan, onboarding-chat, interview-onboarding, sprint-checkin, practice-feedback |
| `cors.ts`      | `getCorsHeaders` | all functions                                                                                        |

Rate limits: 50 calls/user/day (500 for owner via `OWNER_EMAIL` env var), 100 calls/IP/day per endpoint. Auto-cleans rows older than 48h from `api_rate_limits`.

## mentor-chat

AI mentor conversation endpoint. Phase 6 updated to be plan-aware. Phase 9.4 added mode-based persona switching.

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Rate limits**: 50 calls/user/day, 100 calls/IP/day via `api_rate_limits` table. Old rows (>48h) auto-cleaned.
- **Mode param**: Optional `mode` in request body (`"learning"` or `"interview_prep"`). Defaults to learning. When `"interview_prep"`: uses interview coach persona, filters pillars to `sort_order >= 100`, filters plan to `interview_prep` type, adds INTERVIEW CONTEXT section with date/company/weak areas, uses interview-focused behavior rules.
- **Context loaded** (two rounds):
  - Round 1 (parallel): user_profile, active pillars (filtered by mode), active phase, last 3 cycles, active learning_plan (filtered by plan_type matching mode), user_progress
  - Round 2: plan_blocks for active plan, plan_tasks for current week's uncompleted blocks, last 30 conversation messages
- **AI model**: `gemini-3.1-flash-lite` via Google Generative AI REST API
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- **Settings**: max_tokens 3072, temperature 0.7
- **Message limit**: Max 2000 chars per user message
- **Pattern detection**: Server-side `detectPatterns()` analyzes last 5 checkin feedbacks for consecutive "too_hard"/"too_easy" ratings and streak breaks, injected as PATTERN ALERTS in system prompt
- **System prompt sections**: USER PROFILE, ACTIVE PILLARS, CURRENT PHASE, RECENT CYCLES, ACTIVE PLAN (outline summary), CURRENT WEEK STATUS (per-block task counts), CURRENT TASK IDS (for swap_resource), PROGRESS (streak/day counter), RECENT CHECK-IN FEEDBACK, PATTERN ALERTS, BEHAVIOR RULES, PROPOSED_CHANGES FORMAT, AVAILABLE PILLAR IDS
- **PROPOSED_CHANGES format**: Supports both single object and array of actions:

```
PROPOSED_CHANGES
[{"action": "<action>", "changes": {<changes>}}, ...]
```

Pillar actions: `add_pillar`, `delete_pillar`, `edit_pillar`, `swap_pillar`, `change_level`, `full_recalibration`
Plan actions (Phase 6): `adjust_pacing`, `restructure_plan`, `swap_resource`, `regenerate_upcoming`

## apply-mentor-changes

Applies pillar and plan mutations proposed by the mentor. Phase 6 added plan-aware actions and auto-cleanup on pillar changes.

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` only (no admin client needed)
- **Shared helpers**: `getActivePlan()`, `getCurrentWeek()`, `cleanupFutureBlocks()`, `updateOutlinePillar()`
- **Actions**:

| Action                | What it does                                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add_pillar`          | Insert pillar + topic clusters, auto-increment sort_order. **Phase 6**: also adds pillar to future weeks in plan_outline and deletes uncompleted future blocks for regeneration         |
| `delete_pillar`       | Delete pillar + its topic_map + phase_weights. **Phase 6**: also deletes pillar's uncompleted plan_blocks/tasks and removes from plan_outline                                           |
| `edit_pillar`         | Update pillar fields. **Whitelist**: `name`, `description`, `why_it_matters`, `phase_weight` only                                                                                       |
| `swap_pillar`         | Delete one pillar, add another (combines enhanced delete + add). **Phase 6**: includes plan cleanup for both old and new pillar                                                         |
| `change_level`        | Set `current_level` on a pillar (clamped 1–5). Resets `blocks_completed_at_level` to 0                                                                                                  |
| `full_recalibration`  | Returns `{ redirect: "/onboarding" }` — no DB changes, client handles redirect                                                                                                          |
| `adjust_pacing`       | Updates `user_profile.pacing_profile` + `learning_plans.pacing_profile`. Validates: aggressive, steady, exploratory                                                                     |
| `restructure_plan`    | Replaces future weeks in `plan_outline` JSONB, updates `total_weeks`, deletes uncompleted future blocks. Validates no past/current week modifications                                   |
| `swap_resource`       | Updates a single uncompleted plan_task with new action/platform/resource. Whitelist: `action`, `platform`, `resource_type`, `url`, `search_query`, `why_text`, `estimated_time_minutes` |
| `regenerate_upcoming` | Deletes all uncompleted blocks after current week (and their tasks). Dashboard regenerates on-demand via normal flow                                                                    |

## generate-plan

Generates multi-week learning plans, individual plan blocks, and plan extensions. Three modes. Rewrites the old generate-unit logic (Phase 3), with difficulty adjustment added in Phase 5.

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Rate limits**: 50 calls/user/day, 100 calls/IP/day via `api_rate_limits` table. Skipped for calls carrying `X-Background-Token` matching `INTERNAL_BACKGROUND_SECRET`.
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `INTERNAL_BACKGROUND_SECRET`
- **AI model**: `gemini-3.1-flash-lite` via Google Generative AI REST API
- **Token budget**: Outline mode uses 4000 tokens. Block mode scales with `time_commitment` using same TOKEN_BUDGET tiers as before (15min→1800, 30→3000, 60+→5000), adjusted per pillar based on active pillar count.
- **JSON parsing**: Strips markdown code fences, extracts JSON between `{...}`. Retries once with stricter prompt on parse failure.

| Mode             | Input                                                                                                                                   | What it does                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full_plan`      | `{ mode: "full_plan" }`                                                                                                                 | Fetches user profile, pillars, phases, topic maps → Gemini generates multi-week outline → stores in `learning_plans` → generates week 1 plan blocks for each active pillar → initializes `user_progress`. Returns `{ success, plan_id, total_weeks, warnings? }`                                                                                                                                                                        |
| `plan_block`     | `{ mode: "plan_block", plan_id, week_number, pillar_id, weekly_goal, active_pillar_count?, difficulty_adjustment?, feedback_context? }` | Fetches pillar context, curated resources (keyword-matched), previous blocks → Gemini generates detailed block with tasks → stores in `plan_blocks` + `plan_tasks`. Optional `difficulty_adjustment` ("harder"/"easier"/"same") and `feedback_context` (user feedback string) are injected into the AI prompt to adapt difficulty. Returns `{ success, block_id }`                                                                      |
| `extend_plan`    | `{ mode: "extend_plan", plan_id, additional_weeks }`                                                                                    | Fetches existing plan outline + completed blocks with feedback → Gemini generates additional week outlines continuing from where the user left off → appends to `plan_outline`, updates `total_weeks` → generates first new week's blocks. Returns `{ success, new_total_weeks }`                                                                                                                                                       |
| `interview_plan` | `{ mode: "interview_plan" }`                                                                                                            | Fetches interview context from user_profile + interview-specific pillars → Gemini generates 1-3 week intensive outline → stores in `learning_plans` with `plan_type: 'interview_prep'` → generates ALL weeks' blocks immediately (short plan needs full visibility). Only deactivates other `interview_prep` plans, NOT `learning` plans. Pacing: `intensive` (5-8 tasks/block). Returns `{ success, plan_id, total_weeks, warnings? }` |
| `sprint_plan`    | `{ mode: "sprint_plan" }`                                                                                                               | Phase 10: Fetches profile, pillars, phases, topic maps → Gemini generates career goal + sprint arc (3-5 sprints) + detailed sprint 1 with 1-2 focus pillars → stores in `learning_plans` with `plan_format: 'sprint'`, `total_weeks: null` → generates sprint 1 blocks. Returns `{ success, plan_id, total_sprints, warnings? }`                                                                                                        |
| `next_sprint`    | `{ mode: "next_sprint", plan_id, sprint_number, checkin_summary?, focus_pillars }`                                                      | Phase 10: Called after sprint check-in. Generates updated arc + next sprint detail for chosen focus pillars → updates `plan_outline` and `sprint_started_at` → generates blocks. Returns `{ success, block_ids, warnings? }`                                                                                                                                                                                                            |

- **Resource matching**: Static keyword map from pillar name → `curated_resources.skill_area` values, filtered by level. Falls back to AI-generated search queries when no curated resources match.
- **Level 1 primers**: When pillar level is 1, context_brief includes setup instructions based on `user_profile.tool_setup` flags.
- **New pillar intros**: First block for any pillar includes a pillar introduction in context_brief.
- **Pacing profiles**: aggressive (4-6 tasks, urgent tone), steady (3-4 tasks, encouraging), exploratory (2-3 tasks, relaxed). Time estimates split across active pillars.
- **Re-onboarding**: Deactivates old active plan before creating new one.
- **Triggered from**: `Onboarding.tsx` `handleConfirm()` (sprint_plan), `ContextUpload.tsx` `handleGeneratePlan()` (sprint_plan), `Dashboard.tsx` `handleCheckinSubmit()` (plan_block with difficulty params), `Dashboard.tsx` `handleExtendPlan()` (extend_plan), `SprintCheckin.tsx` `handleStartNextSprint()` (next_sprint).

## onboarding-chat

AI-guided onboarding conversation that discovers the user's career context and builds their learning architecture.

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Rate limits**: 50 calls/user/day, 100 calls/IP/day via `api_rate_limits` table
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- **AI model**: `gemini-3.1-flash-lite` via Google Generative AI REST API
- **Settings**: max_tokens 4096, temperature 0.7
- **Message limits**: Max 2000 chars per user message, max 16000 chars per assistant message
- **No DB writes** — client handles all saves to user_profile, pillars, topic_map, phases, onboarding_conversations

| Action     | Input                                     | Returns                                               |
| ---------- | ----------------------------------------- | ----------------------------------------------------- |
| `start`    | `{ action: "start", messages: [] }`       | `{ message }` — opening greeting                      |
| `continue` | `{ action: "continue", messages: [...] }` | `{ message }` or `{ message, outputs }` when complete |

- **Completion detection**: AI wraps final output in `[ONBOARDING_COMPLETE]...[/ONBOARDING_COMPLETE]` block containing JSON with `{ pillars, phases, topicMap, pacing_profile, time_commitment, job_situation, job_timeline_weeks, tool_setup, primary_focus }`. Function parses it and returns `{ message, outputs }`.
- **Soft cap**: After 10 user turns, system prompt hints AI to conclude.
- **Discovery dimensions**: Career identity, skill landscape, learning style, growth priorities, unique context, situation & urgency, practical context (time commitment, tool setup). Phase 2 added dimensions 6-7.
- **Output shape**: `outputs.pillars[]` has `name, description, why_it_matters, starting_level, key_topics`. `outputs.phases[]` has `name, timeline_start, timeline_end, goal, weights`. `outputs.topicMap[]` has `pillar, cluster_name, subtopics, difficulty_level`. Phase 2 additions: `outputs.pacing_profile` (aggressive/steady/exploratory), `outputs.time_commitment`, `outputs.job_situation`, `outputs.job_timeline_weeks`, `outputs.tool_setup` (JSON with python_installed, github_familiar, has_ide, used_practice_platforms). Phase 9.3 addition: `outputs.primary_focus` ("interview_prep" or "long_term_learning") — conservative detection, defaults to long_term_learning.
- **Primary focus detection**: When `primary_focus === "interview_prep"` AND `job_timeline_weeks <= 3`, Onboarding.tsx routes to `/interview-onboarding` instead of saving pillars/phases and generating a learning plan.

## interview-onboarding

Fast-track interview prep onboarding conversation (3-4 turns). Phase 9 addition.

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Rate limits**: 50 calls/user/day, 100 calls/IP/day
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- **AI model**: `gemini-3.1-flash-lite` via Google Generative AI REST API
- **Settings**: max_tokens 4096, temperature 0.7
- **MIN_USER_TURNS**: 3 (vs 6 for main onboarding)
- **No DB writes** — client handles all saves

| Action     | Input                                     | Returns                                               |
| ---------- | ----------------------------------------- | ----------------------------------------------------- |
| `start`    | `{ action: "start", messages: [] }`       | `{ message }` — opening greeting                      |
| `continue` | `{ action: "continue", messages: [...] }` | `{ message }` or `{ message, outputs }` when complete |

- **Completion detection**: AI wraps output in `[INTERVIEW_PREP_COMPLETE]...[/INTERVIEW_PREP_COMPLETE]`
- **Output shape**: `{ target_role, company, company_context, interview_date, intensity, weak_areas, interview_format, interview_pillars[], plan_duration_weeks, time_commitment }`
- **Conversation flow**: Turn 1 (role + timeline) → Turn 2 (format + weak spots + time) → Turn 3 (company context + final check)
- **Triggered from**: `InterviewOnboarding.tsx`

## mock-interview

AI mock interview sessions with persistent conversation state. Phase 9 Phase 2 addition.

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Rate limits**: 200 calls/user/day (high — many messages per session), 100 calls/IP/day
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- **AI model**: `gemini-3.1-flash-lite` via Google Generative AI REST API
- **Settings**: max_tokens 4096, temperature 0.7
- **DB writes**: Yes — uses `supabaseAdmin` (unlike interview-onboarding which is stateless). Creates and updates `mock_interviews` rows.
- **Message limits**: Max 2000 chars per user message

| Action     | Input                                      | Returns                                                                     |
| ---------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| `start`    | `{ action: "start", task_id }`             | `{ mock_id, message, interview_type }` — creates DB row + first AI question |
| `continue` | `{ action: "continue", mock_id, message }` | `{ message, completed, feedback? }` — appends to conversation               |
| `complete` | `{ action: "complete", mock_id }`          | `{ message, feedback, completed: true }` — forces early evaluation          |

- **Interview type derivation**: Parses task action text for keywords (behavioral, sql/technical, system_design, case_study). Defaults to behavioral.
- **System prompts**: Per-type prompts (behavioral=STAR method, technical=SQL problems, system_design=architecture, case_study=product). Common rules appended: stay in character, one question at a time, acknowledge before next.
- **Completion detection**: AI wraps feedback in `[INTERVIEW_COMPLETE]...JSON...[/INTERVIEW_COMPLETE]`. After 6+ user messages, prompt hints to wrap up. Forced completion adds explicit instruction.
- **Feedback JSON shape**: `{ overall_score, strengths[], areas_to_improve[], key_mistakes[], question_scores[{ question, score, note }], suggested_follow_up }`
- **Fallback feedback**: If AI doesn't include completion tag on forced end, builds minimal feedback object (score 5).
- **Duration**: Calculated from `mock_interviews.created_at` to completion time.
- **Triggered from**: `TaskItem.tsx` (start action via button click), `MockInterview.tsx` (continue/complete actions)

## practice-feedback

Single-shot AI feedback for inline practice questions. Phase 11B addition.

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Rate limits**: 100 calls/user/day, 100 calls/IP/day
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- **AI model**: `gemini-2.0-flash-lite` via Google Generative AI REST API
- **Settings**: max_tokens 1500, temperature 0.5
- **DB writes**: Yes — updates `plan_tasks` (attempt_count, user_answers, last_feedback). Auto-marks `is_completed = true` on attempt 2.

**Input:** `{ task_id, answer (max 2000 chars), attempt (1 or 2) }`

**Logic:**

1. Auth + rate limit
2. Fetch task, verify ownership, check `resource_type === "practice_question"`, check `attempt_count < 2`
3. Fetch parent block + pillar for context (pillar name + level)
4. Build prompt: concise evaluator. Structure: correct → missing → key insight → (attempt 1) improvement hint / (attempt 2) final assessment
5. Call Gemini, update plan_tasks columns, auto-complete on attempt 2
6. Return `{ feedback, attempt, completed, can_retry }`

**`user_answers` structure:** `[{ answer, feedback, attempt }]`

- **Triggered from**: `TaskItem.tsx` practice question UI (submit button)

## process-checkin

Handles task completion analysis, streak tracking, pacing detection, pillar leveling, and plan progression. Rewrites the old unit-based process-feedback logic (Phase 5).

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Rate limits**: 200 calls/user/day (higher than standard 50 since task completions are frequent), 100 calls/IP/day
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`

| Event type       | Input                                          | Returns                                                                                                                    |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `task_complete`  | `{ event_type, task_id }`                      | `{ success, streak, pacing_note, block_auto_complete, block_id, gap_return }`                                              |
| `block_complete` | `{ event_type, block_id, difficulty?, note? }` | `{ success, level_up, difficulty_adjustment, feedback_context, plan_status, next_block, plan_complete_data, nearing_end }` |

- **task_complete**: Verifies task is completed, updates streak authoritatively in `user_progress` (replaces frontend streak logic), detects pacing (ahead/behind based on days since block creation), checks if block is now fully complete.
- **block_complete**: Marks block completed with `checkin_feedback`, handles pillar leveling (threshold-based with acceleration/deceleration from consecutive feedback), generates difficulty adjustment signal for next block, detects plan completion and near-end for exploratory plans.
- **Pillar leveling thresholds** (configurable constants): L1→2: 2 blocks, L2→3: 2, L3→4: 3, L4→5: 3. Two consecutive "too_easy" → immediate level up. Two consecutive "too_hard" → prevent level up.
- **Frontend integration**: `task_complete` is fire-and-forget (non-blocking). `block_complete` is awaited (response drives next-block generation and level-up toasts).
- **Sprint awareness (Phase 10)**: When `plan.plan_format === 'sprint'` and all blocks are done, returns `sprint_checkin_pending: true` + `sprint_number` instead of `next_block.should_generate`. Dashboard redirects to `/sprint-checkin`. Pacing detection uses 10-day window instead of 7 for sprint plans.

## sprint-checkin

AI-facilitated sprint check-in conversation between sprints. Phase 10 addition.

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Rate limits**: 50 calls/user/day, 100 calls/IP/day
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- **AI model**: `gemini-3.1-flash-lite` via Google Generative AI REST API
- **DB writes**: Yes — uses `supabaseAdmin`. Creates and updates `sprint_checkins` rows. Applies pillar level adjustments on completion.

| Action     | Input                                         | Returns                                                              |
| ---------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `start`    | `{ action: "start", plan_id }`                | `{ checkin_id, message, messages, sprint_number }` — creates session |
| `continue` | `{ action: "continue", checkin_id, message }` | `{ message, messages, completed, summary?, suggested_pillars? }`     |

- **Conversation flow**: AI reflects on sprint completion data → asks about experience → recommends 1-2 pillars for next sprint → emits `[CHECKIN_COMPLETE]...JSON...[/CHECKIN_COMPLETE]`
- **Completion detection**: Parses `[CHECKIN_COMPLETE]` tag (same pattern as mock-interview). After 4+ user turns, system prompt hints to wrap up.
- **Summary JSON shape**: `{ sprint_review, difficulty_signals: {pillar: "harder"|"easier"|"same"}, suggested_focus: [{pillar_name, reason}], pacing_note }`
- **On completion**: Applies pillar level adjustments (harder → level up, easier → level down), updates `sprint_checkins.status = 'completed'`, stores `ai_summary`
- **Resume support**: `start` action checks for existing in-progress checkin and returns its messages if found
- **Triggered from**: `SprintCheckin.tsx` (start on mount, continue on each user message)

## reset-user-data

Destructive data reset endpoint with three modes.

- **Auth**: Bearer JWT → `supabase.auth.getUser()` for user ID
- **Input**: `{ mode: "full" | "rewind" | "delete_account" }`
- **Returns**: `{ success: true }`
- **Service role client**: Used for all deletes (bypasses RLS on tables like `cycles`, `units`, `progress_archive`) and for `admin.auth.admin.deleteUser()`
- **All modes** delete Phase 2 interview data first (mistake_journal → mock_interviews), then ProngGSD plan data (plan_tasks → plan_blocks → learning_plans → user_progress) — all in FK-safe order.
- **`full` mode**: Deletes everything — progress_archive, cycles (cascades → units), plan data, phases (cascades → phase_weights), pillars (cascades → topic_map, phase_weights), mentor_conversations, onboarding_conversations, personal_notes, api_rate_limits, user_profile. Client redirects to `/onboarding`.
- **`rewind` mode**: Owner-only (checked against `OWNER_EMAIL` env var, 403 if not owner). Deletes progress_archive, cycles (cascades → units), plan data, mentor_conversations, personal_notes, api_rate_limits. Resets `topic_map.status` to `queued`. Preserves profile, pillars, phases, onboarding_conversations. Client redirects to `/dashboard` → `/context-upload` (no plan). ContextUpload detects existing pillars and shows "Generate Plan" button to skip re-onboarding.
- **`delete_account` mode**: Same full-data delete as `full`, then calls `admin.auth.admin.deleteUser(userId)` to remove the auth user. Client calls `supabase.auth.signOut()` and redirects to `/auth`.
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`
