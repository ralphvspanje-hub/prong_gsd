-- Phase 5: Add leveling counter to pillars for threshold-based level progression

ALTER TABLE pillars ADD COLUMN IF NOT EXISTS blocks_completed_at_level integer DEFAULT 0;

-- Expand last_difficulty_signal CHECK to accept 'just_right' (CheckinModal uses this value)
ALTER TABLE pillars DROP CONSTRAINT IF EXISTS pillars_last_difficulty_signal_check;
ALTER TABLE pillars ADD CONSTRAINT pillars_last_difficulty_signal_check
  CHECK (last_difficulty_signal IN ('too_easy', 'about_right', 'just_right', 'too_hard'));
