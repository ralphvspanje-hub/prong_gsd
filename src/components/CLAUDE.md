# src/components/ — Agent Context

## Shared Components

| Component      | Purpose                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layout.tsx** | App shell: sticky header with context-aware nav. Learning mode: Today, Plan, Progress, History, Settings, Mentor. Interview mode (detected via `/interview-dashboard` or `/mock-interview` path prefix): Prep, Plan, Progress, Settings, Mentor. Shows "PREP" badge next to logo in interview mode. Theme toggle, sign out. Mobile bottom nav (5 items). Footer. |

## plan/ subfolder (Phase 4)

Task tracker components for the daily view and plan interaction.

| Component                     | Purpose                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **StreakCounter.tsx**         | Compact day counter + streak display. Shows flame icon for 3+ day streaks.                                                                                                                                                                                                                                                           |
| **PacingBanner.tsx**          | Conditional info banner showing pacing notes from plan blocks. Hidden when no notes.                                                                                                                                                                                                                                                 |
| **WeeklyGoalCard.tsx**        | Current week number + weekly goal per active pillar.                                                                                                                                                                                                                                                                                 |
| **PrimerView.tsx**            | Dismissible markdown primer for level 1 / new pillar introductions. State persisted in localStorage.                                                                                                                                                                                                                                 |
| **TaskItem.tsx**              | Individual task: checkbox, platform badge (colored), time estimate, resource link/search URL, expandable why text. For `resource_type: "mock_interview"` tasks, renders "Start Mock Interview" button that creates a session via `gsd-mock-interview` and navigates to `/mock-interview/:id`. Framer Motion animation on completion. |
| **DailyTaskList.tsx**         | Groups tasks by pillar. Incomplete first, completed at bottom.                                                                                                                                                                                                                                                                       |
| **MistakeJournalForm.tsx**    | Post-mock-interview reflection form. Category badges, mistake description, lesson learned. Supports multiple entries. Marks parent plan_task as completed on save/skip. Used inline on MockInterview review phase.                                                                                                                   |
| **MistakeJournalDisplay.tsx** | Interview dashboard widget showing recent mistakes from `mistake_journal`. Pattern detection (e.g., "3 of your last 10 mistakes are Communication"). Always shown on InterviewDashboard.                                                                                                                                             |
| **CheckinModal.tsx**          | End-of-week difficulty feedback dialog (Too easy / Just right / Too hard + optional note). Triggers next block generation.                                                                                                                                                                                                           |
| **PlanCompletionModal.tsx**   | Shown when entire plan is complete. "What's next?" → mentor, "Start fresh" → onboarding.                                                                                                                                                                                                                                             |

## progress/ subfolder (Phase 7)

Chart and stat components for the Progress page.

| Component                     | Purpose                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **ProgressSummaryCards.tsx**  | 4 stat cards: total tasks, streak (current + longest), days active, plan completion %.                         |
| **ActivitySection.tsx**       | Big streak counter + GitHub-style activity heatmap (last 12 weeks). Derived from task completed_at timestamps. |
| **WeeklyCompletionChart.tsx** | Recharts BarChart: tasks completed per week. Uses ChartContainer from ui/chart.tsx.                            |
| **PillarLevelCards.tsx**      | Pillar level snapshot cards with 5-bar indicator, trend icon, level delta badge, blocks at level count.        |
| **PillarCompletionChart.tsx** | Recharts horizontal BarChart: completed tasks per pillar, color-coded.                                         |
| **PlanSummaryStrip.tsx**      | Compact week status indicators (done/current/future) + pacing badge + "View full plan" link to /plan.          |

## history/ subfolder (Phase 7)

Components for the History page.

| Component         | Purpose                                                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BlockCard.tsx** | Collapsible card for a plan block: shows pillar badge, title, week, completion date, task count. Expands to show read-only task list with platform badges and resource links. Shows checkin feedback if present. |

## ui/ subfolder

Contains shadcn/ui primitives. See `ui/CLAUDE.md`. Do not edit these manually.
