# src/pages/ — Agent Context

## All Routes

| File | Route | Guard | Purpose |
|------|-------|-------|---------|
| Auth.tsx | `/auth` | AuthRoute | Login/signup form (demo entry hidden) |
| ContextUpload.tsx | `/context-upload` | ProtectedRoute | Resume/LinkedIn PDF upload before onboarding (optional, skippable). Redirects to `/dashboard` if plan exists. |
| Dashboard.tsx | `/dashboard` | ProtectedRoute | Three-layer daily task view: streak, weekly goals, task list with checkboxes. Redirects to `/context-upload` if no active plan. Polls for blocks with 30s timeout on generation failure. |
| PlanOverview.tsx | `/plan` | ProtectedRoute | Full multi-week plan timeline with completion status per week. Redirects to `/onboarding` if no active plan. |
| Onboarding.tsx | `/onboarding` | ProtectedRoute | AI onboarding chat → blueprint review → confirm. Stays on page if plan generation fails (does not redirect to dashboard). |
| Progress.tsx | `/progress` | ProtectedRoute | Plan-based progress: summary stats, streak + activity heatmap, weekly completion chart (Recharts), pillar level cards, pillar completion chart, compact plan summary with link to /plan |
| History.tsx | `/history` | ProtectedRoute | Completed plan blocks with tasks, searchable/filterable by pillar and week. Collapsible block cards with read-only task list. |
| SettingsPage.tsx | `/settings` | ProtectedRoute | Mentor name, learning prefs, pillar management, LinkedIn/resume context, danger zone |
| Mentor.tsx | `/mentor` | ProtectedRoute | AI mentor chat with pillar + plan quick actions, multi-action PROPOSED_CHANGES support |
| About.tsx | `/about` | None | Static "What is a Prong?" content page |
| NotFound.tsx | `*` | None | 404 page |
| ~~Index.tsx~~ | — | — | **Deleted in Phase 8.** `/` redirects to `/dashboard` in App.tsx. |

## Route Guards (defined in App.tsx)

- **`ProtectedRoute`** — If `isDemo` → render children. If loading → spinner. If no session → redirect to `/auth`.
- **`AuthRoute`** — If `isDemo` → redirect to `/dashboard`. If loading → spinner. If session → redirect to `/dashboard`. Otherwise render Auth page.

## No-plan redirects (Phase 4)

Dashboard redirects to `/context-upload` when the user has no active `learning_plan`. ContextUpload redirects to `/dashboard` if plan exists. PlanOverview redirects to `/onboarding` if no plan. Other protected routes remain accessible without a plan (e.g., Settings for uploading resume/LinkedIn before completing onboarding).
