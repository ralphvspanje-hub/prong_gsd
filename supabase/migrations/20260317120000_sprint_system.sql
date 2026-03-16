-- Sprint System: focused iterative learning cycles
-- Adds sprint format support to learning_plans and creates sprint_checkins table

-- 1. Add sprint columns to learning_plans
ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS plan_format text DEFAULT 'weekly';
-- 'weekly' (legacy) or 'sprint' (new default for focused iterative cycles)

ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS sprint_started_at timestamptz;
-- When the current sprint began. Reset at each new sprint start.

-- 2. Create sprint_checkins table for multi-turn AI check-in conversations
CREATE TABLE IF NOT EXISTS sprint_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  plan_id uuid REFERENCES learning_plans NOT NULL,
  sprint_number integer NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'in_progress',
  ai_summary jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- RLS for sprint_checkins
ALTER TABLE sprint_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sprint checkins"
  ON sprint_checkins FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_sprint_checkins_user_plan
  ON sprint_checkins (user_id, plan_id, sprint_number);
