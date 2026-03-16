# Phase 4: Separate Interview Prep Dashboard

**Overall Progress:** `100%`

## TLDR

Replace the toggle-based dual dashboard with a fully separate interview prep experience. Dedicated `/interview-dashboard` page, interview-focused mentor mode, and clean navigation separation so learning and interview prep never bleed into each other.

## Critical Decisions

- **Dedicated page, not a mode flag:** New `InterviewDashboard.tsx` at `/interview-dashboard` instead of a viewMode toggle on the existing Dashboard. Simpler state, cleaner separation.
- **Mentor gets explicit mode param:** Pass `mode: "interview_prep"` from the frontend to `gsd-mentor-chat` so the system prompt can switch personality (interview coach vs. career mentor). No new edge function needed.
- **Reuse existing components:** InterviewCountdown, MistakeJournalDisplay, DailyTaskList, TaskItem all work as-is — they just move to the new page. No rewrites.
- **Navigation swap, not duplication:** When on `/interview-dashboard`, the sidebar/bottom nav shows interview-relevant links (Interview Dashboard, Plan, Mock Interviews, Mentor, Settings). No learning-specific links visible.
- **`/plan` stays shared:** PlanOverview already filters by `plan_type` via localStorage. InterviewDashboard sets `pronggsd-dashboard-view` to `"interview_prep"` on mount, so `/plan` shows the right plan automatically.

## Tasks:

- [x] 🟩 **Step 1: Create InterviewDashboard page**
  - [x] 🟩 Create `src/pages/InterviewDashboard.tsx` — queries only `interview_prep` plan, renders InterviewCountdown + DailyTaskList + MistakeJournalDisplay + "Start Mock Interview" quick action
  - [x] 🟩 Add "Back to Learning Dashboard" link at top (navigates to `/dashboard`)
  - [x] 🟩 Sets `localStorage pronggsd-dashboard-view` to `"interview_prep"` on mount (so `/plan` and other shared pages filter correctly)

- [x] 🟩 **Step 2: Simplify main Dashboard**
  - [x] 🟩 Remove `viewMode` state, `interviewPlan` query, `DashboardToggle`, and all interview_prep conditional branches from `Dashboard.tsx`
  - [x] 🟩 Dashboard only queries/displays `learning` plan
  - [x] 🟩 Add "Enter Interview Prep" card/button that links to `/interview-dashboard` (shown when an active `interview_prep` plan exists — single lightweight query)
  - [x] 🟩 Sets `localStorage pronggsd-dashboard-view` to `"learning"` on mount

- [x] 🟩 **Step 3: Add route and navigation**
  - [x] 🟩 Add `/interview-dashboard` route in `App.tsx` with `ProtectedRoute` guard
  - [x] 🟩 Update Layout.tsx to be context-aware: detect current path prefix and show interview nav set vs. learning nav set
  - [x] 🟩 Bottom mobile nav: swap items when on interview pages (Prep replaces Today, History removed)

- [x] 🟩 **Step 4: Interview-focused mentor**
  - [x] 🟩 Pass `mode` field (`"learning"` or `"interview_prep"`) in the request body from `Mentor.tsx` to `gsd-mentor-chat`
  - [x] 🟩 In `gsd-mentor-chat/index.ts`: read `mode` from request body. When `"interview_prep"`, use interview-coaching system prompt, filter pillars to `sort_order >= 100`, filter plan to `interview_prep` type, add INTERVIEW CONTEXT section.
  - [x] 🟩 Update mentor quick actions: when mode is `"interview_prep"`, show interview-relevant actions. Updated opening message.

- [x] 🟩 **Step 5: Redirect flows**
  - [x] 🟩 After interview onboarding completes → redirect to `/interview-dashboard`
  - [x] 🟩 After interview prep rewind → redirect to `/interview-onboarding` (verified — handled by Dashboard no-plan redirect)
  - [x] 🟩 MockInterview.tsx "Back to Dashboard" link → `/interview-dashboard`

- [x] 🟩 **Step 6: Clean up DashboardToggle**
  - [x] 🟩 Delete `src/components/plan/DashboardToggle.tsx` (no longer needed)
  - [x] 🟩 No remaining imports/references

- [x] 🟩 **Step 7: Update documentation**
  - [x] 🟩 Review work done — update CLAUDE.md files and AGENT_LOG.md
