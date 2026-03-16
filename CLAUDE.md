# ProngGSD — Agent Context

## What this app is

ProngGSD ("Get Shit Done") is an AI-powered learning orchestrator, forked from DailyProng. Instead of generating learning content directly, it builds personalized multi-week plans that route users to the best external platforms for each skill, with task tracking and pacing adaptation. Users complete a structured AI onboarding, then follow a plan of daily tasks with external resources. An AI mentor provides ongoing career guidance and can restructure the plan. Dark/light theme.

**Status:** Phase 9 (Interview Prep Mode) in progress. Phase 1 complete: parallel interview prep crash course. Phase 2 complete: AI mock interviews with edge function (`gsd-mock-interview`), chat UI (`/mock-interview/:id`), "Start Mock Interview" button on tasks, mistake journal (form + dashboard display). Phase 3 (main onboarding detection) pending. Previous: Phase 8 (Polish and Launch Prep) complete. See `IMPLEMENTATION_DOC_LEARNING_ORCHESTRATOR.md` for the full vision.

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
│       ├── gsd-interview-onboarding/ # AI interview prep mini-onboarding (3-4 turns)
│       ├── gsd-mock-interview/      # AI mock interview sessions (start/continue/complete)
│       ├── gsd-onboarding-chat/     # AI onboarding conversation
│       ├── gsd-process-checkin/     # Task/block completion, streak, pacing, pillar leveling
│       └── gsd-reset-user-data/     # Destructive data reset
└── package.json
```

Each subfolder has its own `CLAUDE.md`. Read it when working in that folder.

## Core Data Model

### Legacy tables (from DailyProng — still exist, do not delete)

| Table | Purpose |
|-------|---------|
| **user_profile** | User info, career goals, mentor name, learning prefs + ProngGSD fields |
| **phases** | Named time-bounded learning phases with goals |
| **pillars** | Strategic skill pillars (name, level 1–5, trend, weight, blocks_completed_at_level) |
| **phase_weights** | Many-to-many link: phase ↔ pillar with weight |
| **topic_map** | Clusters of subtopics per pillar, priority-ordered |
| **cycles** | Themed multi-section learning cycles per pillar |
| **units** | Individual learning units with content + feedback |
| **progress_archive** | Completed cycle summaries |
| **mentor_conversations** | Mentor chat history (role + content) |
| **onboarding_conversations** | Onboarding chat state (messages jsonb) |
| **personal_notes** | Free-form user notes |
| **api_rate_limits** | Rate limit tracking per user/IP/endpoint |

### New ProngGSD tables (Phase 1)

| Table | Purpose | RLS |
|-------|---------|-----|
| **curated_resources** | External learning resources (shared, no user_id) | authenticated SELECT |
| **learning_plans** | Multi-week plan per user | user_id scoped |
| **plan_blocks** | Weekly task sets per pillar | user_id scoped |
| **plan_tasks** | Individual tasks within plan blocks | user_id scoped |
| **user_progress** | Streak and progress tracking | user_id scoped |

### Interview Prep tables (Phase 9)

| Table | Purpose | RLS |
|-------|---------|-----|
| **mock_interviews** | AI mock interview sessions with conversation history | user_id scoped |
| **mistake_journal** | Post-mock mistake tracking (timebox method) | user_id scoped |

### New columns on learning_plans

`plan_type` — `'learning'` (default) or `'interview_prep'`. Both can be `is_active = true` simultaneously.

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

| Path | Component | Guard | Purpose |
|------|-----------|-------|---------|
| `/auth` | Auth | AuthRoute | Login/signup (demo hidden) |
| `/` | — | — | Redirects to `/dashboard` |
| `/dashboard` | Dashboard | Protected | Three-layer daily task view (redirects to `/onboarding` if no plan) |
| `/plan` | PlanOverview | Protected | Full multi-week plan timeline (redirects to `/onboarding` if no plan) |
| `/context-upload` | ContextUpload | Protected | Resume/LinkedIn PDF upload before onboarding (optional, skippable). Redirects to `/dashboard` if plan exists. If pillars exist but no plan (post-rewind), shows "Generate Plan" button to skip onboarding. |
| `/onboarding` | Onboarding | Protected | AI onboarding chat |
| `/interview-onboarding` | InterviewOnboarding | Protected | Interview prep mini-onboarding (3-4 turns) |
| `/mock-interview/:id` | MockInterview | Protected | AI mock interview chat + feedback + mistake journal |
| `/progress` | Progress | Protected | Plan-based progress: stats, streak + heatmap, weekly/pillar charts (Recharts), pillar levels, plan summary |
| `/history` | History | Protected | Plan blocks with tasks, searchable/filterable by pillar and week |
| `/settings` | SettingsPage | Protected | Profile, mentor name, pillars, LinkedIn/resume context, danger zone |
| `/mentor` | Mentor | Protected | AI mentor chat (plan-aware, multi-action) |
| `/about` | About | None | Static "What is a Prong?" page |
| `*` | NotFound | None | 404 |

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
- Dashboard redirects to `/context-upload` if no plan exists; shows three-layer task tracker if plan exists. Block polling has a 30s timeout with retry button on failure.
- `gsd-reset-user-data` deletes ProngGSD plan data (plan_tasks → plan_blocks → learning_plans → user_progress) in all modes (rewind, full, delete_account). Rewind preserves profile, pillars, phases, onboarding_conversations — use it to test plan generation without re-doing onboarding.
- ContextUpload shows "Generate Plan from Existing Pillars" button when pillars exist but no plan (post-rewind state), calling `gsd-generate-plan` directly with `full_plan` mode
- Demo mode entry point is hidden on Auth page — demo context still exists but is non-functional with new task tracker dashboard
- `useUnitGeneration` hook was removed in Phase 4, file deleted in Phase 8
- Plan block completion routes through `gsd-process-checkin` (block_complete) → then frontend calls `gsd-generate-plan` for next week with difficulty_adjustment from the response
- Streak tracking is authoritative in `gsd-process-checkin` — frontend does NOT write to `user_progress` for streaks (only decrements `total_tasks_completed` on un-completion)
- Task completion fires `gsd-process-checkin` as fire-and-forget (non-blocking); block completion awaits the response
- `pillars.blocks_completed_at_level` tracks blocks completed at current level for threshold-based leveling — reset to 0 on level change
- `gsd-generate-plan` has four modes: `full_plan`, `plan_block`, `extend_plan`, `interview_plan` — interview_plan generates 1-3 week intensive crash courses with all blocks upfront
- `learning_plans.plan_type` scopes plans: `'learning'` or `'interview_prep'`. Both can be active simultaneously. Dashboard toggle switches between them (stored in localStorage `pronggsd-dashboard-view`).
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
- MistakeJournalDisplay appears on Dashboard only when `viewMode === "interview_prep"` — shows last 10 mistakes with pattern detection
- `gsd-reset-user-data` deletes `mistake_journal` → `mock_interviews` before `plan_tasks` (FK order)

---

## Self-Improving Loop — READ THIS

This context system is designed to get better over time. **You are expected to maintain it.**

**After every task, before marking work done:**
1. Did anything behave unexpectedly or differ from what a CLAUDE.md described? → Fix the CLAUDE.md immediately and log it in `AGENT_LOG.md`.
2. Nothing to log? → Still write a one-liner in `AGENT_LOG.md`: `## YYYY-MM-DD — [task] — No issues found`.

This step is **not optional**. An empty `AGENT_LOG.md` means the loop is broken.

See root `CLAUDE.md` for the full log format.
