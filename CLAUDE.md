# ProngGSD — Agent Context

## What this app is

ProngGSD ("Get Shit Done") is an AI-powered learning orchestrator, forked from DailyProng. Instead of generating learning content directly, it builds personalized multi-week plans that route users to the best external platforms for each skill, with task tracking and pacing adaptation. Users complete a structured AI onboarding, then follow a plan of daily tasks with external resources. An AI mentor provides ongoing career guidance and can restructure the plan. Dark/light theme.

**Status:** Phase 10 (Sprint Redesign) in progress. Replaced rigid 8-16 week learning plans with iterative focused sprint cycles. Each sprint concentrates on 1-2 pillars with ~10 practice units, completion-based (no calendar deadline). AI-facilitated check-in conversation between sprints suggests next focus area. New `sprint_checkins` table, new `gsd-sprint-checkin` edge function, new `/sprint-checkin` page. Sprint is default for all new learning plans. Weekly format is legacy (no migration needed). Phase 9.5 (Crash Course Mode) complete. See `IMPLEMENTATION_DOC_LEARNING_ORCHESTRATOR.md` for the full vision.

## Tech Stack

- **Framework**: React 18.3 + Vite 5
- **Language**: TypeScript 5.8
- **UI**: shadcn/ui + Tailwind CSS 3.4 + Radix UI
- **Routing**: React Router v6
- **Animations**: Framer Motion
- **Data fetching**: TanStack Query v5
- **Forms**: React Hook Form + Zod
- **Markdown**: react-markdown
- **Charts**: Recharts
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **AI**: Gemini 3.1 Flash Lite via Google Generative AI REST API (key never in client)
- **Deployment**: Vercel

## Project Structure

```
prong_gsd/
├── src/
│   ├── main.tsx              # Entry point → App.tsx
│   ├── App.tsx               # Providers, routes, guards
│   ├── pages/                # Route-level components
│   ├── components/           # Layout, NavLink, UnitDisplay, plan/ (task tracker)
│   │   └── ui/               # shadcn/ui primitives — do not edit
│   ├── hooks/                # Auth, demo, theme, mentor name, mobile, toast
│   ├── integrations/supabase/# Auto-generated client + types — do not edit
│   ├── lib/                  # utils.ts (cn() helper only)
│   └── test/                 # Vitest setup + Playwright config
├── supabase/
│   ├── config.toml           # Project config, function settings
│   ├── migrations/           # Postgres schema SQL
│   └── functions/            # Edge functions (Deno) — all prefixed with gsd-
│       ├── gsd-mentor-chat/         # AI mentor conversation
│       ├── gsd-apply-mentor-changes/ # Apply pillar mutations
│       ├── gsd-generate-plan/       # AI plan generation (multi-week outlines + weekly plan blocks)
│       ├── gsd-crashcourse-onboarding/ # AI generic crash course onboarding (open-ended chat)
│       ├── gsd-interview-onboarding/ # AI interview prep mini-onboarding (3-4 turns)
│       ├── gsd-mock-interview/      # AI mock interview sessions (start/continue/complete)
│       ├── gsd-onboarding-chat/     # AI onboarding conversation
│       ├── gsd-practice-feedback/   # AI practice question feedback (single-shot, 2 attempts)
│       ├── gsd-process-checkin/     # Task/block completion, streak, pacing, pillar leveling
│       ├── gsd-sprint-checkin/      # AI sprint check-in conversation (start/continue)
│       └── gsd-reset-user-data/     # Destructive data reset
└── package.json
```

Each subfolder has its own `CLAUDE.md`. Read it when working in that folder.

## Core Data Model

### Legacy tables (from DailyProng — still exist, do not delete)

| Table                        | Purpose                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| **user_profile**             | User info, career goals, mentor name, learning prefs + ProngGSD fields              |
| **phases**                   | Named time-bounded learning phases with goals                                       |
| **pillars**                  | Strategic skill pillars (name, level 1–5, trend, weight, blocks_completed_at_level) |
| **phase_weights**            | Many-to-many link: phase ↔ pillar with weight                                       |
| **topic_map**                | Clusters of subtopics per pillar, priority-ordered                                  |
| **cycles**                   | Themed multi-section learning cycles per pillar                                     |
| **units**                    | Individual learning units with content + feedback                                   |
| **progress_archive**         | Completed cycle summaries                                                           |
| **mentor_conversations**     | Mentor chat history (role + content)                                                |
| **onboarding_conversations** | Onboarding chat state (messages jsonb)                                              |
| **personal_notes**           | Free-form user notes                                                                |
| **api_rate_limits**          | Rate limit tracking per user/IP/endpoint                                            |

### New ProngGSD tables (Phase 1)

| Table                 | Purpose                                                                                                                                                             | RLS                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **curated_resources** | External learning resources (shared, no user_id)                                                                                                                    | authenticated SELECT |
| **learning_plans**    | Multi-week plan per user                                                                                                                                            | user_id scoped       |
| **plan_blocks**       | Weekly task sets per pillar                                                                                                                                         | user_id scoped       |
| **plan_tasks**        | Individual tasks within plan blocks. Practice questions use `attempt_count`, `user_answers` (jsonb array of `{answer, feedback, attempt}`), `last_feedback` columns | user_id scoped       |
| **user_progress**     | Streak and progress tracking                                                                                                                                        | user_id scoped       |

### Interview Prep tables (Phase 9)

| Table               | Purpose                                              | RLS            |
| ------------------- | ---------------------------------------------------- | -------------- |
| **mock_interviews** | AI mock interview sessions with conversation history | user_id scoped |
| **mistake_journal** | Post-mock mistake tracking (timebox method)          | user_id scoped |

### Sprint tables (Phase 10)

| Table               | Purpose                                       | RLS            |
| ------------------- | --------------------------------------------- | -------------- |
| **sprint_checkins** | AI sprint check-in conversations with summary | user_id scoped |

### New columns on learning_plans

`plan_format` — `'weekly'` (default/legacy) or `'sprint'` (new default). Sprint plans use iterative focused cycles.

`sprint_started_at` — When the current sprint began. Reset at each new sprint start.

`plan_type` — `'learning'` (default) or `'interview_prep'`. Both can be `is_active = true` simultaneously.

`crashcourse_type` — `'interview'`, `'generic'`, or null. Distinguishes interview prep from generic crash courses. All crash courses use `plan_type: 'interview_prep'` for backwards compat. Generic crash courses store `crashcourse_topic` and `crashcourse_deadline` in `plan_outline` JSON.

### New columns on user_profile

`pacing_profile`, `time_commitment`, `job_situation`, `job_timeline_weeks`, `tool_setup`, `resume_text`, `linkedin_context`, `interview_target_role`, `interview_company`, `interview_company_context`, `interview_date`, `interview_intensity`, `interview_weak_areas`, `interview_format`

## Key Architectural Rules

### Cloud-first (not optional)

Supabase is **required**. All user data lives in Postgres. No local-first fallback.

### Demo mode (currently hidden)

`useDemo()` context still exists but the entry point on the Auth page is hidden. Demo mode is tied to the old unit flow which is replaced by a placeholder.

### Auth guards

- **`ProtectedRoute`** — demo → render; loading → spinner; no session → redirect `/auth`
- **`AuthRoute`** — demo → redirect `/dashboard`; loading → spinner; session → redirect `/dashboard`; else render Auth

### AI calls stay server-side

All LLM calls route through Supabase Edge Functions. The client never touches an API key. Current model: `gemini-3.1-flash-lite` via Google Generative AI REST API.

### Edge functions share Supabase project with DailyProng

All ProngGSD edge functions are prefixed with `gsd-` to avoid collisions. DailyProng's original functions still exist on the shared Supabase project.

### Mentor name

Stored in `user_profile.mentor_name`. Demo uses `"Sage"`. Loaded via `useMentorName()` hook.

### Theme

`pronggsd-theme` key in localStorage. `dark` class on `<html>`. Default: `dark`. Toggle via `useTheme()`.

### Auto-generated files — do not edit

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`

### shadcn/ui primitives — do not edit

Everything in `src/components/ui/` is a shadcn/ui primitive. Add new ones via the shadcn CLI, never edit existing ones manually.

## Routes

| Path                      | Component             | Guard     | Purpose                                                                                                                                                                                                    |
| ------------------------- | --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth`                   | Auth                  | AuthRoute | Login/signup (demo hidden)                                                                                                                                                                                 |
| `/`                       | —                     | —         | Redirects to `/dashboard`                                                                                                                                                                                  |
| `/dashboard`              | Dashboard             | Protected | Learning plan daily task view. Redirects to `/context-upload` if no plan.                                                                                                                                  |
| `/crash-course`           | CrashCourseSelector   | Protected | Crash course type selector + active crash course list. Entry point for all crash courses.                                                                                                                  |
| `/crash-course/:planId`   | CrashCourseDashboard  | Protected | Unified crash course dashboard — handles both interview and generic types. Countdown, tasks, conditional mock/mistake features.                                                                            |
| `/crashcourse-onboarding` | CrashCourseOnboarding | Protected | Generic crash course AI onboarding (open-ended chat → review → confirm). Straight to chat, no upload phase.                                                                                                |
| `/interview-dashboard`    | InterviewDashboard    | Protected | Backwards-compat redirect — finds active interview plan and redirects to `/crash-course/:planId`.                                                                                                          |
| `/plan`                   | PlanOverview          | Protected | Full multi-week plan timeline (redirects to `/onboarding` if no plan)                                                                                                                                      |
| `/context-upload`         | ContextUpload         | Protected | Resume/LinkedIn PDF upload before onboarding (optional, skippable). Redirects to `/dashboard` if plan exists. If pillars exist but no plan (post-rewind), shows "Generate Plan" button to skip onboarding. |
| `/onboarding`             | Onboarding            | Protected | AI onboarding chat                                                                                                                                                                                         |
| `/interview-onboarding`   | InterviewOnboarding   | Protected | Interview prep mini-onboarding (3-4 turns). Redirects to `/crash-course/:planId` on completion.                                                                                                            |
| `/sprint-checkin`         | SprintCheckin         | Protected | AI sprint check-in conversation + pillar selection for next sprint. Chat phase → review phase with pillar picker → next sprint generation.                                                                 |
| `/mock-interview/:id`     | MockInterview         | Protected | AI mock interview chat + feedback + mistake journal                                                                                                                                                        |
| `/progress`               | Progress              | Protected | Plan-based progress: stats, streak + heatmap, weekly/pillar charts (Recharts), pillar levels, plan summary                                                                                                 |
| `/history`                | History               | Protected | Plan blocks with tasks, searchable/filterable by pillar and week                                                                                                                                           |
| `/settings`               | SettingsPage          | Protected | Profile, mentor name, pillars, LinkedIn/resume context, danger zone                                                                                                                                        |
| `/mentor`                 | Mentor                | Protected | AI mentor chat (plan-aware, multi-action)                                                                                                                                                                  |
| `/about`                  | About                 | None      | Static "What is a Prong?" page                                                                                                                                                                             |
| `*`                       | NotFound              | None      | 404                                                                                                                                                                                                        |

## Running the App

```bash
cd prong_gsd
npm install
npm run dev        # Vite dev server
npm run build      # Production build
npm run test       # Vitest
npm run test:watch # Vitest watch mode
npm run lint       # ESLint
npm run preview    # Preview production build
```

Env vars in `.env.local`:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key

Edge function env vars (set in Supabase dashboard):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` — Google Generative AI API key (used by gsd-mentor-chat, gsd-generate-plan, gsd-onboarding-chat, gsd-interview-onboarding, gsd-mock-interview)
- `OWNER_EMAIL` — Owner account email; gets 500/day rate limit instead of 50

## Common Gotchas

- `Index.tsx`, `NavLink.tsx`, `UnitDisplay.tsx` were deleted in Phase 8 — if referenced elsewhere, those references are stale
- README says the env var is `VITE_SUPABASE_ANON_KEY` but `client.ts` actually reads `VITE_SUPABASE_PUBLISHABLE_KEY` — use the latter
- `supabase/config.toml` has `verify_jwt = false` for both edge functions — JWT validation is done manually in the function code
- Path alias: `@/` maps to `src/`
- Dashboard (learning) redirects to `/context-upload` if no learning plan. InterviewDashboard redirects to `/dashboard` if no interview plan. Block polling has a 30s timeout with retry button on failure.
- `gsd-reset-user-data` deletes ProngGSD plan data (plan_tasks → plan_blocks → learning_plans → user_progress) in all modes (rewind, full, delete_account). Rewind preserves profile, pillars, phases, onboarding_conversations — use it to test plan generation without re-doing onboarding.
- ContextUpload shows "Generate Plan from Existing Pillars" button when pillars exist but no plan (post-rewind state), calling `gsd-generate-plan` directly with `full_plan` mode
- Demo mode entry point is hidden on Auth page — demo context still exists but is non-functional with new task tracker dashboard
- `useUnitGeneration` hook was removed in Phase 4, file deleted in Phase 8
- Plan block completion routes through `gsd-process-checkin` (block_complete) → then frontend calls `gsd-generate-plan` for next week with difficulty_adjustment from the response
- Streak tracking is authoritative in `gsd-process-checkin` — frontend does NOT write to `user_progress` for streaks (only decrements `total_tasks_completed` on un-completion)
- Task completion fires `gsd-process-checkin` as fire-and-forget (non-blocking); block completion awaits the response
- `pillars.blocks_completed_at_level` tracks blocks completed at current level for threshold-based leveling — reset to 0 on level change
- `gsd-generate-plan` has four modes: `full_plan`, `plan_block`, `extend_plan`, `interview_plan` — interview_plan generates 1-3 week intensive crash courses with all blocks upfront
- `learning_plans.plan_type` scopes plans: `'learning'` or `'interview_prep'`. Both can be active simultaneously. Learning dashboard at `/dashboard`, interview prep at `/interview-dashboard` — fully separate pages. localStorage `pronggsd-dashboard-view` tracks which mode was last active (used by shared pages like `/plan` and `/mentor`).
- Interview prep plan generation only deactivates other `interview_prep` plans, NOT `learning` plans (and vice versa)
- Interview-specific pillars use `sort_order >= 100` to avoid collision with main learning pillars
- Mobile bottom nav has 5 items (History hidden) — History is only in the desktop nav
- `About.tsx` rebranded from DailyProng to ProngGSD in Phase 8
- localStorage keys use `pronggsd-` prefix (not `dailyprong-`)
- Mentor chat PROPOSED_CHANGES supports both single object and array format — frontend `parseProposedChanges` handles both
- `apply-mentor-changes` auto-cleans future plan blocks when adding/deleting/swapping pillars — no separate `regenerate_upcoming` needed
- Mentor.tsx uses query invalidation (not `window.location.reload()`) after applying changes — queries: `learning-plan`, `plan-blocks-current`, `plan-tasks`, `user-progress`, `pillars`
- `swap_resource` in apply-mentor-changes uses `new_action`, `new_platform`, etc. as input keys (prefixed with `new_`) mapped to task columns
- `restructure_plan` only accepts future weeks (> current week) — past/current weeks preserved automatically
- `change_level` via mentor resets `blocks_completed_at_level` to 0 (same as process-checkin leveling)
- Progress page uses Recharts via shadcn/ui `ChartContainer` from `src/components/ui/chart.tsx` — first actual chart usage in the app
- Progress page derives activity heatmap from `plan_tasks.completed_at` — no historical streak table exists
- Progress page shows pillar levels as current snapshot only — no historical level change data stored
- History page replaced legacy units view with plan blocks + tasks — old units data no longer displayed
- History page fetches all blocks + all tasks in two queries (bounded by plan size, not paginated)
- `gsd-mock-interview` manages persistent conversation sessions server-side (supabaseAdmin writes) — unlike interview-onboarding which is stateless. Three actions: start (creates row + first AI question), continue (appends messages), complete (forces evaluation).
- Mock interview completion detected via `[INTERVIEW_COMPLETE]...JSON...[/INTERVIEW_COMPLETE]` tag in AI response. Forced completion (early end) builds fallback feedback if AI doesn't include the tag.
- TaskItem renders "Start Mock Interview" button when `resource_type === "mock_interview"` — calls the edge function to create a session, then navigates to `/mock-interview/:id`
- `gsd-generate-plan` passes through `resource_type: "mock_interview"` (not collapsed to `"search_query"`) — tasks with this type have `platform: "ProngGSD"`, null url/search_query, and MOCK: prefixed actions
- MistakeJournalForm marks the parent `plan_task` as completed when saving (or skipping) — this is the only completion path for mock interview tasks
- MistakeJournalDisplay appears on InterviewDashboard (always shown) — shows last 10 mistakes with pattern detection
- `gsd-reset-user-data` deletes `mistake_journal` → `mock_interviews` before `plan_tasks` (FK order)
- Main onboarding detects interview prep focus: if `outputs.primary_focus === "interview_prep"` AND `job_timeline_weeks <= 3`, Onboarding.tsx routes to `/interview-onboarding` instead of generating a learning plan. Conservative — defaults to `long_term_learning` when ambiguous.
- Phase 4: Dashboard and InterviewDashboard are fully separate pages. `DashboardToggle.tsx` was deleted. Layout.tsx swaps nav items based on current path.
- Phase 4: `gsd-mentor-chat` accepts optional `mode` param (`"learning"` or `"interview_prep"`). When interview mode: uses interview coach persona, filters pillars to `sort_order >= 100`, filters plan to `interview_prep` type, adds INTERVIEW CONTEXT section with date/company/weak areas.
- Phase 9.5: InterviewDashboard.tsx is now a redirect wrapper — finds active interview plan and redirects to `/crash-course/:planId`. All crash course dashboards use CrashCourseDashboard.tsx.
- Phase 9.5: Layout.tsx has a prominent orange "Crash Course" header button (desktop). `CRASH_COURSE_PATHS` expanded from `INTERVIEW_PATHS` to include all crash course routes. When in crash course mode, button shows "Back to Learning" instead.
- Phase 9.5: CrashCourseSelector at `/crash-course` shows type picker (Interview Prep + Something Else) when no active crash courses, or active plan cards + "Start New" when plans exist. Max 3 concurrent crash courses.
- Phase 9.5: CrashCourseOnboarding at `/crashcourse-onboarding` goes straight to AI chat (no upload phase). AI insists on context/materials. Uses `gsd-crashcourse-onboarding` edge function with `[CRASHCOURSE_COMPLETE]` tag pattern.
- Phase 9.5: `gsd-generate-plan` `interview_plan` mode now accepts optional `crashcourse_type`, `crashcourse_topic`, `crashcourse_deadline` params. Generic crash courses use adapted prompts without interview-specific content (no mock interviews, no STAR method references).
- Phase 9.5: `gsd-mentor-chat` accepts optional `crashcourse_type` param. Generic crash courses get "crash course coach" persona instead of "interview coach". Behavior rules adapted for study focus.
- Phase 9.5: Mentor.tsx has 3 quick action sets: `LEARNING_QUICK_ACTIONS`, `INTERVIEW_QUICK_ACTIONS`, `GENERIC_CRASHCOURSE_QUICK_ACTIONS`. Selection based on localStorage `pronggsd-dashboard-view` + `pronggsd-crashcourse-type`.
- Phase 9.5: InterviewOnboarding.tsx now redirects to `/crash-course/:planId` (not `/interview-dashboard`) and passes `crashcourse_type: "interview"` to plan generation.
- Phase 9.5: `learning_plans.crashcourse_type` column: `'interview'` or `'generic'` for crash courses, null for learning plans. All crash courses still use `plan_type: 'interview_prep'`.
- Phase 10: Sprint system replaces weekly plans as the default for new learning plans. `plan_format` column: `'weekly'` (legacy) or `'sprint'` (new default). Sprint plans use `total_weeks: null` (open-ended), `sprint_started_at` tracks current sprint start.
- Phase 10: Sprint plans reuse `plan_blocks.week_number` as `sprint_number` — no schema change. All existing queries work because they treat week_number as a sequential grouping key.
- Phase 10: Sprints are completion-based, no calendar deadline. Each sprint focuses on 1-2 pillars (deep dive). AI suggests next focus at check-in.
- Phase 10: `gsd-generate-plan` has six modes: `full_plan`, `plan_block`, `extend_plan`, `interview_plan`, `sprint_plan`, `next_sprint`.
- Phase 10: `gsd-process-checkin` returns `sprint_checkin_pending: true` when all sprint blocks are done. Dashboard shows check-in prompt instead of auto-generating next blocks.
- Phase 10: For sprint plans, Dashboard auto-fires `block_complete` when all tasks are checked (no CheckinModal). CheckinModal only shows for legacy weekly plans.
- Phase 10: SprintCheckin.tsx at `/sprint-checkin` — AI chat (3-5 turns) → review phase with pillar selection → "Start Next Sprint" calls `next_sprint` mode.
- Phase 10: `sprint_checkins` table stores multi-turn conversations. `gsd-sprint-checkin` edge function with start/continue actions (same pattern as `gsd-mock-interview`).
- Phase 10: `gsd-reset-user-data` deletes `sprint_checkins` before `learning_plans` (FK order).
- Phase 10: Onboarding.tsx and ContextUpload.tsx call `sprint_plan` mode instead of `full_plan` for new learning plans.
- Phase 11B: `practice_question` resource_type renders inline in TaskItem — textarea + "Submit Answer" + AI feedback. Max 2 attempts. Checkbox disabled until at least 1 attempt. Auto-completes on attempt 2.
- Phase 11B: `gsd-practice-feedback` edge function — single-shot feedback. Input: `{ task_id, answer, attempt }`. Rate limit: 100/user/day. Updates `attempt_count`, `user_answers`, `last_feedback` on `plan_tasks`. Auto-marks completed on attempt 2.
- Phase 11B: `plan_tasks` has 3 practice question columns: `attempt_count` (int, default 0), `user_answers` (jsonb, default `[]`), `last_feedback` (text). Structure: `[{answer, feedback, attempt}]`.
- Phase 11B: Old "Practice DRILL" mentor-redirect flow removed. `extractDrillQuestion()` deleted from TaskItem, `practiceState`/`activePracticeQuestion`/`[PRACTICE DRILL FEEDBACK REQUEST]` wrapping deleted from Mentor.tsx. Old Practice DRILL tasks from existing plans will render as plain text (no special interaction).

---

## Self-Improving Loop — READ THIS

This context system is designed to get better over time. **You are expected to maintain it.**

**After every task, before marking work done:**

1. Did anything behave unexpectedly or differ from what a CLAUDE.md described? → Fix the CLAUDE.md immediately and log it in `AGENT_LOG.md`.
2. Nothing to log? → Still write a one-liner in `AGENT_LOG.md`: `## YYYY-MM-DD — [task] — No issues found`.

This step is **not optional**. An empty `AGENT_LOG.md` means the loop is broken.

See root `CLAUDE.md` for the full log format.
