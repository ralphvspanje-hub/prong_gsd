-- Phase 4: Add checkin_feedback column to plan_blocks for storing weekly difficulty feedback.
alter table plan_blocks add column if not exists checkin_feedback jsonb;
