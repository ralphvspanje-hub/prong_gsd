# Phase 9.5: Crash Course Mode — Implementation Plan

**Overall Progress:** `100%`

## TLDR

Generalize the existing interview prep system into a **Crash Course** concept that supports any intensive short-term goal (interviews, exams, certifications, etc.). Add a prominent header button as the sole entry point, a type selector page, a generic onboarding flow, and generalize the dashboard/mentor to handle multiple crash course types (max 3 concurrent).

## Critical Decisions

- **Reuse `plan_type: 'interview_prep'` for all crash courses** — backwards compatible, distinguished by metadata (new `crashcourse_type` field on `learning_plans`)
- **Pillar scoping unchanged** — all crash course pillars use `sort_order >= 100`
- **Two separate onboarding flows** — keep `gsd-interview-onboarding` for job prep, new `gsd-crashcourse-onboarding` for everything else
- **Header button, not nav item** — standalone orange button in Layout header, right side
- **Route structure**: `/crash-course` (selector), `/crashcourse-onboarding` (generic flow), `/crash-course/:planId` (dashboard per plan)
- **Generic onboarding: straight to AI chat** — no context upload phase, AI insists on documents/context during conversation
- **Store crash course metadata in `learning_plans.plan_outline` JSON** — add `crashcourse_type`, `crashcourse_topic`, `crashcourse_deadline` fields to avoid new DB columns

## Tasks:

- [x] 🟩 **Step 1: Data model — add `crashcourse_type` to `learning_plans`**
  - [x] 🟩 Add migration: new column `crashcourse_type TEXT` on `learning_plans` (nullable, values: `'interview'`, `'generic'`, null for learning plans)
  - [x] 🟩 Backfill existing `interview_prep` plans with `crashcourse_type = 'interview'`
  - [x] 🟩 Regenerate Supabase types

- [x] 🟩 **Step 2: CrashCourseSelector page (`/crash-course`)**
  - [x] 🟩 Create `src/pages/CrashCourseSelector.tsx`
  - [x] 🟩 Query active crash course plans (`plan_type: 'interview_prep'`)
  - [x] 🟩 No active plans → show two type cards: "Job Interview Prep" (→ `/interview-onboarding`) and "Something Else" (→ `/crashcourse-onboarding`)
  - [x] 🟩 1+ active plans → show active crash course cards (name, type, progress) + "Start New" card (if < 3)
  - [x] 🟩 Add route in App.tsx

- [x] 🟩 **Step 3: Header button in Layout.tsx**
  - [x] 🟩 Add "Crash Course" button in header (between nav links and theme/logout), filled orange style
  - [x] 🟩 Query active crash course plans count
  - [x] 🟩 No active → navigate to `/crash-course` (selector)
  - [x] 🟩 Exactly 1 active → navigate directly to `/crash-course/:planId`
  - [x] 🟩 2-3 active → navigate to `/crash-course` (shows selector with active plans)
  - [x] 🟩 When already in crash course mode → show "Back to Learning" muted button instead
  - [x] 🟩 Expand `INTERVIEW_PATHS` to `CRASH_COURSE_PATHS` — include `/crash-course`, `/crashcourse-onboarding`, `/crash-course/`

- [x] 🟩 **Step 4: Clean up Dashboard.tsx**
  - [x] 🟩 Remove "Enter Interview Prep" card
  - [x] 🟩 Remove "Start a crash course" card
  - [x] 🟩 Remove interview plan query and related state (if no longer needed)

- [x] 🟩 **Step 5: Generic crash course onboarding — edge function**
  - [x] 🟩 Create `supabase/functions/gsd-crashcourse-onboarding/index.ts`
  - [x] 🟩 Open-ended AI chat (not fixed 3-turn): ask what they're preparing for, gather context (timeline, weak areas, current level), insist on documents/syllabi
  - [x] 🟩 Actions: `start` (first message), `continue` (subsequent turns)
  - [x] 🟩 AI uses `[CRASHCOURSE_COMPLETE]...JSON...[/CRASHCOURSE_COMPLETE]` tag pattern when ready to finalize

- [x] 🟩 **Step 6: Generic crash course onboarding — frontend**
  - [x] 🟩 Create `src/pages/CrashCourseOnboarding.tsx`
  - [x] 🟩 Chat interface (reuse patterns from InterviewOnboarding chat phase)
  - [x] 🟩 Review phase showing generated plan structure (pillars, duration, topic)
  - [x] 🟩 On confirm: create pillars (`sort_order >= 100`), call `gsd-generate-plan` with `mode: "interview_plan"`, set `crashcourse_type: 'generic'` on the plan
  - [x] 🟩 Redirect to `/crash-course/:planId`
  - [x] 🟩 Add route in App.tsx

- [x] 🟩 **Step 7: Generalize InterviewDashboard → CrashCourseDashboard**
  - [x] 🟩 New `CrashCourseDashboard.tsx` at `/crash-course/:planId` — query specific plan by ID
  - [x] 🟩 Interview type: show InterviewCountdown, MistakeJournalDisplay, mock interview buttons (existing behavior)
  - [x] 🟩 Generic type: show deadline countdown (if provided), tasks, simpler progress (no mock interviews, no mistake journal)
  - [x] 🟩 Both types: streak, pacing banner, weekly goals, "View full plan" link
  - [x] 🟩 `InterviewDashboard.tsx` converted to redirect wrapper → `/crash-course/:planId`
  - [x] 🟩 Layout.tsx nav swapping works with new `CRASH_COURSE_PATHS`
  - [x] 🟩 Set localStorage `pronggsd-dashboard-view` + `pronggsd-crashcourse-type`

- [x] 🟩 **Step 8: Generalize Mentor for crash course mode**
  - [x] 🟩 Add `GENERIC_CRASHCOURSE_QUICK_ACTIONS` set in Mentor.tsx
  - [x] 🟩 Derive mentor mode from crash course type via `pronggsd-crashcourse-type` localStorage
  - [x] 🟩 Update `gsd-mentor-chat` persona: generic crash course gets "crash course coach" persona
  - [x] 🟩 Pass `crashcourse_type` to mentor edge function for context

- [x] 🟩 **Step 9: Update gsd-generate-plan for generic crash courses**
  - [x] 🟩 `generateInterviewPlan` accepts optional `crashcourse_type`, `crashcourse_topic`, `crashcourse_deadline`
  - [x] 🟩 AI prompt adapted: generic courses use foundations-first approach (not interview context-first)
  - [x] 🟩 Generic courses: no mock interview slots, no STAR method references
  - [x] 🟩 Plan record stores `crashcourse_type` column + metadata in `plan_outline` JSON

- [x] 🟩 **Step 10: Update documentation**
  - [x] 🟩 Review work done — CLAUDE.md routes/gotchas were outdated → fixed
  - [x] 🟩 Logged in `AGENT_LOG.md`
  - [x] 🟩 Updated routes table, data model section, and gotchas in `CLAUDE.md`
