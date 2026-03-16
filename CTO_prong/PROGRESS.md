# ProngAgent — Implementation Progress

**Repo:** (not created yet)
**Product spec:** `CTO_prong/AGENT_LEARNING_COMPANION.md`
**Implementation guide:** `CTO_prong/IMPLEMENTATION_GUIDE.md`

---

## Phase 0: Foundation & Validation (Week 1-2)

- [ ] **Step 0.1:** Create repo structure (`prongagent/` with skills/, memory/, resources/, config/)
- [ ] **Step 0.2:** Write memory templates (user-profile, current-plan, progress, plan-tasks, etc.)
- [ ] **Step 0.3:** Write first skill files (onboarding.md, daily-plan.md)
- [ ] **Step 0.4:** Port curated resources from ProngGSD (55+ entries)
- [ ] **Step 0.5:** Test with Claude Code (validate onboarding + plan generation logic)
- [ ] **Step 0.6:** Session with friend — port to OpenClaw format, set up Discord

**Exit gate:** Receive personalized daily tasks via Discord from onboarding conversation.

---

## Phase 1: The Daily Loop + Learning Feedback (Week 3-5)

- [ ] **Step 1.1:** Write core skill files (check-in.md, adaptation.md)
- [ ] **Step 1.2:** Write learning feedback skills (teach-back.md, resource-feedback.md)
- [ ] **Step 1.3:** Port curated resources fully (all 55+ with URLs, pillar, level)
- [ ] **Step 1.4:** Dogfood for 1 full week — adjust based on real usage

**Exit gate:** 7 consecutive days used. Agent adapted once. Teach-back happened. Resource feedback influenced a recommendation.

---

## Phase 2: Context + Spaced Repetition + Weekly Digest (Week 6-8)

- [ ] **Step 2.1:** Write spaced repetition skill (spaced-repetition.md)
- [ ] **Step 2.2:** Write weekly review skill (weekly-review.md)
- [ ] **Step 2.3:** Context awareness (calendar, activity — depends on OpenClaw capabilities)
- [ ] **Step 2.4:** Settings system (config/settings.md respected by all skills)

**Exit gate:** 2+ weeks used. SRS tracking 5+ concepts. Two weekly digests generated.

---

## Phase 3: Interview Prep + Win Log + Portfolio (Week 9-12)

- [ ] **Step 3.1:** Write interview prep skills (interview-prep.md, mock-interview.md) — port from ProngGSD
- [ ] **Step 3.2:** Write win log skill (win-log.md) — passive capture, extraction, mock capture
- [ ] **Step 3.3:** Write portfolio projects skill (portfolio-projects.md)
- [ ] **Step 3.4:** End-to-end interview scenario test

**Exit gate:** Full interview flow works. Mock interview with win log coaching. 3+ wins mapped to question types.

---

## Phase 4: Web Dashboard (Week 13-16)

- [ ] **Step 4.1:** Decide if needed (after 12 weeks Discord-only)
- [ ] **Step 4.2:** Minimal Vite app (if yes)
- [ ] **Step 4.3:** Build pages in priority order (mock interview UI, win log, progress, plan, history)

**Exit gate:** Dashboard adds value Discord can't. Or: decision to skip.

---

## Phase 5: Polish & Open Source (Week 17-19)

- [ ] **Step 5.1:** First-run experience (auto-detect new user)
- [ ] **Step 5.2:** README (step-by-step install)
- [ ] **Step 5.3:** Test with friend (installs from README alone)
- [ ] **Step 5.4:** Ship (GitHub, MIT license, v0.1.0)

**Exit gate:** Someone else installs and uses it for 3+ days without help.
