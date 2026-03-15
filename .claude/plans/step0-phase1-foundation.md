# ProngGSD Step 0 + Phase 1: Foundation Implementation Plan

**Overall Progress:** `100%`

## TLDR
Fork DailyProng into ProngGSD. Rename all edge functions with `gsd-` prefix so they coexist with DailyProng on the same Supabase project. Create the new database schema (5 tables + 7 columns). Rebrand UI. Replace the old unit-based dashboard with a placeholder. Hide demo mode. Verify everything builds and boots.

## Critical Decisions
- **No FK on `plan_blocks.pillar_id`** — mentor can delete/recreate pillars; enforce referential integrity at app level
- **`plan_tasks` includes `user_id`** — needed for RLS scoping (implementation doc missed it, brief corrected it)
- **Dashboard: full replacement** — entire page becomes a placeholder, no surgical gutting of old flow
- **Demo mode: hide entry point** — remove button from Auth page; demo is broken with placeholder dashboard anyway
- **localStorage keys: `dailyprong-*` → `pronggsd-*`** — new app, no existing user preferences to preserve
- **Edge function prompts: update branding** — "DailyProng" → "ProngGSD" in system prompts (branding, not logic)
- **About page: leave as-is** — not worth touching in Phase 1
- **`reset-user-data` included in renames** — becomes `gsd-reset-user-data`

## Tasks:

- [x] 🟩 **Step 1: Rename edge function directories**
  - [x] 🟩 `onboarding-chat` → `gsd-onboarding-chat`
  - [x] 🟩 `generate-unit` → `gsd-generate-plan`
  - [x] 🟩 `process-feedback` → `gsd-process-checkin`
  - [x] 🟩 `mentor-chat` → `gsd-mentor-chat`
  - [x] 🟩 `apply-mentor-changes` → `gsd-apply-mentor-changes`
  - [x] 🟩 `reset-user-data` → `gsd-reset-user-data`

- [x] 🟩 **Step 2: Update frontend edge function references**
  - [x] 🟩 `src/pages/Dashboard.tsx` — `process-feedback` → `gsd-process-checkin`, `generate-unit` → `gsd-generate-plan`
  - [x] 🟩 `src/hooks/useUnitGeneration.tsx` — `generate-unit` → `gsd-generate-plan`
  - [x] 🟩 `src/pages/Mentor.tsx` — `mentor-chat` → `gsd-mentor-chat`, `apply-mentor-changes` → `gsd-apply-mentor-changes`
  - [x] 🟩 `src/pages/Onboarding.tsx` — `onboarding-chat` → `gsd-onboarding-chat`
  - [x] 🟩 `src/pages/SettingsPage.tsx` — `reset-user-data` → `gsd-reset-user-data`

- [x] 🟩 **Step 3: Update "DailyProng" → "ProngGSD" in edge function system prompts**
  - [x] 🟩 `gsd-mentor-chat/index.ts` — system prompt branding (2 occurrences)
  - [x] 🟩 `gsd-generate-plan/index.ts` — system prompt branding
  - [x] 🟩 `gsd-onboarding-chat/index.ts` — system prompt branding

- [x] 🟩 **Step 4: Verify build after renames**
  - [x] 🟩 `npm run build` passed with zero errors

- [x] 🟩 **Step 5: Create database migration**
  - [x] 🟩 Created `supabase/migrations/20260315120000_pronggsd_foundation.sql`
  - [x] 🟩 `curated_resources` table + RLS (authenticated SELECT only)
  - [x] 🟩 `learning_plans` table + RLS (user_id scoped)
  - [x] 🟩 `plan_blocks` table + RLS (user_id scoped, no FK on pillar_id)
  - [x] 🟩 `plan_tasks` table + RLS (user_id scoped, includes user_id column)
  - [x] 🟩 `user_progress` table + RLS (user_id scoped)
  - [x] 🟩 Added 7 new columns to `user_profile`
  - [x] 🟩 Seeded `curated_resources` with 15 starter entries

- [x] 🟩 **Step 6: Rebrand UI — "DailyProng" → "ProngGSD"**
  - [x] 🟩 `index.html` — title, meta description, og:title, og:url → `https://pronggsd.vercel.app`
  - [x] 🟩 `src/components/Layout.tsx` — header logo text, footer link text
  - [x] 🟩 `src/pages/Auth.tsx` — heading text
  - [x] 🟩 `src/pages/Onboarding.tsx` — breadcrumb/header text
  - [x] 🟩 `src/hooks/useDemo.tsx` — demo mentor greeting text
  - [x] 🟩 `package.json` — name field → `pronggsd`

- [x] 🟩 **Step 7: Rename localStorage keys**
  - [x] 🟩 `dailyprong-theme` → `pronggsd-theme` in `useTheme.tsx`
  - [x] 🟩 `dailyprong-*` → `pronggsd-*` in `Dashboard.tsx` (all 7 keys)

- [x] 🟩 **Step 8: Replace Dashboard with placeholder**
  - [x] 🟩 Replaced Dashboard.tsx content with centered "ProngGSD — Coming soon" message
  - [x] 🟩 Route and Layout wrapper preserved

- [x] 🟩 **Step 9: Hide demo mode entry point**
  - [x] 🟩 Removed "Explore Demo" button, separator, and related imports from Auth.tsx

- [x] 🟩 **Step 10: Final build + boot verification**
  - [x] 🟩 `npm run build` passed (bundle ~25KB smaller with stripped Dashboard)
  - [x] 🟩 No TypeScript errors from changes
  - [x] 🟩 Only remaining "DailyProng" reference is in About.tsx (intentionally left)

- [x] 🟩 **Step 11: Update documentation**
  - [x] 🟩 Updated `CLAUDE.md` — full rewrite for ProngGSD context
  - [x] 🟩 Updated `supabase/CLAUDE.md` — new function names
  - [x] 🟩 Updated `src/hooks/CLAUDE.md` — localStorage key
  - [x] 🟩 Updated `src/pages/CLAUDE.md` — Dashboard and Auth descriptions
  - [x] 🟩 Logged entry in `AGENT_LOG.md`
