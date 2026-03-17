-- Phase 11B: Add practice question columns to plan_tasks
ALTER TABLE plan_tasks
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN user_answers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN last_feedback text;
