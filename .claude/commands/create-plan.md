# Plan Creation Stage

Based on our full exchange, produce a markdown plan document.

Requirements for the plan:

- Include clear, minimal, concise steps.
- Track the status of each step using these emojis:
  - 🟩 Done
  - 🟨 In Progress
  - 🟥 To Do
- Include dynamic tracking of overall progress percentage (at top).
- Do NOT add extra scope or unnecessary complexity beyond explicitly clarified details.
- Steps should be modular, elegant, minimal, and integrate seamlessly within the existing codebase.

Markdown Template:

# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
Short summary of what we're building and why.

## Critical Decisions
Key architectural/implementation choices made during exploration:
- Decision 1: [choice] - [brief rationale]
- Decision 2: [choice] - [brief rationale]

## Tasks:

- [ ] 🟥 **Step 1: [Name]**
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2

- [ ] 🟥 **Step 2: [Name]**
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2

...

- [ ] 🟥 **Final Step: Update documentation**
  - [ ] 🟥 Review work done — did anything behave unexpectedly or differ from what CLAUDE.md described?
  - [ ] 🟥 If yes: log it in `AGENT_LOG.md` and fix the relevant `CLAUDE.md` immediately
  - [ ] 🟥 If no: write a single line in `AGENT_LOG.md`: `## YYYY-MM-DD — [issue] — No issues found`

Again, it's still not time to build yet. Just write the clear plan document. No extra complexity or extra scope beyond what we discussed.
## Output

After writing the plan, save it as a markdown file at `.claude/plans/<ISSUE-ID>.md`, where the issue ID comes from the arguments passed to `/explore` (e.g. `ACT-48` → `.claude/plans/ACT-48.md`). Confirm the path to the user.