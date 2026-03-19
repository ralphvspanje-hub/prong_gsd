# ProngGSD

**Your career shouldn't run on vibes.**

Start now for free: prong-gsd.vercel.app 

![React](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript_5.8-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_5-646CFF?logo=vite&logoColor=white)

---

## The problem

Most people know roughly where they want their career to go. They just don't have a plan. They take a course, forget it, read an article, forget that too. Isolated learning feels productive but doesn't compound into anything real.

And when a job interview lands in three weeks, they scramble. Random YouTube videos, undirected LeetCode grinding, hoping effort alone closes the gap.

## What ProngGSD does

ProngGSD replaces scattered self-study with structured, adaptive learning plans. An AI onboarding conversation asks hard questions about where you are and what you're trying to get to. From that, it builds **skill pillars** (strategic clusters of abilities you need to develop) and generates a plan that routes you to the best external resources for each skill.

You don't consume content inside the app. ProngGSD is a router, pointing you to YouTube tutorials, LeetCode problems, HackerRank challenges, Kaggle datasets, and whatever else fits. An AI mentor tracks your progress and can restructure the plan when your goals shift.

Interview in three weeks? Launch a crash course. Focused 1-3 week intensive with mock interviews, AI feedback, and mistake tracking. Runs alongside your main learning plan.

---

## Features

### AI onboarding

Not a form. A multi-turn conversation. The AI captures your career situation, timeline, goals, and skill gaps, then generates pillars, phases, and topic maps. You can optionally upload a resume or LinkedIn PDF to give it more context.

### Sprint-based learning

The default plan format. Open-ended, completion-based cycles. Each sprint focuses on 1-2 pillars with around 10 practice units. No calendar deadline; finish at your pace, check in with the AI, pick your next focus. (The older fixed-week format still works for existing plans.)

### Daily task tracking

Each day shows tasks grouped by pillar. Click to open external resources in a new tab: YouTube searches, LeetCode problem sets, HackerRank domains, curated articles. Check off tasks as you go. Links are platform-aware so you land in the right place.

### AI mentor

You name your mentor. They know your full plan, progress, and goals. You can ask for advice, or request real structural changes: add pillars, swap resources, adjust difficulty, restructure future weeks. The mentor writes the changes back to your plan directly.

### Crash courses and interview prep

Interview prep captures your target role, company, date, weak areas, and format in a short onboarding (3-4 turns), then generates an intensive plan with all blocks upfront, a countdown timer, mock interviews, and mistake journaling. You can also spin up generic crash courses ("Learn SQL in 2 weeks", "Prep for my presentation") that work the same way minus the interview-specific stuff. Up to 3 crash courses can run alongside your main learning plan.

### Mock interviews

The AI conducts mock interviews across behavioral (STAR method), technical/SQL, system design, and case study formats. Each session is a persistent conversation: questions, your answers, then per-question scores and an overall assessment at the end. Results feed into the mistake journal.

### Mistake journal

After each mock, log your key mistakes using a timebox method. The journal tracks patterns across sessions, so recurring weak areas surface on their own. You know what to drill next without guessing.

### Practice questions

Some tasks are practice questions that render inline instead of linking to an external site. You type your answer in a text box, submit it, and the AI gives targeted feedback. You get up to two attempts — after the first round of feedback you can revise and retry. The task auto-completes after your second attempt. You can't check it off until you've given it at least one shot.

### Sprint check-ins

Finish a sprint and the AI runs a short review conversation. How did it go? What was too hard, what was too easy? It suggests which pillars to focus on next. You pick, confirm, and the next sprint generates.

### Pillar leveling and pacing

Complete enough blocks at your current level and the pillar levels up (1 through 5). Difficulty signals from check-ins feed into the next block's generation. If everything felt too easy, the next sprint adjusts.

### Progress and analytics

Streak counter with longest streak. Weekly and per-pillar completion charts. Activity heatmap from task timestamps. Pillar level cards with progress toward the next level. Plan summary showing format, pacing, and overall completion.

### History

Searchable archive of every plan block and task. Filter by pillar, week, or sprint.

### Dark/light theme

Defaults dark. Toggle anytime.

---

## Tech stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Framework     | React 18.3 + Vite 5                                     |
| Language      | TypeScript 5.8                                          |
| UI            | shadcn/ui + Tailwind CSS 3.4 + Radix UI                 |
| Routing       | React Router v6                                         |
| Animations    | Framer Motion                                           |
| Data fetching | TanStack Query v5                                       |
| Forms         | React Hook Form + Zod                                   |
| Charts        | Recharts                                                |
| Backend       | Supabase (PostgreSQL + Auth + Edge Functions)           |
| AI            | Gemini 3.1 Flash Lite via Google Generative AI REST API |
| Deployment    | Vercel (frontend) + Supabase Cloud (backend)            |

---

## Architecture

All user data lives in Postgres. No local-first fallback; the app requires Supabase.

All LLM calls go through eleven Supabase Edge Functions (Deno). The client never holds an API key.

| Edge Function                | What it does                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `gsd-onboarding-chat`        | Multi-turn onboarding, outputs pillars, phases, topic maps                              |
| `gsd-interview-onboarding`   | Interview prep mini-onboarding (3-4 turns)                                              |
| `gsd-crashcourse-onboarding` | Generic crash course setup via AI chat                                                  |
| `gsd-generate-plan`          | Plan generation (6 modes: sprint, weekly, next sprint, extend, interview, single block) |
| `gsd-process-checkin`        | Task/block completion, streak tracking, pillar leveling, pacing                         |
| `gsd-mentor-chat`            | Stateful mentor conversation with full plan context, can propose structural changes     |
| `gsd-apply-mentor-changes`   | Applies pillar mutations, resource swaps, plan restructuring                            |
| `gsd-sprint-checkin`         | Sprint review conversation, outputs summary and pillar suggestions                      |
| `gsd-mock-interview`         | Persistent mock interview sessions with feedback generation                             |
| `gsd-practice-feedback`      | Single-shot AI feedback on practice question answers (max 2 attempts)                   |
| `gsd-reset-user-data`        | Data reset (rewind plan only, full reset, or delete account)                            |

```
User
  │
  ▼
┌────────────────┐     ┌───────────────────┐     ┌──────────────┐
│   React/Vite   │────▶│  Supabase Edge Fn  │────▶│ Gemini 3.1   │
│   Client       │◀────│  (Deno, key vault) │◀────│ Flash Lite   │
└────────────────┘     └───────────────────┘     └──────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│  Supabase PostgreSQL                   │
│  20+ tables, all RLS-scoped            │
│  Pillars, Plans, Tasks, Progress,      │
│  Mocks, Streaks, Mentor History        │
└────────────────────────────────────────┘
```

---

## How it works

Sign up, optionally upload resume/LinkedIn, do the AI onboarding chat. It maps your role, goals, timeline, and skill gaps into pillars and phases.

The system generates a sprint plan (default) or weekly plan. Each sprint focuses on 1-2 pillars with curated external tasks: YouTube, LeetCode, articles, practice drills. Open your dashboard each day, work through tasks, check them off, build your streak.

When a sprint is done, check in with the AI and pick your next focus. If your goals shift mid-plan, talk to your mentor. They can add pillars, swap resources, adjust difficulty, or restructure the whole thing. Difficulty signals from check-ins automatically tune what comes next.

Interview coming up? Launch a crash course from the nav. Intensive plan, mock interviews, mistake tracking, countdown timer. Doesn't interfere with your main plan.

---

## Project structure

```
prong_gsd/
├── src/
│   ├── main.tsx                     # Entry point
│   ├── App.tsx                      # Providers, routes, guards
│   ├── pages/                       # Route-level components
│   │   ├── Dashboard.tsx            # Daily task view (sprint/weekly)
│   │   ├── Onboarding.tsx           # AI onboarding chat
│   │   ├── SprintCheckin.tsx        # Sprint review + pillar selection
│   │   ├── MockInterview.tsx        # AI mock interview sessions
│   │   ├── CrashCourseDashboard.tsx # Crash course task view
│   │   ├── Mentor.tsx               # AI mentor chat
│   │   ├── Progress.tsx             # Analytics, streaks, charts
│   │   ├── History.tsx              # Searchable task archive
│   │   └── SettingsPage.tsx         # Profile, pillars, danger zone
│   ├── components/
│   │   ├── Layout.tsx               # Nav shell (desktop + mobile)
│   │   ├── plan/                    # Task tracker components
│   │   ├── progress/                # Chart and analytics components
│   │   ├── history/                 # Archive components
│   │   └── ui/                      # shadcn/ui primitives
│   ├── hooks/                       # Auth, theme, mentor name, etc.
│   └── integrations/supabase/       # Auto-generated client + types
├── supabase/
│   ├── migrations/                  # PostgreSQL schema
│   └── functions/                   # 11 Edge Functions (gsd-* prefixed)
└── package.json
```

---

## Running it

```bash
cd prong_gsd
npm install
npm run dev
```

Create `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Edge function secrets (set in Supabase dashboard): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.

Push to `main` and Vercel deploys automatically.

---

## How this was built

Features go through a Claude project set up as a virtual CTO before any code gets written. It pushes back until the idea holds up. Then: issue in Linear, codebase exploration, implementation plan, execution.

Every major directory has a `CLAUDE.md` with current context about what lives there and what to watch out for. Agents log confusion to `AGENT_LOG.md` and fix the docs on the spot. The context gets more accurate over time, not less.

---

## Philosophy

Don't be T-shaped. Be a prong.

A T-shaped person is deep in one domain, broad across others. That model made sense when disciplines were separate. They aren't anymore. The engineer needs product sense, the PM needs systems thinking, the data scientist needs to ship. The shape that matters is a fork: multiple sharp tines, connected and deepened over time.

ProngGSD builds your prongs.

---

<p align="center">
  Solo project by <a href="https://www.linkedin.com/in/ralphvanspanje"><strong>Ralph van Spanje</strong></a>
</p>
