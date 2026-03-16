# Agent Learning Companion — Implementation Guide

**How to actually build this, step by step.**

Read `AGENT_LEARNING_COMPANION.md` first for the full product vision. This doc is the execution plan.

---

## Your situation right now

- You don't have OpenClaw/NanoClaw. Your friend does.
- You have ProngGSD with months of prompt iteration to reuse.
- You can write skill files and memory templates today — they're just .md files.
- You can test the brain (prompts, memory structure, logic) with Claude Code before touching OpenClaw.

---

## Phase 0: Foundation & Validation (Week 1-2)

### Step 0.1: Create the repo (Day 1 — you, alone)

Create a new repo with the full file structure. Every file is markdown. No code yet.

```bash
mkdir agent-learning-companion
cd agent-learning-companion
git init

# Skill files (the agent's instruction sets)
mkdir -p skills

# Memory files (the agent's persistent state)
mkdir -p memory/plan-tasks
mkdir -p memory/win-log
mkdir -p memory/weekly-digests

# Resources (ported from ProngGSD)
mkdir -p resources

# Config
mkdir -p config
```

Create every file from the file tree in Section 3.2 of the product report. Start with empty templates that show the expected format (see Step 0.2).

### Step 0.2: Write the memory templates (Day 1-2 — you, alone)

These are the empty-but-structured files the agent will read and write. They need to exist with the correct format so the agent knows what to produce.

**`memory/user-profile.md`** — template:

```markdown
# User Profile

## Identity

- **Name:**
- **Current role:**
- **Experience level:** (beginner / intermediate / advanced)
- **Location/timezone:**

## Dream Career

- **Target role:**
- **Why:**
- **Timeline:**
- **Known gaps:**

## Learning Preferences

- **Preferred format:** (video / article / interactive / mixed)
- **Daily time commitment:** (15min / 30min / 1hr / 2hr+)
- **Pacing:** (relaxed / moderate / intensive)
- **Days off:** (e.g., weekends)
- **Quiet hours:** (e.g., before 10am)

## Context

- **Resume summary:**
- **LinkedIn summary:**
- **Current skills:**
- **Current job situation:** (employed-happy / employed-looking / unemployed / student)
```

**`memory/current-plan.md`** — template:

```markdown
# Current Learning Plan

## Plan Info

- **Created:** YYYY-MM-DD
- **Current week:** 1
- **Total weeks:** 8
- **Plan type:** learning (or interview_prep)

## Pillars

| Pillar | Level | Blocks at level | Weight |
| ------ | ----- | --------------- | ------ |
|        |       |                 |        |

## Portfolio Projects

(none yet)
```

**`memory/progress.md`** — template:

```markdown
# Progress

## Streak

- **Current:** 0 days
- **Longest:** 0 days
- **Last active:** never

## Completion

- **This week:** 0/0 tasks
- **All time:** 0 tasks completed

## Pillar Levels

(populated after plan generation)

## Teach-Back Log

(populated after first teach-back)
```

**`memory/plan-tasks/week-01.md`** — template:

```markdown
# Week 1 Tasks

## Monday

| #   | Action | Resource | Platform | URL | Est. time | Status  |
| --- | ------ | -------- | -------- | --- | --------- | ------- |
| 1   |        |          |          |     |           | pending |

## Tuesday

(same format)
```

Do the same for: `history.md`, `adaptation-log.md`, `resource-feedback.md`, `spaced-repetition.md`, `mistake-journal.md`, `interview-context.md`, `resume-context.md`, `win-log/wins.md`, `win-log/candidates.md`, `win-log/interview-mapping.md`. Look at Section 3.5-3.10 in the product report for the exact formats.

**`config/settings.md`**:

```markdown
# Settings

## Message Schedule

- **Daily plan time:** 08:00
- **Check-in time:** 20:00
- **Weekly digest day:** Sunday

## Frequencies

- **Teach-back:** 1 in 3 conceptual tasks
- **Resource feedback:** 1 in 3 completed tasks
- **Spaced repetition:** 1 review per day max

## Preferences

- **Quiet hours:** none
- **Days off:** none
- **Verbosity:** normal (concise / normal / detailed)
```

### Step 0.3: Write the first two skill files (Day 2-4 — you, alone)

Skill files are the core product. Each one is a detailed instruction set that tells the agent exactly what to do. Write them as if you're writing a CLAUDE.md for a very specific task.

**`skills/onboarding.md`** — the first skill to build:

```markdown
# Onboarding Skill

## When to trigger

- User profile (`memory/user-profile.md`) has empty fields
- First interaction with a new user
- User explicitly asks to redo onboarding

## Goal

Have a 4-6 turn conversation that extracts everything needed to populate
`memory/user-profile.md` and generate a learning plan. The conversation
should feel natural, not like a form.

## Conversation flow

### Turn 1: Introduction + current situation

"Hey! I'm your learning companion. I'll help you build skills toward
your career goals — I'll send you daily tasks, track your progress,
and adapt as you go. Let's start with the basics.

What do you do right now? (student, working, job hunting, career switching...)"

Based on response, extract: current role, job situation.

### Turn 2: Dream career

"Got it. Now the big question — if you could have any career in [their field
or adjacent], what would it be? Don't filter yourself — I want the real
target, not the safe answer."

Extract: target role, motivation (why they want it).

Follow up if vague: "What specifically about [role] appeals to you?"

### Turn 3: Experience + skills

"Nice target. Let me understand where you're starting from.
What skills do you already have that are relevant to [dream role]?
And what do you think are your biggest gaps?"

Extract: current skills, known gaps, experience level.

### Turn 4: Learning preferences

"Last thing — how do you like to learn?

- Do you prefer videos, articles, or hands-on practice?
- How much time can you realistically commit per day? (be honest, I'll
  adjust if life gets in the way)
- Any days you want completely off?"

Extract: preferred format, time commitment, pacing, days off.

### Turn 5 (optional): Resume/LinkedIn

"If you have a resume or LinkedIn profile, you can share key details
and I'll use them to personalize your plan even more. Or we can skip
this and I'll work with what you've told me."

Extract: resume summary, LinkedIn summary (if provided).

### Turn 6: Confirm + generate

"Here's what I've got:

- Dream career: [target role]
- Current level: [experience level]
- Key gaps: [gaps]
- Daily commitment: [time]
- Preferred learning: [format]

Sound right? If so, I'll generate your first week's plan."

## After onboarding

1. Write all extracted data to `memory/user-profile.md`
2. Trigger plan generation (call daily-plan skill with mode: full_plan)
3. Send first day's tasks via Discord
```

**`skills/daily-plan.md`**:

```markdown
# Daily Plan Skill

## When to trigger

- Every morning at the configured time (from `config/settings.md`)
- After onboarding completes (first plan generation)
- When current week's tasks are all completed (generate next week)

## Inputs to read

- `memory/user-profile.md` — dream career, skills, preferences, time commitment
- `memory/current-plan.md` — current pillars, levels, week number
- `memory/progress.md` — streak, recent completion rates, teach-back results
- `memory/spaced-repetition.md` — check if any concepts are due for review
- `memory/resource-feedback.md` — learning style profile (preferred formats)
- `resources/curated-resources.md` — available resources by pillar and level
- `config/settings.md` — message timing, verbosity

## Modes

### Mode: full_plan

Generate a multi-week plan outline (8-12 weeks default).

1. Select 2-4 pillars based on dream career + known gaps
2. Set initial pillar levels based on experience
3. Outline weekly focus areas (which pillars, what progression)
4. Write plan to `memory/current-plan.md`
5. Generate Week 1 tasks (see mode: weekly)

### Mode: weekly

Generate tasks for one week.

1. Read current pillar levels and focus areas from plan
2. For each day, assign 2-4 tasks (match time commitment):
   - Mix of formats (shift toward user's preferred format per resource-feedback)
   - Mix of pillars (weighted by plan weights)
   - Each task: action verb + specific resource + platform + URL + estimated time
   - Difficulty matches current pillar level
3. Write to `memory/plan-tasks/week-{N}.md`

### Mode: daily_message

Compose and send the daily Discord message.

1. Read today's tasks from current week file
2. Check spaced repetition queue — if a concept is due, include one review question
3. Reference yesterday's progress if relevant ("nice streak" / "let's pick up where you left off")
4. Connect at least one task to dream career ("this matters because...")
5. Keep it concise — 5-8 lines max unless user prefers detailed

## Task format

Each task must include:
| Field | Example |
|-------|---------|
| Action | "Read", "Practice", "Watch", "Build", "Complete" |
| Resource name | "Python decorators deep dive" |
| Platform | "Real Python", "LeetCode", "YouTube", etc. |
| URL | Direct link to the resource |
| Estimated time | "20 min", "45 min", etc. |
| Pillar | Which skill pillar this serves |
| Type | "conceptual" or "practice" (affects teach-back eligibility) |

## Example daily message

"Morning! Here's your plan for today:

1. 📖 Read: Python decorators deep dive (Real Python) [link] ~20min
2. 💻 Practice: 2 medium LeetCode problems on trees [link] ~40min
3. 🎥 Watch: System design — load balancers (YouTube) [link] ~15min

🔄 Quick review: What's the difference between a stack and a queue?

Yesterday you finished the SQL section — that's 8 days in a row now.
The tree problems build directly on the recursion you practiced last
week. This is core for [dream role] interviews."
```

### Step 0.4: Port curated resources from ProngGSD (Day 3-4 — you, alone)

Go to ProngGSD's Supabase dashboard or edge function code. Export the curated resources into `resources/curated-resources.md`:

```markdown
# Curated Resources

## Python — Level 1 (Beginner)

| Resource                         | Platform     | Type        | URL   | Est. time |
| -------------------------------- | ------------ | ----------- | ----- | --------- |
| Python for Beginners             | freeCodeCamp | Interactive | [url] | 4 hours   |
| Automate the Boring Stuff Ch 1-6 | Book (free)  | Reading     | [url] | 6 hours   |

## Python — Level 2 (Intermediate)

...

## Data Structures & Algorithms — Level 1

...

## System Design — Level 1

...
```

Organize by pillar and level. This is a direct port — the data already exists in ProngGSD.

### Step 0.5: Test with Claude Code (Day 4-5 — you, alone)

Before touching OpenClaw, validate the brain works:

1. Put the skill files and memory templates in a test directory
2. Tell Claude Code: "Read `skills/onboarding.md`. Now act as this agent and onboard me. Write the results to `memory/user-profile.md`."
3. Check: did it follow the conversation flow? Did it write a good profile?
4. Then: "Read `skills/daily-plan.md` and `memory/user-profile.md`. Generate my first week's plan."
5. Check: are the tasks relevant to the dream career? Do they use curated resources? Is the format correct?

This tests 80% of the product without needing OpenClaw.

### Step 0.6: Session with your friend (Day 6-7 — you + friend)

Now bring in OpenClaw. Schedule 2-3 hours:

1. **Understand the format** — How does OpenClaw/NanoClaw structure skill files? What frontmatter? How are tools declared? How does memory work? Take notes.
2. **Port your skill files** — Adapt `onboarding.md` and `daily-plan.md` to OpenClaw's exact format. This might be trivial (just add frontmatter) or might need restructuring.
3. **Set up Discord** — Does OpenClaw have a built-in Discord tool? If yes, configure it. If no, you need a Discord bot (see below).
4. **Run the onboarding** — Full test: OpenClaw reads the onboarding skill, has a conversation with you via Discord, writes the profile.
5. **Run plan generation** — OpenClaw reads the daily-plan skill, generates Week 1, sends you Day 1 via Discord.

**If Discord isn't built into OpenClaw**, set up a simple Discord bot:

- Create a Discord bot on the Discord Developer Portal
- Use discord.js (Node) or discord.py
- Bot receives messages in a channel → passes to OpenClaw agent
- Agent response → bot sends to channel
- This is a standard pattern with tons of tutorials

### Phase 0 exit gate

You receive a personalized daily task list via Discord based on your onboarding conversation. If this doesn't work, fix before proceeding.

---

## Phase 1: The Daily Loop + Learning Feedback (Week 3-5)

### Step 1.1: Write remaining core skill files (Day 1-3)

Write these skill files in the same detailed format as onboarding and daily-plan:

- **`skills/check-in.md`** — Evening check-in. Ask what user completed. Handle: all done, partial, nothing, user volunteers extra info. Write to `progress.md` and `history.md`. Port the non-blocking check-in pattern from ProngGSD's `gsd-process-checkin`.

- **`skills/adaptation.md`** — Reads progress data + check-in history. Rules for when to adapt (see adaptation triggers in product report Section 4). Always writes reasoning to `adaptation-log.md`.

### Step 1.2: Write learning feedback skill files (Day 3-5)

- **`skills/teach-back.md`** — Full spec in product report Section 3.6. Key: response evaluation table (strong/partial/can't explain/skipped), each with specific agent action. Include the level-up gate logic.

- **`skills/resource-feedback.md`** — Full spec in product report Section 3.8. Key: three-option rating only (great/okay/didn't click). Auto-derive learning style profile after 10+ ratings.

### Step 1.3: Port curated resources fully (Day 4-5)

Expand `resources/curated-resources.md` with all 55+ resources from ProngGSD. Ensure every entry has: resource name, platform, type (video/article/interactive/book), URL, estimated time, pillar, level.

### Step 1.4: Test the full daily loop (Day 6-14)

Use it yourself for a full week. Daily:

- Morning: receive task list via Discord
- During day: do tasks (or don't)
- Evening: agent checks in, you respond
- Agent adapts tomorrow based on your response
- ~1 in 3 tasks: teach-back prompt
- ~1 in 3 tasks: resource feedback question

Track what works and what's annoying. Adjust skill file instructions based on real experience.

### Phase 1 exit gate

7 consecutive days used. Agent adapted at least once. At least one teach-back happened correctly. Resource feedback influenced a recommendation.

---

## Phase 2: Context + Spaced Repetition + Weekly Digest (Week 6-8)

### Step 2.1: Write spaced repetition skill (Day 1-3)

**`skills/spaced-repetition.md`** — Full spec in product report Section 3.10. Key: the simplified spacing algorithm table. Integration with teach-back (weak responses enter SRS at shortest interval). One review per day max, mixed into daily message.

### Step 2.2: Write weekly review skill (Day 2-4)

**`skills/weekly-review.md`** — Full spec in product report Section 3.9. Key: narrative format (not stats dump). Must include: focus areas, teach-back performance, streak, pillar progress, observations, dream career connection, look-ahead. Write to `memory/weekly-digests/week-{N}.md`.

### Step 2.3: Context awareness (Day 4-7)

This depends heavily on what OpenClaw exposes:

- **Calendar access?** → Read tomorrow's calendar, adjust task count
- **Activity tracking?** → Detect relevant activity (opened LeetCode = probably doing coding task)
- **Existing user memory?** → Pre-populate profile from OpenClaw's identity system

Work with your friend to understand what's available. Implement what's possible, skip what isn't. The daily loop works without context awareness — it's an enhancement, not a requirement.

### Step 2.4: Settings (Day 5-7)

Make `config/settings.md` actually work — agent reads it before every message and respects quiet hours, days off, verbosity preference, teach-back frequency, etc.

### Phase 2 exit gate

2+ weeks used. Spaced repetition tracking 5+ concepts. Two weekly digests generated. At least one context-aware adaptation (or documented reason why it's not possible yet).

---

## Phase 3: Interview Prep + Win Log + Portfolio (Week 9-12)

### Step 3.1: Interview prep skills (Day 1-5)

Port from ProngGSD — you've already built this logic:

- **`skills/interview-prep.md`** — Detection triggers + crash course generation. Port prompts from `gsd-interview-onboarding` and `gsd-generate-plan` (interview_plan mode). Adapt output to .md memory files instead of Supabase tables.

- **`skills/mock-interview.md`** — Port from `gsd-mock-interview`. Three modes: behavioral, technical, system design. Add win log integration (see Step 3.2). Completion detection + feedback generation. Mistake journal writes to `memory/mistake-journal.md`.

### Step 3.2: Win log skill (Day 5-8)

**`skills/win-log.md`** — Full spec in product report Section 3.5. Three sources:

1. **Passive** (already running since Phase 1) — review `candidates.md`, surface to user
2. **Extraction** — read `resume-context.md`, ask about listed roles/projects, STAR-format the responses
3. **Mock capture** — during/after mocks, note achievements, offer to polish

Build the interview mapping logic: categorize wins by question type, detect gaps ("you don't have a failure story").

### Step 3.3: Portfolio projects skill (Day 8-10)

**`skills/portfolio-projects.md`** — Full spec in product report Section 3.7. Trigger conditions: after skill block completion, after 3+ weeks without building, when interview prep activates. Project suggestion format includes: description, skills used, scope, dream career alignment, stretch goals.

### Step 3.4: End-to-end interview scenario test (Day 10-14)

Simulate the full flow:

1. Tell the agent "I have an interview at [company] in 2 weeks"
2. Agent runs interview onboarding
3. Agent generates crash course plan
4. Agent starts win extraction from resume
5. Do a mock interview — agent coaches using win log
6. Agent generates mistake journal entries
7. Agent suggests portfolio project
8. Win log has 3+ entries with interview mapping

### Phase 3 exit gate

Complete interview prep flow works end-to-end. Mock interview conducted with win log coaching. Win log has entries mapped to question types.

---

## Phase 4: Web Dashboard (Week 13-16)

### Step 4.1: Decide if you need it (Day 1)

After 12 weeks of Discord-only usage, honestly assess:

- Do mock interviews work in Discord? Or do they need a dedicated UI?
- Do you ever want to browse your progress visually?
- Is the win log useful to read/edit in a richer interface?

If Discord covers 90% of needs, skip this phase or build only the mock interview UI.

### Step 4.2: Minimal Vite app (Day 2-5)

```bash
npm create vite@latest dashboard -- --template react-ts
cd dashboard
npm install tailwindcss @tailwindcss/vite
```

Single-user, no auth. Reads from agent memory files. Two approaches:

- **File watcher**: dashboard watches the memory directory and re-renders on change
- **Simple API**: tiny Express server that reads memory files and serves JSON

### Step 4.3: Build pages in priority order (Day 5-14)

Build only what Discord can't do well:

1. **Mock interview UI** — Full chat interface. More space than Discord. Shows conversation history, feedback panel, mistake journal sidebar.
2. **Win log editor** — View/edit STAR entries, see interview mapping, review candidates.
3. **Progress dashboard** — Streak heatmap, pillar level cards, completion charts, spaced repetition stats.
4. **Plan overview** — Multi-week timeline, task status by day.
5. **Weekly digest archive** — Browse past digests as a learning journal.

### Phase 4 exit gate

Dashboard deployed locally. At least one feature (probably mock interviews) is genuinely better than Discord. If nothing is better, cut the dashboard.

---

## Phase 5: Polish & Open Source (Week 17-19)

### Step 5.1: First-run experience (Day 1-3)

Agent detects empty `memory/user-profile.md` → triggers onboarding automatically. No manual setup needed beyond cloning the repo and configuring Discord.

### Step 5.2: README (Day 3-5)

Step-by-step install guide:

1. Prerequisites (OpenClaw/NanoClaw, Discord account)
2. Clone repo
3. Configure Discord bot token in `config/discord-config.md`
4. Configure OpenClaw to use the skill files
5. Start the agent — onboarding begins automatically
6. (Optional) Run the dashboard

### Step 5.3: Test with friend (Day 5-10)

Your friend installs from the README alone. You don't help. Take notes on everything that breaks or confuses. Fix it all.

### Step 5.4: Ship (Day 10-14)

GitHub repo. MIT license. Tag v0.1.0. Post it somewhere relevant (OpenClaw community, relevant Discord servers, etc.)

### Phase 5 exit gate

Someone who isn't you installs and uses it for 3+ days from the README alone.

---

## What to do literally today

1. **Create the repo** with the directory structure
2. **Write the memory templates** (user-profile, current-plan, progress, plan-tasks/week-01)
3. **Write `skills/onboarding.md`** in full detail (copy the template from Step 0.3 above and expand it)
4. **Test it with Claude Code** — tell Claude to act as the agent and onboard you
5. **Message your friend** — schedule the OpenClaw pairing session

You don't need OpenClaw access to do steps 1-4. That's a full day of productive work that moves the project forward.
