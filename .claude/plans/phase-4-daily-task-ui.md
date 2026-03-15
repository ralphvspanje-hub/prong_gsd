# Phase 4: Daily Task UI — Implementation Plan

**Overall Progress:** `100%`

## TLDR
Replace the read-only plan outline dashboard with the three-layer task tracker — the core daily experience of ProngGSD. Users see their streak, weekly goals, and interactive task list with checkboxes. Completing tasks updates progress/streaks, and finishing a week's block triggers the next week's generation.

## Critical Decisions
- **Show all tasks per week**: No batching/pagination — plan generation already scopes to user's time commitment (3-6 tasks per pillar)
- **Frontend extracts weekly_goal**: Parse `plan_outline` JSON client-side to get next week's goal for `gsd-generate-plan` calls — no edge function changes
- **Skip demo mode**: Not worth wiring up until the real flow is solid
- **Remove useUnitGeneration**: Clean break from old unit model — remove provider, hook, all refs
- **Hide History on mobile**: Keep mobile bottom nav at 5 items (Today, Plan, Progress, Settings, Mentor)
- **No-plan redirect scope**: Only `/dashboard` and `/plan` redirect to onboarding — other protected routes stay accessible
- **Poll for blocks**: Handle plan-exists-but-no-blocks race condition with refetch interval

## Tasks:

- [x] 🟩 **Step 1: Schema + types update**
  - [x] 🟩 Create migration SQL: add `checkin_feedback jsonb` to `plan_blocks`
  - [x] 🟩 Update `src/integrations/supabase/types.ts` with `checkin_feedback` field on `plan_blocks`

- [x] 🟩 **Step 2: Remove useUnitGeneration**
  - [x] 🟩 Delete `src/hooks/useUnitGeneration.tsx`
  - [x] 🟩 Remove `UnitGenerationProvider` wrapper from `App.tsx`
  - [x] 🟩 Remove references in `src/hooks/CLAUDE.md` and `src/CLAUDE.md`
  - [x] 🟩 Verify `npm run build` passes

- [x] 🟩 **Step 3: Navigation updates**
  - [x] 🟩 Add "Plan" nav item (Map icon) to `Layout.tsx` after "Today"
  - [x] 🟩 Hide "History" from mobile bottom nav (keep in desktop nav)
  - [x] 🟩 Add `/plan` route in `App.tsx` with `ProtectedRoute` guard

- [x] 🟩 **Step 4: Route guards for no-plan users**
  - [x] 🟩 In Dashboard: if user has no active `learning_plan`, redirect to `/onboarding`
  - [x] 🟩 In Plan page: same redirect logic
  - [x] 🟩 Handle plan-exists-but-no-blocks state: show "Generating your first week..." with polling via TanStack Query `refetchInterval`

- [x] 🟩 **Step 5: StreakCounter component**
  - [x] 🟩 Build component: displays "Day {n}" and "{n}-day streak" from `user_progress`
  - [x] 🟩 Fetch `user_progress` via TanStack Query
  - [x] 🟩 Hide streak text when streak is 0

- [x] 🟩 **Step 6: PacingBanner component**
  - [x] 🟩 Build conditional banner reading `pacing_note` from current plan blocks
  - [x] 🟩 Render nothing when no pacing note exists

- [x] 🟩 **Step 7: WeeklyGoalCard component**
  - [x] 🟩 Build component: "Week {n}" header + weekly goal per active pillar
  - [x] 🟩 Fetch current (uncompleted, lowest week_number) plan blocks via TanStack Query

- [x] 🟩 **Step 8: PrimerView component**
  - [x] 🟩 Build dismissible primer view rendering `context_brief` as markdown
  - [x] 🟩 "Got it, show me the tasks" button collapses it
  - [x] 🟩 Persist dismissed state in localStorage (`pronggsd-primer-dismissed-{block_id}`)
  - [x] 🟩 Show only when block has non-empty `context_brief`

- [x] 🟩 **Step 9: TaskItem component**
  - [x] 🟩 Build component: checkbox, action text, platform badge (colored by platform), time estimate
  - [x] 🟩 Curated resources: clickable link opens URL in new tab
  - [x] 🟩 Search queries: construct platform-specific search URL (YouTube, Google, GitHub, LeetCode, HackerRank fallback)
  - [x] 🟩 Why text: show inline if short (<100 chars), collapsible toggle if longer
  - [x] 🟩 Completed state: checked, muted/strikethrough styling

- [x] 🟩 **Step 10: DailyTaskList component**
  - [x] 🟩 Build component: fetch tasks for current week's plan blocks via TanStack Query
  - [x] 🟩 Group tasks by pillar (pillar name as section header, skip header if single pillar)
  - [x] 🟩 Sort: incomplete tasks first, completed tasks at bottom of each group
  - [x] 🟩 Show today's completed tasks (checked off) for progress visibility

- [x] 🟩 **Step 11: Task completion flow**
  - [x] 🟩 Optimistic UI update on checkbox click (immediate visual feedback)
  - [x] 🟩 Update `plan_tasks` in DB (`is_completed`, `completed_at`)
  - [x] 🟩 Update `user_progress`: streak logic (null/not-yesterday → reset to 1, yesterday → increment), day counter, total tasks
  - [x] 🟩 Invalidate TanStack Query caches for tasks and progress
  - [x] 🟩 Task un-completion: reverse flow, decrement total, don't touch streak
  - [x] 🟩 Framer Motion animation on completion (subtle scale + checkmark, 200-300ms)

- [x] 🟩 **Step 12: CheckinModal component**
  - [x] 🟩 Build dialog: "Week {n} — {pillar} complete!", difficulty buttons (Too easy / Just right / Too hard), optional text area
  - [x] 🟩 On submit: store feedback as `checkin_feedback` jsonb on completed `plan_block`
  - [x] 🟩 Mark plan block as completed (`is_completed`, `completed_at`)
  - [x] 🟩 Trigger next plan block generation: parse `plan_outline` for next week's goal, call `gsd-generate-plan` with mode `plan_block`
  - [x] 🟩 Show loading state while next block generates, then refresh dashboard
  - [x] 🟩 Dismissible without feedback — still completes block and triggers next generation

- [x] 🟩 **Step 13: Plan completion modal**
  - [x] 🟩 Detect when last plan block is completed (no more weeks in outline)
  - [x] 🟩 Show completion modal: "You did it!" with "What's next?" (→ mentor chat) and "Start fresh" (→ onboarding)

- [x] 🟩 **Step 14: Assemble Dashboard page**
  - [x] 🟩 Rewrite `Dashboard.tsx`: StreakCounter → PacingBanner → WeeklyGoalCard → PrimerView → DailyTaskList → "View full plan" link
  - [x] 🟩 Loading state: skeleton placeholders while data fetches
  - [x] 🟩 Detect plan block completion → show CheckinModal or plan completion modal
  - [x] 🟩 Wrap in Layout

- [x] 🟩 **Step 15: Plan overview page (`/plan`)**
  - [x] 🟩 Build page: vertical timeline of all weeks from `plan_outline`
  - [x] 🟩 Cross-reference `plan_blocks` for completion status per week
  - [x] 🟩 Visual states: completed (checked/dimmed), current (highlighted/expanded), future (dimmed)
  - [x] 🟩 Back button to dashboard

- [x] 🟩 **Step 16: Build verification + polish**
  - [x] 🟩 `npm run build` succeeds with no errors
  - [x] 🟩 Mobile responsiveness check on daily task view (narrow viewport)
  - [x] 🟩 Verify all empty/loading/completion states render correctly

- [x] 🟩 **Step 17: Update documentation**
  - [x] 🟩 Review work done — did anything behave unexpectedly or differ from what CLAUDE.md described?
  - [x] 🟩 If yes: log it in `AGENT_LOG.md` and fix the relevant `CLAUDE.md` immediately
