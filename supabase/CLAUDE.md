# supabase/ — Agent Context

## Overview

Supabase backend configuration: edge functions, database migrations, and project config. This project shares its Supabase instance with DailyProng — all ProngGSD functions are prefixed with `gsd-`.

## Structure

```
supabase/
├── config.toml       # Project ID + function settings
├── migrations/       # Postgres schema SQL files
└── functions/        # Deno edge functions
    ├── _shared/                  # Shared Deno modules (rateLimit.ts, cors.ts)
    ├── gsd-mentor-chat/
    ├── gsd-apply-mentor-changes/
    ├── gsd-generate-plan/
    ├── gsd-interview-onboarding/    # AI interview prep mini-onboarding (3-4 turns)
    ├── gsd-mock-interview/          # AI mock interview sessions (start/continue/complete)
    ├── gsd-onboarding-chat/
    ├── gsd-process-checkin/
    └── gsd-reset-user-data/
```

## config.toml

- Project ID: `hpubamqxoeckzrbvgsof`
- All functions have `verify_jwt = false` — JWT validation is handled manually in function code via `supabase.auth.getUser()`

## Env Vars Used by Edge Functions

| Variable | Used by | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | All | Supabase project URL |
| `SUPABASE_ANON_KEY` | All | Anon key for user-scoped client |
| `SUPABASE_SERVICE_ROLE_KEY` | gsd-mentor-chat, gsd-generate-plan, gsd-onboarding-chat, gsd-mock-interview, gsd-reset-user-data | Admin client for rate limit table / data deletion / mock interview writes |
| `GEMINI_API_KEY` | gsd-mentor-chat, gsd-generate-plan, gsd-onboarding-chat, gsd-interview-onboarding, gsd-mock-interview | Google Generative AI API key |
| `INTERNAL_BACKGROUND_SECRET` | gsd-generate-plan | Shared secret used to identify background calls (skips rate limiting). No server-side cascade currently fires these — kept as legacy infrastructure. Set manually in Supabase dashboard → Edge Function secrets. |
| `OWNER_EMAIL` | _shared/rateLimit.ts, gsd-reset-user-data | Owner account email — gets 500/day rate limit instead of 50; also gates the "rewind" mode. Set in Supabase dashboard → Edge Function secrets. |
