-- =============================================================================
-- Phase 9.5: Crash Course Mode — add crashcourse_type to learning_plans
-- Distinguishes interview prep crash courses from generic crash courses.
-- All crash courses keep plan_type = 'interview_prep' for backwards compat.
-- =============================================================================

-- New column: 'interview' for job prep, 'generic' for anything else, null for learning plans
ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS crashcourse_type text;

-- Backfill existing interview_prep plans as 'interview'
UPDATE learning_plans SET crashcourse_type = 'interview' WHERE plan_type = 'interview_prep' AND crashcourse_type IS NULL;
