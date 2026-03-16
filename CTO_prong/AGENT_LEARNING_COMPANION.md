# Agent Learning Companion — Product Report & Implementation Plan

**Date:** 2026-03-16
**Author:** CTO (for Ralph, Head of Product)
**Status:** Idea stage — pre-development

---

## 1. What This Is

An **open-source, agent-native learning companion** that lives inside OpenClaw (NanoClaw). Instead of a traditional web app the user has to open, the agent _is_ the product. It knows who you are, what you're learning, where you're stuck, and what's next. It reaches you via Discord, adapts autonomously, and tracks your progress through conversation and context — not checkboxes.

A lightweight **web dashboard** exists alongside it for things that need more space: mock interviews, progress visualization, and detailed plan views. The agent keeps the dashboard in sync. They share the same memory and context.

**One sentence:** Your AI learning coach that lives where you already are, sees what you're actually doing, and adapts your plan without you having to ask.

---

## 2. How It Differs from ProngGSD

|                     | ProngGSD                                          | Agent Learning Companion                              |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| **Primary surface** | Web app (React SPA)                               | OpenClaw agent + Discord                              |
| **User initiates**  | Opens app, checks tasks                           | Agent reaches out with daily plan                     |
| **Tracking**        | Manual task completion                            | Conversational check-ins + OpenClaw context awareness |
| **Adaptation**      | Explicit (mentor chat, block completion triggers) | Autonomous (agent adapts silently based on behavior)  |
| **Onboarding**      | Structured multi-turn chat in web UI              | Conversational onboarding via Discord/agent           |
| **Data layer**      | Supabase (Postgres + Edge Functions)              | Agent memory files + lightweight local store          |
| **Deployment**      | Vercel + Supabase cloud                           | Local OpenClaw install + optional dashboard           |
| **Mock interviews** | In-app chat UI                                    | Dashboard (needs space + focus)                       |

Key insight: ProngGSD is a **destination** (you go to it). This is a **companion** (it comes to you). Different products, complementary visions. Some logic ports over (plan generation prompts, interview onboarding, mock interview structure), but the interaction model is fundamentally different.

---

## 3. Core Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          OpenClaw Agent                               │
│                                                                       │
│  ┌────────────────┐  ┌─────────────────┐  ┌───────────────────────┐ │
│  │ Skill Files     │  │ Memory Files    │  │ Tool/Action           │ │
│  │ (.md)           │  │ (.md/.json)     │  │ Definitions           │ │
│  │                 │  │                 │  │                       │ │
│  │ - Onboarding    │  │ - User profile  │  │ - Discord messaging   │ │
│  │ - Daily Plan    │  │ - Dream career  │  │ - Dashboard sync      │ │
│  │ - Check-in      │  │ - Plan state    │  │ - Calendar read       │ │
│  │ - Adaptation    │  │ - Progress      │  │ - File read/write     │ │
│  │ - Weekly Review │  │ - Win log/      │  │                       │ │
│  │ - Win Log       │  │ - History       │  │                       │ │
│  │ - Teach-back    │  │ - Mistakes      │  │                       │ │
│  │ - Interview     │  │ - Resume/       │  │                       │ │
│  │   Prep          │  │   LinkedIn      │  │                       │ │
│  │ - Mock          │  │ - Resource      │  │                       │ │
│  │   Interview     │  │   feedback      │  │                       │ │
│  │ - Portfolio     │  │ - Spaced rep    │  │                       │ │
│  │   Projects      │  │   schedule      │  │                       │ │
│  │                 │  │ - Weekly        │  │                       │ │
│  │                 │  │   digests/      │  │                       │ │
│  └────────────────┘  └─────────────────┘  └───────────────────────┘ │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                 ▼            ▼            ▼
        ┌─────────────┐ ┌──────────┐ ┌──────────────┐
        │ Discord     │ │ Dashboard│ │ OpenClaw     │
        │ Bot         │ │ (Web)    │ │ Context      │
        │             │ │          │ │ (other apps, │
        │ Daily tasks │ │ Mock     │ │  calendar,   │
        │ Check-ins   │ │ interviews│ │  identity)  │
        │ Teach-backs │ │ Progress │ │              │
        │ Spaced rep  │ │ Win log  │ │              │
        │ Weekly      │ │ Portfolio│ │              │
        │  digests    │ │ History  │ │              │
        │ Q&A         │ │          │ │              │
        └─────────────┘ └──────────┘ └──────────────┘
```

### 3.1 The Three Layers

**Layer 1: OpenClaw Agent (the brain)**

- Skill files define _what_ the agent can do (onboarding, daily planning, adaptation, interview prep)
- Memory files store _everything_ about the user (profile, plan, progress, history)
- The agent reads OpenClaw's broader context (user identity, work patterns, calendar) to inform decisions
- This is the core product — everything else is a surface

**Layer 2: Discord (the daily interface)**

- Agent sends daily messages: "Here's your plan for today" with links, resources, explanations
- User can reply conversationally: "I did the first two but got stuck on SQL joins"
- Agent adapts based on responses (or lack thereof)
- Lightweight, zero-friction, meets the user where they are
- Also handles quick Q&A, encouragement, streak tracking

**Layer 3: Web Dashboard (the deep interface)**

- Mock interviews (needs full chat UI, can't do this well in Discord)
- Progress visualization (charts, heatmaps, pillar levels)
- Full plan overview (all weeks, all tasks, all history)
- Interview prep workspace (job description analysis, company research, resume context)
- The agent keeps this in sync — user never has to manually update it
- Optional: user can also interact with the plan here if they want

### 3.2 Data & Memory Architecture

**No cloud database for v1.** The agent's memory files ARE the database.

```
agent-learning-companion/
├── skills/                         # What the agent can do (one skill per file)
│   ├── onboarding.md               # First-time user setup: extract dream career, goals, experience
│   ├── daily-plan.md               # Generate + deliver daily tasks via Discord
│   ├── check-in.md                 # Evening/morning progress check-in conversation
│   ├── adaptation.md               # Autonomous plan adjustment based on behavior + context
│   ├── weekly-review.md            # Weekly narrative digest generation + plan adjustment
│   ├── teach-back.md               # Active recall prompts + response evaluation
│   ├── win-log.md                  # Win extraction, passive capture, interview mapping
│   ├── portfolio-projects.md       # Context-aware project suggestions for portfolio building
│   ├── resource-feedback.md        # Post-task resource quality collection + learning style profiling
│   ├── spaced-repetition.md        # Review scheduling + concept retention pings
│   ├── interview-prep.md           # Job search detection + interview crash course generation
│   └── mock-interview.md           # Mock interview conductor + win log integration + coaching
├── memory/
│   ├── user-profile.md             # Who the user is (role, goals, experience, preferences, dream career)
│   ├── current-plan.md             # Active learning plan (pillars, phases, current week, portfolio projects)
│   ├── plan-tasks/                 # Individual task files by week
│   │   ├── week-01.md
│   │   ├── week-02.md
│   │   └── ...
│   ├── progress.md                 # Streak, completion rates, pillar levels, teach-back log
│   ├── history.md                  # Completed tasks log (append-only)
│   ├── resource-feedback.md        # Resource ratings + auto-derived learning style profile
│   ├── spaced-repetition.md        # SRS schedule: active items, retired items, tomorrow's queue
│   ├── mistake-journal.md          # Interview prep mistakes + patterns
│   ├── resume-context.md           # Resume/LinkedIn parsed context
│   ├── interview-context.md        # Target company, role, date, prep status
│   ├── adaptation-log.md           # Log of all autonomous adaptations (transparency)
│   ├── win-log/                    # Achievement tracking system
│   │   ├── wins.md                 # Polished, user-confirmed wins (STAR format)
│   │   ├── candidates.md           # Agent-observed potential wins (unconfirmed)
│   │   └── interview-mapping.md    # Which wins fit which interview question types
│   └── weekly-digests/             # Weekly narrative summaries (one per week)
│       ├── week-01.md
│       ├── week-02.md
│       └── ...
├── resources/                      # Curated learning resources (portable from ProngGSD)
│   └── curated-resources.md        # The 55+ resources, categorized by pillar + level
├── config/
│   ├── discord-config.md           # Discord bot token, channel preferences
│   └── settings.md                 # User preferences (message frequency, teach-back frequency,
│                                   #   resource format preferences, quiet hours, days off, etc.)
└── README.md                       # Setup instructions + architecture overview
```

**Why files, not a database?**

- Zero infrastructure. `git clone` and you're running.
- OpenClaw can natively read/write .md files — no integration needed.
- Git-trackable: every adaptation, every plan change, every progress update is version-controlled.
- Portable: switch agents, fork for a friend, back up to GitHub.

**When do we add a database?**

- When multi-user matters (v2+)
- When the dashboard needs queryable data (mock interview history, progress charts)
- At that point: SQLite (local-first) or Supabase (if going cloud). Not for v1.

### 3.3 Dashboard Architecture (Lightweight)

For v1, the dashboard can be extremely simple:

- **Static site or simple Vite app** that reads from the agent's memory files
- OR: a local dev server the agent can spin up
- Primary purpose: mock interviews and progress visualization
- The agent writes to memory files → dashboard reads them
- No auth needed for v1 (single user, local)

For mock interviews specifically: the dashboard provides the focused chat UI. The agent handles the AI logic and writes results back to memory files.

### 3.4 Dream Career as the North Star

The onboarding extracts the user's **dream career** — not just "what do you want to learn" but "where do you ultimately want to end up." This is the single most important memory the agent holds, because it informs everything downstream:

| Decision                     | How dream career influences it                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Pillar selection**         | Skills are chosen based on what the dream role requires, not what's trendy                                                      |
| **Resource recommendations** | Prioritize resources used by people in that field (e.g., a future ML engineer gets fast.ai, not generic Python tutorials)       |
| **Task framing**             | "This SQL exercise matters because data engineers at Spotify query petabyte-scale tables" — connects daily work to the end goal |
| **Adaptation direction**     | When the user levels up, the agent picks the next skill that closes the biggest gap toward the dream role                       |
| **Interview prep**           | When interview mode activates, the agent already knows the target role and can tailor the crash course                          |
| **Motivation**               | On tough days: "You're 3 months into a path toward [dream career]. Here's how far you've come."                                 |

**Stored in:** `memory/user-profile.md` under a `## Dream Career` section with:

- The role/title they're aiming for
- Why (their motivation — this matters for framing)
- Timeline (aspirational, not binding — "within 2 years", "after I graduate", etc.)
- Known gaps (what they think they're missing — agent validates and refines over time)

The agent revisits this periodically (weekly review) — dream careers evolve. If the user's conversations suggest a shift ("actually I've been really into product management lately"), the agent surfaces it: "I noticed you've been asking a lot about PM skills. Has your target shifted? Want to adjust the plan?"

### 3.5 Win Log — The Achievement System

Most people can't articulate their achievements in interviews. Not because they haven't done impressive things — because they never wrote them down, or they undersell them. The agent fixes this because **it's been there the whole time**, watching the user struggle, improve, and build.

#### Three sources of wins

**Source 1: Observed wins (agent captures passively)**

The agent is already tracking progress. When it detects something notable, it silently drafts a win entry in `memory/win-log/candidates.md`:

- User leveled up a pillar faster than the plan expected
- User completed a stretch task they initially said felt too hard
- User built something during practice that actually works
- User's mock interview scores improved significantly
- User stuck with a difficult topic for multiple days and broke through

These are low-confidence drafts. The agent stores them as candidates and periodically surfaces them: "I've noticed a few things over the past month that might be worth adding to your win log. Want to go through them?"

**Source 2: Extracted wins (agent digs through conversation)**

The more valuable source. Periodically — or when interview prep activates — the agent has a targeted conversation:

> "You mentioned you worked on a data pipeline at your internship. Tell me more — what was broken when you started? What did you specifically do? What happened after?"

The agent knows STAR format. It asks follow-up questions to pull out the situation, the constraint, the decision, and the result. Most people say "I fixed a bug" when the real story is "I traced a production outage across three microservices and found that the root cause was a race condition in a service nobody suspected."

The agent can also mine the user's resume/LinkedIn context (already in memory) and ask about specific roles or projects listed there.

**Source 3: Mock interview captures (real-time)**

During a mock interview, the user naturally tells stories about their experience. The agent is already listening. When the user describes an achievement:

- Agent notes it as a potential win log entry
- After the interview: "You told a good story about the database migration, but you buried the lead. The impressive part was that you did it with zero downtime — lead with that. Want me to save a polished version?"
- Or: "For that question about teamwork, you used the pipeline story — but your API redesign story would've been stronger here because it shows cross-team collaboration. Want to practice that version?"

#### The win log as interview cheat sheet

`memory/win-log/interview-mapping.md` categorizes wins by interview question type:

```markdown
## Leadership / Influence

- API redesign win (strongest — shows cross-team influence)
- Onboarding doc initiative (backup — shows self-direction)

## Technical Problem Solving

- Production race condition fix (strongest — shows depth)
- Database migration (backup — shows planning)

## Failure / Learning

- First sprint overcommitment (good framing — shows growth)

## Collaboration

- Cross-team API project (strongest — 3 teams involved)
- Mentoring junior dev (backup — shows patience + teaching)
```

When interview prep activates, the agent uses this: "Based on the job description for [company], they'll probably ask about [X]. Your strongest story for that is [win]. Want to practice telling it?"

#### How it integrates with mock interviews

The mock interview skill has full access to the win log and can:

1. **Coach in real-time**: "That was good, but you spent 90 seconds on the situation and 10 seconds on the result. Flip it."
2. **Suggest better stories**: "You used the pipeline fix for that question, but your API redesign is a better fit — it shows the collaboration they're looking for."
3. **Identify gaps**: "You don't have a strong 'failure' story yet. Most interviews ask this. Want to think of one?"
4. **Track improvement**: Compare how the user tells the same story across multiple mock interviews — "Your delivery of the migration story is way tighter than last week."

#### Why this matters

Nobody maintains a win log manually. An agent that builds one in the background, refines it through conversation, and then deploys it as your interview prep cheat sheet — that's the kind of thing that makes someone say "I could never go back to not having this." It's genuinely differentiated and directly tied to the dream career goal.

### 3.6 Teach-Back Mode — Active Recall Engine

Passive consumption (watching videos, reading articles) creates an illusion of learning. Real retention comes from retrieval practice — forcing the brain to recall and articulate what it learned. The agent uses this by periodically asking the user to **teach back** what they've learned.

#### How it works

After the user completes a learning task, the agent sometimes (not every time — that would be annoying) asks them to explain the concept back:

```
Agent: "You finished that system design video on load balancing yesterday.
        Quick challenge: explain to me how you'd distribute traffic across
        3 servers if one of them is twice as powerful as the others.
        Keep it to 2-3 sentences."

User:  "You'd use weighted round-robin — assign the powerful server a weight
        of 2 and the others a weight of 1, so it gets twice the requests."

Agent: "Solid. You nailed the core concept. One thing to add: what happens
        when that powerful server goes down? That's where health checks come in.
        I'll add a quick task on failover patterns to this week's plan."
```

#### When the agent triggers teach-back

- **After completing a conceptual task** (not after pure practice like LeetCode — those are already active recall)
- **Before leveling up a pillar** — "Before I move you to the next level, let me check: can you explain [core concept from current level]?"
- **Spaced intervals** — revisit older topics (see Section 3.10 Spaced Repetition)
- **When the user says they're confused** — instead of just giving the answer, the agent asks what they _do_ understand, then fills in the gap

#### What the agent does with the response

| Response quality          | Agent action                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Strong explanation**    | Confirm, move on. Log as evidence of mastery in `progress.md`. Potentially a win log candidate.                                                                                                                                                        |
| **Partial / vague**       | Ask a targeted follow-up to find the gap. Add a reinforcement task (not a full repeat — a focused exercise on the missing piece).                                                                                                                      |
| **Can't explain at all**  | No judgment. "No worries, that one's tricky. I'll add a different resource on this topic — sometimes a second explanation clicks." Reschedule the concept with a different resource type (e.g., if they watched a video, try an interactive tutorial). |
| **User declines / skips** | That's fine — never force it. Note it and try less frequently for this user. Track preference in `config/settings.md`.                                                                                                                                 |

#### Stored in

`memory/progress.md` under a `## Teach-Back Log` section:

```markdown
## Teach-Back Log

### 2026-03-15 — Load balancing (System Design pillar, Level 2)

- **Prompt:** Explain weighted traffic distribution
- **Response quality:** Strong
- **Gap identified:** None — also mentioned round-robin unprompted
- **Action:** None, moved to next topic

### 2026-03-12 — SQL JOINs (Data Skills pillar, Level 1)

- **Prompt:** Explain the difference between LEFT JOIN and INNER JOIN
- **Response quality:** Partial — described INNER correctly, confused LEFT with FULL OUTER
- **Gap identified:** LEFT JOIN misunderstanding
- **Action:** Added visual JOIN diagram resource to tomorrow's plan
```

This log serves double duty: it's a learning record AND it feeds the adaptation engine — the agent knows exactly which concepts are solid and which need reinforcement.

### 3.7 Portfolio Project Suggestions

Learning theory without building is like studying recipes without cooking. At strategic moments, the agent suggests **portfolio projects** tailored to the user's dream career, current skill level, and what they've been learning.

#### When the agent suggests a project

- **After completing a skill block** — "You've been doing React + API work for 3 weeks. Want to build something with it?"
- **When the user has been doing only consumption tasks** — "You've been reading and watching for a while. Building something would cement these skills. Interested?"
- **When interview prep activates** — "For [dream role] at [target company], a [specific project type] in your portfolio would stand out. Want me to scope one?"
- **Never forced** — always a suggestion. Some users are builders, some aren't. The agent learns this preference.

#### What a project suggestion looks like

```
Agent: "You've leveled up in both Python and data analysis over the past month.
        For a data science role at a company like your target, here's a project
        that would be strong for your portfolio:

        📊 Project: Real-time Dashboard for Public Transit Data
        - Uses: Python, pandas, API integration, data viz (all skills you've practiced)
        - Scope: ~2 weekends (8-12 hours total)
        - Why it's good: Shows you can work with real APIs, messy data, and
          build something visual. Transit data is public and free.
        - Stretch: Add a simple prediction model for delays (ML bonus)

        Want me to break this into tasks and add it to your plan? Or would
        you prefer something different?"
```

#### How project suggestions are generated

The agent considers:

1. **Dream career** — what projects impress hiring managers in that field?
2. **Current skill level** — project should stretch but not overwhelm (one level above comfort zone)
3. **Skills recently practiced** — use what they've been learning so it reinforces, not distracts
4. **Time commitment** — match to user's pacing profile. A "relaxed" learner gets a weekend project, not a month-long build.
5. **Public data/APIs** — prefer projects using free, public resources so there are no setup barriers

#### Stored in

`memory/current-plan.md` under a `## Portfolio Projects` section:

```markdown
## Portfolio Projects

### Transit Dashboard (suggested 2026-03-15)

- **Status:** In progress (week 1 of 2)
- **Skills used:** Python, pandas, API integration, Plotly
- **Tasks added to plan:** weeks 5-6
- **Dream career alignment:** Data Scientist — shows real-world data pipeline skills
- **Completion → win log:** Yes, draft entry when finished
```

When a project is completed, the agent automatically drafts a win log entry from it — the user built something real, and that's an achievement worth articulating in interviews.

### 3.8 Resource Quality Feedback Loop

Not all resources are equal. A 45-minute video might be perfect for one user and useless for another. The agent learns what works for **this specific user** by collecting lightweight feedback after tasks.

#### How it works

After completing a task (not every time — roughly 1 in 3 tasks to avoid survey fatigue):

```
Agent: "You finished that Real Python article on decorators. Quick —
        was it helpful? (great / okay / didn't click)"

User:  "okay"

Agent: "Got it. I'll keep Real Python in the mix but look for more
        hands-on resources for the next Python topic."
```

Three options only. No 1-5 scale, no paragraphs. Minimal friction.

#### What the agent tracks

`memory/resource-feedback.md`:

```markdown
## Resource Quality Tracking

### User Learning Style Profile (auto-updated)

- **Preferred format:** Interactive tutorials > videos > articles (based on 23 ratings)
- **Preferred length:** Short (< 20 min) performs better than long-form
- **Platform preferences:** freeCodeCamp (avg: great), Real Python (avg: okay), YouTube tutorials (avg: mixed)

### Recent Feedback

| Date       | Resource                | Platform       | Type        | Rating       | Topic      |
| ---------- | ----------------------- | -------------- | ----------- | ------------ | ---------- |
| 2026-03-15 | Decorators deep dive    | Real Python    | Article     | okay         | Python     |
| 2026-03-14 | Tree traversal practice | LeetCode       | Interactive | great        | DSA        |
| 2026-03-13 | System design basics    | YouTube        | Video       | great        | Sys Design |
| 2026-03-12 | SQL window functions    | Mode Analytics | Tutorial    | didn't click | SQL        |
```

#### How the agent uses this data

| Pattern detected                             | Agent response                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| User consistently rates videos as "great"    | Shift resource mix toward more video content                                               |
| User rates long articles as "didn't click"   | Switch to shorter, more interactive alternatives                                           |
| Specific platform consistently underperforms | Deprioritize that platform in future recommendations                                       |
| User rates everything as "great"             | Probably not being honest — reduce feedback frequency, rely more on teach-back performance |
| User rates everything as "didn't click"      | Resources aren't the problem — difficulty level might be wrong. Trigger adaptation.        |

Over time, the agent builds a **learning style profile** unique to this user. This is more valuable than any generic "are you a visual learner?" quiz because it's based on actual performance data, not self-reported preferences.

#### Future (multi-user): Community resource quality

When the project goes multi-user, individual feedback aggregates into community resource quality scores. "87% of users at Level 2 Data Skills rated this resource 'great'" — this makes resource selection better for everyone. Not for v1, but the data structure supports it.

### 3.9 Weekly Narrative Digest

Numbers don't motivate. Stories do. Every week, the agent sends a narrative summary of the user's learning journey — not "you completed 12/15 tasks" but a story about what they learned, where they grew, and where they're headed.

#### What it looks like

Sent via Discord at the end of each week (Sunday evening or Monday morning, configurable):

```
Agent: "📊 Week 4 Recap

        This week you focused on SQL and system design. The SQL work is
        paying off — you nailed the teach-back on window functions, which
        tripped you up two weeks ago. Real progress there.

        System design is newer territory. You watched 3 videos and rated
        them all 'great', but when I asked you to explain load balancing,
        you were fuzzy on failover. That's normal for week 1 of a new topic.
        I've added a hands-on exercise for next week.

        🔥 Streak: 12 days (your longest yet)
        📈 SQL: Level 2 → almost Level 3 (2 more blocks)
        🆕 System Design: Level 1 (just started — give it time)

        One thing I noticed: you skipped the LeetCode tasks twice this week.
        No judgment — want me to reduce coding practice to 2x/week instead
        of daily? Or was this just a busy week?

        Looking ahead: next week I'm introducing API design, which bridges
        your Python skills and system design knowledge. It's directly relevant
        to [dream career] roles.

        Keep going. You're 4 weeks into a path most people never start. 💪"
```

#### What the digest includes

1. **Narrative summary** — what they focused on, what improved, what's still developing
2. **Teach-back performance** — which concepts are solid vs. need reinforcement (from 3.6)
3. **Stats** — streak, pillar levels, completion rate (but embedded in narrative, not a raw table)
4. **Pattern observation** — agent notices trends (skipping certain task types, speed of completion) and surfaces them non-judgmentally
5. **Dream career connection** — reminds them how this week's work connects to the bigger goal
6. **Look-ahead** — what's coming next week and why
7. **Adaptation question** — if the agent noticed something worth adjusting, it asks here

#### Stored in

`memory/weekly-digests/week-{N}.md` — one file per week. These accumulate into a long-term learning journal the user can look back on.

```markdown
## Week 4 Digest (2026-03-10 to 2026-03-16)

### Focus areas: SQL, System Design

### Tasks: 12/15 completed (80%)

### Streak: 12 days (personal best)

### Pillar progress:

- SQL: Level 2, 4/5 blocks completed at level
- System Design: Level 1, 1/5 blocks completed at level

### Teach-back results:

- SQL window functions: Strong (was weak 2 weeks ago — confirmed improvement)
- Load balancing: Partial (failover gap — remediation task added)

### Observations:

- Skipped LeetCode 2x this week — asked user about preference adjustment
- All video resources rated "great" — user may prefer video learning for new topics
- Completion speed increasing for SQL tasks (avg 25min → 18min this week)

### Adaptation made:

- Added hands-on load balancing exercise to Week 5
- Shifted next system design resource from article to video (user preference)
```

The digest is also shareable — a user could post their weekly learning recap to LinkedIn or share with an accountability partner. The narrative format makes it actually interesting to read, unlike a raw stats dump.

### 3.10 Spaced Repetition Pings

Knowledge decays. A concept learned 3 weeks ago fades unless it's reinforced. The agent prevents this by periodically sending **spaced repetition pings** — quick review questions on topics the user has already covered.

#### How it works

Mixed into the daily Discord messages (not a separate session — zero friction):

```
Agent: "Morning! Here's your plan for today:
        1. 📖 Read: API authentication patterns (Real Python)
        2. 💻 Practice: Build a simple REST endpoint
        3. 🎥 Watch: Database indexing (20 min)

        🔄 Quick review from 2 weeks ago: What's the difference between
        a stack and a queue? One sentence is fine."

User:  "Stack is LIFO, queue is FIFO"

Agent: "Perfect. That one's locked in. ✓"
```

#### The spacing algorithm

The agent uses a simplified spaced repetition schedule (not full Anki — too complex for conversational format):

| Last reviewed | If correct                          | If wrong/skipped  |
| ------------- | ----------------------------------- | ----------------- |
| 3 days ago    | Review in 1 week                    | Review in 3 days  |
| 1 week ago    | Review in 2 weeks                   | Review in 1 week  |
| 2 weeks ago   | Review in 1 month                   | Review in 1 week  |
| 1 month ago   | Review in 3 months                  | Review in 2 weeks |
| 3+ months ago | Retire (mastered) or yearly refresh | Review in 1 month |

This is intentionally simpler than SRS algorithms like SM-2. The agent is sending one review question per day mixed into the daily plan — it doesn't need sub-hour precision. The goal is preventing total knowledge decay, not optimizing for exam performance.

#### What gets reviewed

- **Concepts from completed skill blocks** — the agent picks a core concept from each completed block
- **Topics where teach-back was weak** — these get reviewed more aggressively
- **Foundational concepts** — things that build on each other (e.g., if the user is learning databases, basic SQL should stay fresh)
- **NOT practice problems** — review is conceptual ("explain X") not exercises ("solve this LeetCode problem")

#### Stored in

`memory/spaced-repetition.md`:

```markdown
## Spaced Repetition Schedule

### Active Review Items

| Concept         | Pillar     | Last reviewed | Next review | Consecutive correct | Status          |
| --------------- | ---------- | ------------- | ----------- | ------------------- | --------------- |
| Stack vs Queue  | DSA        | 2026-03-14    | 2026-03-28  | 3                   | Spacing out     |
| SQL JOINs       | Data       | 2026-03-12    | 2026-03-19  | 1                   | Reinforcing     |
| REST vs GraphQL | API Design | 2026-03-10    | 2026-03-17  | 2                   | On track        |
| Big O notation  | DSA        | 2026-02-20    | 2026-05-20  | 5                   | Nearly mastered |

### Retired (mastered)

| Concept           | Pillar | Date mastered | Total reviews |
| ----------------- | ------ | ------------- | ------------- |
| Variables & types | Python | 2026-02-15    | 4             |
| Git basics        | Tools  | 2026-02-10    | 3             |

### Review Queue (tomorrow)

1. SQL JOINs — "Explain the difference between LEFT JOIN and INNER JOIN"
2. REST vs GraphQL — "When would you choose GraphQL over REST?"
```

#### Integration with other features

- **Teach-back mode (3.6):** Spaced repetition pings ARE teach-back prompts, just for older material. Same response handling — strong answers space out, weak answers compress the interval.
- **Weekly digest (3.9):** Digest mentions spaced repetition performance — "Your DSA foundations are rock-solid (5 concepts mastered this month). SQL still needs reinforcement."
- **Interview prep (Phase 3):** When interview mode activates, the agent increases review frequency for concepts relevant to the target role. "You have an interview in 2 weeks — let's make sure your system design fundamentals are fresh."

---

## 4. The Daily Loop (Core UX)

```
Morning:
  Agent reads: user profile + current plan + yesterday's progress + calendar
  Agent sends Discord message:
    "Morning! Here's your plan for today:
     1. 📖 Read: Python decorators deep dive (Real Python) [link]
     2. 💻 Practice: 2 medium LeetCode problems on trees [link]
     3. 🎥 Watch: System design basics - 20min (YouTube) [link]

     Yesterday you knocked out the SQL section — nice streak (7 days).
     The tree problems are a step up from last week. If they feel hard,
     that's expected — you leveled up."

During day:
  User does tasks (or doesn't)
  OpenClaw context may show activity (optional, enhancement)

Evening (or next morning):
  Agent: "Quick check-in — how'd today go? Hit all 3, or want to tell me what happened?"
  User: "Did 1 and 3, didn't have time for LeetCode"
  Agent: "No worries. I'll carry the LeetCode forward and lighten tomorrow
          since you've got that team dinner on your calendar.
          Two tasks tomorrow instead of three."

  Agent silently:
  - Updates progress.md
  - Adjusts tomorrow's plan
  - Logs adaptation in adaptation-log.md
  - Updates dashboard data
```

### Adaptation triggers (autonomous, no user action needed):

| Trigger                                        | Agent Response                                                                                  | Feature             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------- |
| User skips tasks 2 days in a row               | Reduce daily load, send encouraging check-in                                                    | Adaptation          |
| User completes everything early                | Increase difficulty or add stretch tasks                                                        | Adaptation          |
| User mentions job search in conversation       | Offer to pivot to job-search mode                                                               | Interview Prep      |
| User says "I have an interview at X on date Y" | Spin up interview crash course                                                                  | Interview Prep      |
| Calendar shows busy week                       | Proactively lighten the plan                                                                    | Context Awareness   |
| User hasn't responded in 3+ days               | Gentle ping, offer to pause or restructure                                                      | Check-in            |
| User completes a skill block                   | Level up, celebrate, introduce next topic. Trigger teach-back on core concepts from that block. | Teach-back          |
| Mock interview reveals weak area               | Add targeted practice to next week's plan                                                       | Mock Interview      |
| User describes an achievement in conversation  | Save to win log candidates, refine later                                                        | Win Log             |
| Interview prep activates with thin win log     | Start win extraction conversations proactively                                                  | Win Log             |
| User completes conceptual task                 | Trigger teach-back prompt (not every time — ~1 in 3)                                            | Teach-back          |
| Teach-back response is weak                    | Add reinforcement task with different resource type, compress spaced rep interval               | Teach-back + SRS    |
| Concept due for spaced review                  | Include review ping in next daily message                                                       | Spaced Rep          |
| User hasn't built anything in 3+ weeks         | Suggest a portfolio project matched to dream career + current skills                            | Portfolio           |
| User completes a portfolio project             | Draft win log entry, celebrate in weekly digest                                                 | Portfolio + Win Log |
| Task completed (1 in 3 frequency)              | Ask for resource quality rating (great/okay/didn't click)                                       | Resource Feedback   |
| Multiple "didn't click" ratings on same format | Shift resource mix toward preferred formats                                                     | Resource Feedback   |
| End of week reached                            | Generate and send weekly narrative digest                                                       | Weekly Digest       |
| User's dream career seems to be shifting       | Surface observation and ask if plan should adjust                                               | Dream Career        |

---

## 5. What Ports from ProngGSD

| ProngGSD Component                     | Port?      | How                                                                                                                           | Phase |
| -------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ----- |
| Onboarding conversation structure      | ✅ Yes     | Adapt prompts to Discord/agent conversation format. Add dream career extraction.                                              | 0     |
| Plan generation prompts                | ✅ Yes     | Core prompt logic reusable, output format changes to .md files instead of DB rows                                             | 0     |
| Curated resources (55+)                | ✅ Yes     | Direct port as `resources/curated-resources.md`, categorized by pillar + level                                                | 1     |
| Pillar/phase/weight system             | ✅ Yes     | Encode in memory files instead of DB tables                                                                                   | 0     |
| Leveling thresholds                    | ✅ Yes     | Same logic, tracked in `progress.md`. Add teach-back gate before level-up.                                                    | 1     |
| Pacing profiles                        | ✅ Yes     | Same concept, more dynamic with real observation + calendar awareness                                                         | 2     |
| Interview onboarding                   | ✅ Yes     | Adapt to conversational Discord format (3-4 turns)                                                                            | 3     |
| Mock interview prompts                 | ✅ Yes     | AI logic reusable. Add win log integration + delivery coaching. UI: Discord for quick rounds, dashboard for focused practice. | 3-4   |
| Mistake journal                        | ✅ Yes     | Memory file instead of DB table. Add cross-mock pattern detection.                                                            | 3     |
| Streak tracking                        | ✅ Yes     | Simpler — agent tracks directly in `progress.md`                                                                              | 1     |
| Win log (Ralph_Win_Log.md format)      | ✅ Concept | Same STAR format. Three sources instead of manual: passive capture, extraction conversations, mock interview captures.        | 1-3   |
| Mentor chat                            | ❌ No      | The agent IS the mentor — every conversation is mentorship                                                                    | —     |
| React dashboard UI                     | ❌ No      | Rebuild lighter in Phase 4 for mock interviews, progress viz, win log editing                                                 | 4     |
| Supabase Edge Functions                | ❌ No      | AI calls happen through agent's native LLM access                                                                             | —     |
| RLS / auth system                      | ❌ No      | Single user, local files, no auth needed for v1                                                                               | —     |
| **New (not in ProngGSD)**              |            |                                                                                                                               |       |
| Teach-back mode                        | 🆕 New     | Active recall engine — no ProngGSD equivalent. See Section 3.6.                                                               | 1     |
| Resource quality feedback              | 🆕 New     | Learning style profiling from actual ratings — no ProngGSD equivalent. See Section 3.8.                                       | 1     |
| Spaced repetition                      | 🆕 New     | Knowledge decay prevention — no ProngGSD equivalent. See Section 3.10.                                                        | 2     |
| Weekly narrative digest                | 🆕 New     | Motivational learning journal — no ProngGSD equivalent. See Section 3.9.                                                      | 2     |
| Portfolio project suggestions          | 🆕 New     | Dream-career-aligned project scoping — no ProngGSD equivalent. See Section 3.7.                                               | 3     |
| Context awareness (calendar, activity) | 🆕 New     | OpenClaw-native capability — impossible in web app.                                                                           | 2     |

---

## 6. Implementation Phases

### Phase 0: Foundation & Validation (1-2 weeks)

**Goal:** Prove the core loop works with OpenClaw + Discord

**Tasks:**

- [ ] Get access to OpenClaw/NanoClaw (via friend) and understand the skill file format, memory system, and tool capabilities
- [ ] Build skill file: `onboarding.md` — agent has a first conversation with a new user, extracts dream career + current situation + experience level + learning preferences, writes `memory/user-profile.md`
- [ ] Build skill file: `daily-plan.md` — agent reads user profile, generates a 1-week plan with pillar selection based on dream career, writes to `memory/current-plan.md` + `memory/plan-tasks/week-01.md`
- [ ] Set up Discord bot integration — agent can send a message to a Discord channel and receive replies
- [ ] Create empty template memory files so the agent has a clean starting structure

**Validation checkpoint:** Agent onboards you via Discord conversation, generates a plan, sends you Day 1 tasks as a Discord message with resource links. You reply, agent acknowledges.

**What you learn:** Is the OpenClaw skill file format expressive enough? Can the agent reliably read/write structured memory? Is Discord integration smooth?

**Exit criteria:** You receive a personalized daily task list via Discord based on your onboarding conversation. If this doesn't work, stop and fix before proceeding.

---

### Phase 1: The Daily Loop + Learning Feedback (2-3 weeks)

**Goal:** Functional daily learning companion with adaptation, resource feedback, and teach-back

**Core loop tasks:**

- [ ] Skill: `check-in.md` — evening/morning check-in conversation via Discord. Agent asks what user completed, notes skipped tasks, adjusts next day. Writes updates to `memory/progress.md` and `memory/history.md`.
- [ ] Skill: `adaptation.md` — autonomous plan adjustment. Reads progress + check-in data, adjusts task difficulty/load. Writes every change to `memory/adaptation-log.md` with timestamp and reasoning.
- [ ] Memory: progress tracking — streaks (consecutive days with at least 1 task completed), completion rates (tasks done / tasks assigned per week), pillar levels (blocks completed at level → threshold → level up)
- [ ] Port curated resources from ProngGSD (55+ entries) into `resources/curated-resources.md`, categorized by pillar and difficulty level
- [ ] Plan generation uses curated resources for task links — each task includes: action, resource name, platform, URL, estimated time
- [ ] Multi-week plan support — agent generates week-by-week, generating next week when current week completes

**Teach-back tasks (Section 3.6):**

- [ ] Skill: `teach-back.md` — after ~1 in 3 conceptual tasks, agent asks user to explain the concept back in 1-3 sentences. Agent evaluates response quality (strong/partial/can't explain/skipped) and takes appropriate action per the response table in Section 3.6.
- [ ] Teach-back log in `memory/progress.md` — records every teach-back prompt, response quality, gaps identified, and actions taken
- [ ] Teach-back before level-up gate — before advancing a pillar level, agent asks user to explain 1-2 core concepts from current level. Must pass to advance.

**Resource feedback tasks (Section 3.8):**

- [ ] Skill: `resource-feedback.md` — after ~1 in 3 completed tasks, agent asks "Was that resource helpful? (great / okay / didn't click)". One-word answer, zero friction.
- [ ] Memory: `resource-feedback.md` — stores per-resource ratings + auto-derives learning style profile (preferred format, preferred length, platform preferences). Format described in Section 3.8.
- [ ] Agent uses resource feedback to influence future task resource selection — if user prefers videos, shift mix toward video. If a platform consistently underperforms, deprioritize it.

**Win log passive capture:**

- [ ] During progress tracking, agent identifies notable achievements (leveling up faster than expected, completing stretch tasks, breakthrough moments) and saves drafts to `memory/win-log/candidates.md`

**Validation checkpoint:** Use it yourself for 1 full week. Does the daily loop feel natural? Is adaptation working? Do teach-backs feel helpful or annoying? Does resource feedback change recommendations?

**What you learn:** Does autonomous adaptation feel helpful or annoying? What's the right message frequency? Do the memory files stay clean or get messy? Is the teach-back frequency right?

**Exit criteria:** You've used it for 7 consecutive days. The agent adapted at least once based on your behavior. At least one teach-back happened and the agent responded appropriately.

---

### Phase 2: Context Awareness + Spaced Repetition + Weekly Digest (2-3 weeks)

**Goal:** Agent uses OpenClaw's broader context, prevents knowledge decay, and provides weekly narrative summaries

**Context awareness tasks:**

- [ ] Read user's existing OpenClaw identity/memory (if they have one) to pre-populate profile fields during onboarding
- [ ] Calendar integration — detect busy days and auto-adjust plan load. If tomorrow has 5+ hours of meetings, reduce tasks from 3 to 1-2.
- [ ] Activity awareness — if OpenClaw tracks what the user is doing, use it to verify task completion or detect relevant activity (e.g., user opened LeetCode → probably doing the coding task)
- [ ] Smart nudges — if user hasn't engaged by evening and isn't busy per calendar, gentle ping. If they're clearly occupied, stay quiet.
- [ ] Settings in `config/settings.md`: user can tell the agent preferences. Supported settings: quiet hours (e.g., "no messages before 10am"), days off (e.g., "weekends are off"), preferred resource format, teach-back frequency preference, resource feedback frequency preference, message verbosity (concise vs. detailed)

**Spaced repetition tasks (Section 3.10):**

- [ ] Skill: `spaced-repetition.md` — manages the review schedule. When a concept is due for review, includes one review question in the daily Discord message.
- [ ] Memory: `memory/spaced-repetition.md` — tracks active review items (concept, pillar, last reviewed, next review, consecutive correct answers, status), retired/mastered items, and tomorrow's review queue. Format described in Section 3.10.
- [ ] Simplified spacing algorithm per the table in Section 3.10 (3 days → 1 week → 2 weeks → 1 month → 3 months → retire). Correct answers increase interval. Wrong/skipped answers compress interval.
- [ ] Integration: when a teach-back response is weak, the concept enters the spaced repetition queue at the shortest interval (review in 3 days).
- [ ] Integration: when interview prep activates, increase review frequency for concepts relevant to the target role.
- [ ] One review question per day maximum, mixed into the daily plan message. Never a separate "quiz session" — zero friction.

**Weekly narrative digest tasks (Section 3.9):**

- [ ] Skill: `weekly-review.md` — generates weekly narrative digest at end of each week. Sent via Discord.
- [ ] Digest includes: narrative summary of focus areas, teach-back performance, stats (streak, pillar levels, completion rate) embedded in narrative, pattern observations, dream career connection, look-ahead for next week, adaptation question if agent noticed something worth adjusting. Full format described in Section 3.9.
- [ ] Memory: `memory/weekly-digests/week-{N}.md` — one file per week, stores the full digest plus structured data (focus areas, tasks completed, pillar progress, teach-back results, observations, adaptations made).
- [ ] Agent uses weekly review to also revisit dream career alignment — if conversations suggest a shift, surface it in the digest.

**Validation checkpoint:** Agent makes at least one smart context-based adaptation per week. Spaced repetition pings happen naturally. Weekly digest is generated and feels motivating.

**What you learn:** How much context is useful vs. creepy? What's the right balance of autonomous vs. prompted? Is the spaced repetition frequency right? Do weekly digests motivate or feel like noise?

**Exit criteria:** Used for 2+ weeks. At least one context-aware adaptation happened (calendar-based or activity-based). Spaced repetition is tracking 5+ concepts. Two weekly digests generated.

---

### Phase 3: Interview Prep + Win Log + Portfolio Projects (3-4 weeks)

**Goal:** Job search detection, interview crash courses, win log system, and portfolio project suggestions

**Interview prep tasks:**

- [ ] Skill: `interview-prep.md` — detects job search intent (explicit: user says "I have an interview" / inferred: user mentions job applications, asks about resume, etc.). Offers to spin up crash course. Writes to `memory/interview-context.md`.
- [ ] Interview onboarding conversation — port from ProngGSD's `gsd-interview-onboarding` prompts. 3-4 turn conversation to extract: target company, role, interview date, interview format (behavioral/technical/system design/mixed), weak areas, company context. Adapt prompts to conversational Discord format.
- [ ] Crash course plan generation — port from ProngGSD's `interview_plan` mode. Generate 1-3 week intensive plan with all blocks upfront. Interview-specific pillars use separate tracking.
- [ ] Parallel plan support: interview prep runs alongside regular learning plan (same as ProngGSD's dual active plans). Daily messages include both.

**Mock interview tasks:**

- [ ] Skill: `mock-interview.md` — conducts mock interviews via Discord. Three modes: behavioral, technical, system design. Uses interview context (company, role, job description) to tailor questions.
- [ ] Mock interview has access to win log — suggests which achievement to use for each question, coaches delivery ("That was good, but you spent 90 seconds on the situation and 10 on the result. Flip it.")
- [ ] Mistake journal in `memory/mistake-journal.md` — after each mock, agent asks what went wrong and saves structured entries (question, what they said, what would've been better, category tag).
- [ ] Pattern detection across mistakes — "You've struggled with 'tell me about a failure' three times now. Let's work on that specifically."

**Win log tasks (Section 3.5):**

- [ ] Skill: `win-log.md` — targeted win extraction conversations. Agent reads resume/LinkedIn context from `memory/resume-context.md` and asks about specific roles/projects: "You listed a data pipeline project at your last job. Tell me more — what was broken when you started? What did you specifically do? What happened after?" Follows STAR format to structure the extraction.
- [ ] Win log: mock interview capture — during mocks, agent notes achievements the user describes. After the interview, offers to polish and save: "You told a good story about the migration, but you buried the lead. The impressive part was zero downtime — lead with that. Want me to save a polished version?"
- [ ] Win log: interview mapping in `memory/win-log/interview-mapping.md` — categorize confirmed wins by interview question type (leadership/influence, technical problem solving, failure/learning, collaboration, initiative). Format described in Section 3.5.
- [ ] Win log: surface candidates — periodically show the user items from `candidates.md` and ask "Is this worth adding to your win log?" If yes, run extraction conversation to polish into STAR format and move to `wins.md`.
- [ ] Win log: gap detection — when interview prep activates, agent checks win log coverage: "You don't have a strong 'failure' story yet. Most interviews ask this. Want to think of one?"

**Portfolio project tasks (Section 3.7):**

- [ ] Skill: `portfolio-projects.md` — at strategic moments (after completing a skill block, after 3+ weeks without building, when interview prep activates), suggest a portfolio project.
- [ ] Project suggestions consider: dream career (what impresses hiring managers), current skill level (one level above comfort zone), recently practiced skills (reinforce, don't distract), time commitment (match pacing profile), public data/APIs (no setup barriers). Format described in Section 3.7.
- [ ] When user accepts a project, agent breaks it into tasks and adds to the plan in `memory/current-plan.md` under `## Portfolio Projects`.
- [ ] When a project is completed, agent automatically drafts a win log entry from it and surfaces for user confirmation.

**Validation checkpoint:** Simulate full interview prep scenario: detection → onboarding → crash course → mock interview with win log coaching → mistake journal → portfolio project suggestion. Win log has 3+ polished entries with interview mapping.

**What you learn:** Can mock interviews work in Discord, or do they really need the dashboard? Does win log extraction feel natural or forced? Do portfolio project suggestions feel relevant?

**Exit criteria:** Complete mock interview conducted via Discord with win log integration. Win log has entries mapped to question types. At least one portfolio project suggested (accepted or declined).

---

### Phase 4: Web Dashboard (3-4 weeks)

**Goal:** Visual interface for things that need more space than Discord

**Dashboard tasks:**

- [ ] Lightweight Vite app — no auth, single user, reads from agent memory files via local file API or simple server. Tech: React + Vite + Tailwind (keep it simple).
- [ ] Progress page: streak heatmap (from `progress.md`), pillar level cards, completion rate charts, teach-back performance summary, spaced repetition mastery count
- [ ] Plan overview: full multi-week timeline view, current week highlighted, task status (done/pending/skipped)
- [ ] Mock interview UI: dedicated chat interface for focused interview practice (Discord is too linear for serious mock interview sessions). Full conversation history, feedback display, mistake journal below.
- [ ] Interview prep workspace: job description input, company context viewer, resume context viewer, win log with interview mapping (which stories to use for which questions)
- [ ] Win log dashboard: view/edit polished wins (STAR format), see interview mapping, review candidates the agent flagged, add new wins manually
- [ ] Portfolio projects: view active/completed projects, tasks breakdown, link to win log entry when completed
- [ ] Weekly digest archive: browse past weekly digests as a learning journal
- [ ] History: searchable log of completed tasks, filterable by pillar and week
- [ ] Agent sync: dashboard reads from memory files (file watcher or polling), agent writes updates. Dashboard can also write (e.g., user edits a win log entry) and agent picks up changes.

**Validation checkpoint:** Dashboard adds clear value that Discord alone can't provide. Mock interview UI is better than Discord for focused practice. Win log editing is easier in dashboard.

**Decision point:** Is the dashboard worth maintaining, or does the Discord interface cover 90% of needs? Be honest about this — if the dashboard is dead weight, cut it. Keep only the pages that genuinely need a visual interface.

**Exit criteria:** Dashboard deployed locally, syncing with agent memory files. At least one mock interview conducted through dashboard. User finds it useful for at least 2 of: progress visualization, win log editing, mock interviews.

---

### Phase 5: Polish & Open Source Release (2-3 weeks)

**Goal:** Other people can install and use it

**Tasks:**

- [ ] Clean README with setup instructions (clone, configure OpenClaw, add Discord bot, run onboarding). Step-by-step, assumes no prior OpenClaw knowledge.
- [ ] First-run experience: agent detects empty `memory/user-profile.md` and initiates onboarding automatically
- [ ] Configuration docs: how to customize all settings in `config/settings.md` (message frequency, teach-back frequency, resource format preferences, quiet hours, days off, verbosity)
- [ ] Template memory files for fresh start — all files present with empty/example structure so the agent knows the expected format
- [ ] Error handling: what happens when memory files get corrupted or malformed? Agent should detect and self-heal or alert user.
- [ ] Test with friend (the one with NanoClaw) — full end-to-end: install, onboard, use for 3+ days
- [ ] Fix everything that breaks when it's not your machine (different OS, different OpenClaw version, different Discord setup)
- [ ] GitHub repo, MIT license, contributing guide, issue templates
- [ ] **Validation checkpoint:** Friend successfully installs, onboards, and uses it for 3+ days without your help

**Exit criteria:** Someone who isn't you installs and uses it successfully from the README alone.

---

### Phase 6+ (Future — don't build yet)

- Multi-user support (needs actual DB — SQLite local or Supabase cloud)
- More messaging platforms (Telegram, WhatsApp, Slack)
- Community resource sharing (users contribute curated resources, aggregate quality ratings)
- Peer learning (agent connects users working on similar skills for accountability)
- Voice interface for mock interviews (more realistic interview practice)
- Mobile companion app
- RAG over learning resources (agent can search documentation, course content, Stack Overflow)
- Analytics across users (what resources work best, what pacing produces best outcomes)
- Accountability buddy matching — agent pairs users with similar goals for weekly check-ins
- AI-generated practice problems tailored to the user's weak areas (not just curated links)
- Integration with LinkedIn Learning, Coursera, Udemy APIs for richer resource data

---

## 7. Open Questions (for Ralph to decide)

1. **Naming.** "Agent Learning Companion" is a placeholder. What do you want to call this?
2. **OpenClaw access.** Timeline depends on when you can actually build and test on the platform. Is your friend available to pair on Phase 0?
3. **Which LLM does the agent use?** OpenClaw agents presumably use whatever model the user configures. Does this affect your prompt design? (ProngGSD uses Gemini Flash Lite for cost — an OpenClaw agent might use Claude, GPT, etc.)
4. **Open source from day one, or after v1 works?** I'd recommend getting through Phase 1 privately, then open-sourcing. No point open-sourcing something that doesn't work yet.
5. **Dashboard scope.** My honest take: skip the dashboard until Phase 4 and see if you even need it. Mock interviews might work fine in Discord. Don't build a dashboard because it feels like a "real product" — build it only when Discord genuinely can't handle something.

---

## 8. CTO Recommendation

**Build this.** The insight is real: an agent that comes to you beats an app you go to. The friction reduction is the entire value proposition. The five additional features (teach-back, resource feedback, spaced repetition, weekly digests, portfolio projects) transform it from "todo list over Discord" into a genuine learning system that actively makes users better — not just organized.

**But be disciplined:**

- Phase 0 is validation. If OpenClaw can't reliably read/write structured memory or send Discord messages, the architecture doesn't work and you need to know that in week 1, not week 8.
- Keep it file-based as long as possible. The moment you add a database, you add infrastructure, and infrastructure kills open-source adoption.
- Don't build the dashboard until you've proven the agent loop. The dashboard is a nice-to-have. The agent loop is the product.
- Port prompts from ProngGSD aggressively — that's months of iteration you don't have to redo. But adapt them to conversational format; don't just copy-paste.
- The new features (teach-back, SRS, resource feedback) all slot into Phase 1-2 — they're not separate projects, they're enhancements to the daily loop. Don't treat them as separate workstreams.
- The win log is the sleeper differentiator. Nobody else is building an agent that passively builds your interview cheat sheet while you learn. That's the feature that makes people tell their friends about this.

**How to start today (without OpenClaw):**

1. Create the repo with the full file structure from Section 3.2
2. Write the skill files as detailed .md instruction sets — test them with Claude Code
3. Write the memory templates with example data so the format is clear
4. Port the curated resources from ProngGSD
5. Schedule a session with your friend to port to OpenClaw format + set up Discord

Start with Phase 0. Get on a call with your friend. Build the first skill file. Send yourself a Discord message with tomorrow's learning plan. If that feels magical, you've got something.
