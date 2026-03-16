-- Add explicit hours/day and days/week fields for crash course time commitment
-- These replace the enum-based time_commitment for crash courses,
-- allowing users to specify "8 hours/day, 5 days/week" instead of picking from a fixed list.

ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS hours_per_day numeric;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS days_per_week integer;
