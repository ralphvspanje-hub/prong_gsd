# Design Brief: 14-Day Sprint Cycle for Main Learning Plans

## Problem Statement

The current main learning plan uses a weekly model (8-16 weeks, one block per pillar per week) that has friction:

- Users miss days and the "Week 3" framing becomes meaningless after gaps
- No structured check-in point to reflect and adjust
- The plan feels like a long march — no natural pause to ask "is this still right?"
- Week counting breaks down when life happens (travel, sick days, busy periods)

## Proposed Solution: 14-Day Sprint Cycles

Replace the linear week-based plan with **iterative 14-day sprints**, each ending with a structured check-in conversation.

### Core Concept

- The user still has a **main goal** (career direction, skill development target) that persists across sprints
- Each sprint is a self-contained 14-day learning block with clear objectives
- At the end of each sprint, an **AI-facilitated retrospective** asks:
  - How did it go? What did you actually complete?
  - What was too hard / too easy / not relevant?
  - Do you want to adjust pillars, pacing, or focus areas?
  - Any life changes (new job, interview coming up, etc.)?
- The AI then generates the next sprint, incorporating feedback
- **Day counting is relative to sprint start**, not calendar weeks — if you miss 3 days, you just have 11 "training days" in that sprint, not a confusing "you're in week 2 day 4"

### Key Design Decisions Needed

1. **Sprint structure**: Is it literally 14 calendar days, or "14 training days" (only days you actually do something)? Calendar days is simpler and creates natural urgency. Training days is more forgiving but harder to scope.

2. **Block generation**: Currently blocks are per-pillar-per-week. In a sprint model, should blocks cover the full 14 days per pillar, or still be ~7 days each (2 blocks per pillar per sprint)?

3. **Sprint check-in**: New edge function or reuse `gsd-mentor-chat`? Probably a new `gsd-sprint-checkin` function that has access to sprint completion data and can propose structural changes.

4. **Plan outline**: Currently `learning_plans.plan_outline` stores weekly goals for 8-16 weeks upfront. In the sprint model, do we:
   - Generate only the current sprint's outline (and plan the next one at check-in)?
   - Generate a high-level "arc" of 4-6 sprints but only detail the current one?

5. **Migration path**: Users with existing weekly plans — do we migrate them to sprint format, or let them finish their current plan and start fresh?

### What Stays the Same

- Pillars, topic maps, phases — all still relevant
- Daily task lists and the dashboard UX
- AI mentor chat
- Task completion + streak tracking
- Crash courses remain separate (they're already short and intensive)

### What Changes

- `learning_plans` needs a `sprint_number` or `current_sprint` field
- Plan generation needs a "sprint" mode that generates 14 days of content
- A new sprint check-in flow (page + edge function)
- Dashboard shows "Day 7 of Sprint 3" instead of "Week 5"
- Plan overview shows sprint arcs instead of 16-week timeline
- `gsd-process-checkin` block_complete logic needs to know about sprint boundaries

### User's Intent (Ralph's words)

> "I want a main goal still that it will follow so same concepts but with shorter and more iterative design also because the user can miss some days and the counting of days and week plans would be very weird and not fitting after a long time."

The spirit is: **keep the long-term direction, but make the execution iterative and forgiving.** The plan shouldn't feel stale or rigid after 6 weeks of imperfect adherence.

### Relationship to Current Work

This is **separate from and should be implemented AFTER** the 3 current fixes (time estimates, hours/days input, AI guardrails). Those fixes improve the existing system; this redesigns the plan lifecycle.

### Suggested Approach for Implementation Agent

1. Start by reading `CLAUDE.md`, `IMPLEMENTATION_DOC_LEARNING_ORCHESTRATOR.md`, and `gsd-generate-plan/index.ts` thoroughly
2. Design the sprint data model (what changes in `learning_plans`, `plan_blocks`, `user_progress`)
3. Design the sprint check-in conversation flow
4. Design the migration path for existing plans
5. Plan the UI changes (dashboard, plan overview, progress page)
6. Implement in phases: data model → generation → check-in → UI
