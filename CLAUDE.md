# ProngGSD — Agent Context

## What this app is

ProngGSD ("Get Shit Done") is an AI-powered learning orchestrator, forked from DailyProng. Instead of generating learning content directly, it builds personalized multi-week plans that route users to the best external platforms for each skill, with task tracking and pacing adaptation. Users complete a structured AI onboarding, then follow a plan of daily tasks with external resources. An AI mentor provides ongoing career guidance and can restructure the plan. Dark/light theme.

**Status:** Phase 1 (Foundation) complete. Dashboard is a placeholder — new task tracker UI coming in Phase 4. See `IMPLEMENTATION_DOC_LEARNING_ORCHESTRATOR.md` for the full vision.

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
│   ├── components/           # Layout, NavLink, UnitDisplay
│   │   └── ui/               # shadcn/ui primitives — do not edit
│   ├── hooks/                # Auth, demo, theme, mentor name, mobile, toast, unit generation
│   ├── integrations/supabase/# Auto-generated client + types — do not edit
│   ├── lib/                  # utils.ts (cn() helper only)
│   └── test/                 # Vitest setup + Playwright config
├── supabase/
│   ├── config.toml           # Project config, function settings
│   ├── migrations/           # Postgres schema SQL
│   └── functions/            # Edge functions (Deno) — all prefixed with gsd-
│       ├── gsd-mentor-chat/         # AI mentor conversation
│       ├── gsd-apply-mentor-changes/ # Apply pillar mutations
│       ├── gsd-generate-plan/       # AI learning unit generation (will become plan generation)
│       ├── gsd-onboarding-chat/     # AI onboarding conversation
│       ├── gsd-process-checkin/     # Unit feedback + cycle completion (will become check-in)
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
| **pillars** | Strategic skill pillars (name, level 1–5, trend, weight) |
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

### New columns on user_profile

`pacing_profile`, `time_commitment`, `job_situation`, `job_timeline_weeks`, `tool_setup`, `resume_text`, `linkedin_context`

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
| `/dashboard` | Dashboard | Protected | Placeholder — "ProngGSD — Coming soon" |
| `/onboarding` | Onboarding | Protected | AI onboarding chat |
| `/progress` | Progress | Protected | Pillar levels + cycle history |
| `/history` | History | Protected | Past units with search/filters |
| `/settings` | SettingsPage | Protected | Profile, mentor name, pillars, danger zone |
| `/mentor` | Mentor | Protected | AI mentor chat |
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
- `GEMINI_API_KEY` — Google Generative AI API key (used by gsd-mentor-chat, gsd-generate-plan, gsd-onboarding-chat)
- `OWNER_EMAIL` — Owner account email; gets 500/day rate limit instead of 50

## Common Gotchas

- `Index.tsx` in `src/pages/` is **unused** — `/` redirects to `/dashboard`, the file is orphaned
- `NavLink.tsx` in `src/components/` is **unused** — `Layout.tsx` uses plain `Link` from react-router
- README says the env var is `VITE_SUPABASE_ANON_KEY` but `client.ts` actually reads `VITE_SUPABASE_PUBLISHABLE_KEY` — use the latter
- `supabase/config.toml` has `verify_jwt = false` for both edge functions — JWT validation is done manually in the function code
- Path alias: `@/` maps to `src/`
- Dashboard is a placeholder — the old unit-based flow was stripped in Phase 1
- Demo mode entry point is hidden on Auth page — demo context still exists but is non-functional with placeholder dashboard
- `About.tsx` still references "DailyProng" — intentionally left as-is
- localStorage keys use `pronggsd-` prefix (not `dailyprong-`)

---

## Self-Improving Loop — READ THIS

This context system is designed to get better over time. **You are expected to maintain it.**

**After every task, before marking work done:**
1. Did anything behave unexpectedly or differ from what a CLAUDE.md described? → Fix the CLAUDE.md immediately and log it in `AGENT_LOG.md`.
2. Nothing to log? → Still write a one-liner in `AGENT_LOG.md`: `## YYYY-MM-DD — [task] — No issues found`.

This step is **not optional**. An empty `AGENT_LOG.md` means the loop is broken.

See root `CLAUDE.md` for the full log format.
