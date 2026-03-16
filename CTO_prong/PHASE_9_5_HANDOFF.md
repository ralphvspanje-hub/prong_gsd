## Phase 9.5: Crash Course Mode — Context from Previous Session

### What this app is

ProngGSD is an AI-powered learning orchestrator. Users complete a structured AI onboarding, get a personalized multi-week plan that routes them to external platforms, and track tasks daily. An AI mentor provides ongoing career guidance. The main experience lives at `/dashboard` (learning plan).

### What exists now (just built, deployed, on `main`)

We added a **separate interview prep dashboard** at `/interview-dashboard`:

- `InterviewDashboard.tsx` — queries only `interview_prep` plan, renders InterviewCountdown + DailyTaskList + MistakeJournalDisplay
- `Layout.tsx` is **context-aware** — detects paths starting with `/interview-dashboard` or `/mock-interview` and swaps nav items (shows "Prep" instead of "Today", hides History). Shows "PREP" badge next to logo.
- `Dashboard.tsx` is **learning-only** — shows "Enter Interview Prep" card when interview plan exists, or "Start a crash course" card when none exists. Sets `localStorage pronggsd-dashboard-view` to `"learning"` on mount.
- `Mentor.tsx` reads `localStorage pronggsd-dashboard-view` to derive mode, passes `mode` param (`"learning"` or `"interview_prep"`) to `gsd-mentor-chat` edge function
- `gsd-mentor-chat` accepts `mode` — switches to interview coach persona, filters pillars to `sort_order >= 100`, filters plan to `interview_prep` type, adds INTERVIEW CONTEXT section with interview-specific behavior rules
- `InterviewOnboarding.tsx` handles interview prep setup (context phase with JD/resume upload → 3-turn AI chat → review → confirm → generates plan → redirects to `/interview-dashboard`)
- `MockInterview.tsx` at `/mock-interview/:id` — AI mock interview sessions, back links to `/interview-dashboard`
- `DashboardToggle.tsx` was **deleted** — toggle-based approach replaced with separate pages

### What the user wants to change

The current approach is too interview-specific. The user wants a **generalized "Crash Course" concept** that supports any intensive short-term learning goal — not just job interviews. The entry point should be a **prominent header button**, not cards on the learning dashboard.

### The Full Vision

#### 1. Header Button — "Crash Course"

A **standalone prominent button** in `Layout.tsx` header, right side (between the nav links and the theme/logout buttons). Visually distinct — filled orange/accent style, not ghost.

**Behavior based on state:**

- **No active crash course plans** → navigates to `/crash-course` (type selector page)
- **Exactly 1 active crash course plan** → navigates directly to the crash course dashboard for that plan
- **2-3 active crash course plans** → navigates to `/crash-course` which shows a selector of active crash courses (with option to start a new one if under max)
- **When already IN crash course mode** → button becomes "Back to Learning" (muted style) → navigates to `/dashboard`
- **Max 3 concurrent crash course plans**

#### 2. Crash Course Type Selector Page (`/crash-course`)

New page. Shows different content based on state:

**When no active crash courses:**
Two cards to choose crash course type:

- **"Job Interview Prep"** — icon, subtitle "Land your next role with a targeted crash course". Navigates to existing `/interview-onboarding`.
- **"Something Else"** — icon, subtitle "English test, certification exam, coding bootcamp, or anything urgent". Navigates to new `/crashcourse-onboarding`.

**When 1+ active crash courses exist:**
Shows the active crash course(s) as clickable cards (name, type, progress indicator) + a "Start New Crash Course" card (if under max of 3). Clicking an active crash course goes to its dashboard.

#### 3. Generic "Something Else" Crash Course Onboarding

A NEW flow for non-interview crash courses. **Skip context upload, go straight to AI chat.** The AI will:

- Ask what the user needs to prepare for (test name, exam, certification, etc.)
- Gather as much context as possible — timeline/deadline, what they're least comfortable with, current level, what specifically scares them
- **Insist** the user provide any relevant text/documents ("any text files, syllabi, study guides you think are relevant for me to know")
- Assess their current level through conversation
- After enough turns, produce structured outputs: pillars, plan duration, topic areas

**New edge function:** `gsd-crashcourse-onboarding` — open-ended AI chat (NOT the fixed 3-turn structure of interview onboarding). More like the main `gsd-onboarding-chat` but focused on short-term intensive goals.

**New frontend page:** `CrashCourseOnboarding.tsx` at `/crashcourse-onboarding`

- Chat interface (reuse patterns from InterviewOnboarding chat phase)
- Review phase showing the generated plan structure
- On confirm: creates pillars (sort_order >= 100), saves metadata to user_profile (may need new columns like `crashcourse_topic`, `crashcourse_deadline`), calls `gsd-generate-plan` with `interview_plan` mode (reuse — it already handles intensive short plans with `plan_type: 'interview_prep'`), redirects to crash course dashboard

#### 4. Crash Course Dashboard

Generalize `InterviewDashboard.tsx` to handle both interview prep AND generic crash courses:

- **Interview prep crash course** shows: InterviewCountdown, tasks, MistakeJournalDisplay, mock interview button on tasks
- **Generic crash course** shows: deadline countdown (if provided), tasks, simpler progress view (no mock interviews, no mistake journal unless relevant)
- Both show: streak, pacing banner, weekly goals, "View full plan" link

The dashboard needs to know WHICH crash course plan to display (important when user has multiple). Could use URL param or route like `/crash-course/:planId`.

#### 5. Mentor in Crash Course Mode

Already mostly works via the `mode` param. Needs generalization:

- Currently only "interview coach" persona when `mode === "interview_prep"`
- Needs to also work as a focused coach for generic crash courses (e.g., "English test tutor" or "certification prep coach")
- The persona should adapt based on what the crash course is about
- Quick actions should adapt too (currently only LEARNING and INTERVIEW sets — need a GENERIC_CRASHCOURSE set)

#### 6. Clean up Dashboard.tsx

Remove the "Enter Interview Prep" and "Start a crash course" cards from the learning dashboard. The header button is now the sole entry point to crash courses. Main dashboard should be purely about the long-term learning plan.

#### 7. Settings in Crash Course Mode

The Settings page in crash course mode should be simplified — just crash-course-relevant settings. Include an option to "Start Another Crash Course" (if under max of 3).

### Architecture Decisions (confirmed with user)

- **Build on top of Phase 9.4** — don't revert anything. Generalize and extend.
- **Standalone header button** — NOT a nav item. Prominent orange button.
- **Reuse Layout with swapped nav** — keep the `Layout.tsx` approach of detecting crash course paths.
- **Two separate onboarding flows** — keep `gsd-interview-onboarding` for job prep. New `gsd-crashcourse-onboarding` for everything else.
- **Multiple crash courses** — max 3 can coexist. All use `plan_type: 'interview_prep'` in the DB (backwards compatible). Distinguished by metadata.
- **One crash course → straight to dashboard. Multiple → show selector.**
- **Generic onboarding: straight to chat, no upload phase.** AI insists on context.

### Key files to read/modify

**Frontend:**
| File | What it does now | What changes |
|------|-----------------|--------------|
| `src/App.tsx` | Routes | Add `/crash-course`, `/crashcourse-onboarding`, possibly `/crash-course/:planId` |
| `src/components/Layout.tsx` | Context-aware nav, `INTERVIEW_PATHS` detection | Add header button, expand path detection to `CRASH_COURSE_PATHS` |
| `src/pages/Dashboard.tsx` | Learning-only, has interview prep cards | Remove interview/crash course cards (header button replaces them) |
| `src/pages/InterviewDashboard.tsx` | Interview prep dashboard | Generalize into crash course dashboard, handle multiple plan types |
| `src/pages/InterviewOnboarding.tsx` | Interview prep onboarding | Keep as-is (it's the "Job Interview Prep" flow) |
| `src/pages/Mentor.tsx` | Mode-aware mentor | Add generic crash course quick actions and persona |
| `src/pages/MockInterview.tsx` | Mock interview chat | Keep as-is (interview-specific feature) |

**New files to create:**
| File | Purpose |
|------|---------|
| `src/pages/CrashCourseSelector.tsx` | Type selector / active crash course selector at `/crash-course` |
| `src/pages/CrashCourseOnboarding.tsx` | Generic crash course onboarding (AI chat → review → confirm) |
| `supabase/functions/gsd-crashcourse-onboarding/index.ts` | AI onboarding for generic crash courses |

**Edge functions to modify:**
| File | What changes |
|------|-------------|
| `gsd-mentor-chat/index.ts` | Generalize persona beyond just "interview coach" |
| `gsd-generate-plan/index.ts` | May need to handle generic crash course context (not just interview data) |

### Data model considerations

- `learning_plans.plan_type` stays `'interview_prep'` for all crash courses (backwards compatible). To distinguish crash course types, may need a new column or use existing metadata.
- Interview-specific pillars already use `sort_order >= 100`. Generic crash course pillars should too.
- `user_profile` interview columns work for job prep. Generic crash courses may need new columns (or store metadata in a JSON column).
- Consider: should each crash course plan have a `crashcourse_type` field? Or store in `plan_outline` metadata?

### Important constraints

- **Don't break existing interview prep data** — users have `plan_type: 'interview_prep'` plans already.
- **The main dashboard must stay clean** — no crash course UI except the header button.
- **Read `CLAUDE.md` at project root** for full tech stack, conventions, gotchas.
- All edge functions prefixed with `gsd-`. Deno runtime. Gemini API for AI.
- shadcn/ui in `src/components/ui/` — don't edit manually.
- Follow the Self-Improving Loop: update CLAUDE.md files and AGENT_LOG.md after implementation.

### Suggested implementation order

1. **CrashCourseSelector page** — type selector + active crash course list
2. **Header button in Layout.tsx** — query for active crash course plans, conditional navigation
3. **Clean up Dashboard.tsx** — remove interview/crash course cards
4. **CrashCourseOnboarding page + edge function** — generic onboarding flow
5. **Generalize InterviewDashboard** — handle both crash course types, support plan ID routing
6. **Generalize Mentor** — crash course persona + quick actions for generic type
7. **Settings in crash course mode** — "Start another crash course" option
8. **Documentation** — update CLAUDE.md files, AGENT_LOG.md

Now read CLAUDE.md at project root and plan this implementation. Use `/create-plan` to plan it.
