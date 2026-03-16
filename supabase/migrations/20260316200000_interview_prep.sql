-- =============================================================================
-- Interview Prep Mode: Schema additions
-- Adds plan_type to learning_plans, interview context to user_profile,
-- mock_interviews table, and mistake_journal table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Plan type on learning_plans (allows parallel plans)
-- ---------------------------------------------------------------------------
ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'learning';

-- ---------------------------------------------------------------------------
-- 2. Interview context on user_profile
-- ---------------------------------------------------------------------------
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS interview_target_role text;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS interview_company text;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS interview_company_context text;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS interview_date date;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS interview_intensity text;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS interview_weak_areas text[];
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS interview_format text;

-- ---------------------------------------------------------------------------
-- 3. Mock interview sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mock_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  plan_task_id uuid REFERENCES plan_tasks,
  interview_type text NOT NULL,
  target_role text,
  company_context text,
  messages jsonb DEFAULT '[]',
  status text DEFAULT 'in_progress',
  ai_feedback jsonb,
  score integer,
  duration_minutes integer,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE mock_interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own mock interviews"
  ON mock_interviews FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Mistake journal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mistake_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  mock_interview_id uuid REFERENCES mock_interviews,
  category text,
  mistake_description text NOT NULL,
  lesson_learned text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mistake_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own mistake journal"
  ON mistake_journal FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Seed interview-specific curated resources
-- ---------------------------------------------------------------------------
INSERT INTO curated_resources (skill_area, platform, resource_type, title, url, description, min_level, max_level, tags) VALUES
-- SQL Interview
('interview_sql', 'StrataScratch', 'practice', 'StrataScratch SQL Interview Questions',
 'https://www.stratascratch.com/',
 'Real SQL interview questions from FAANG companies with difficulty ratings and solutions',
 2, 5, array['sql', 'interview', 'practice']),

('interview_sql', 'DataLemur', 'practice', 'DataLemur SQL Interview Questions',
 'https://datalemur.com/questions',
 'SQL interview questions categorized by difficulty with company tags',
 2, 5, array['sql', 'interview', 'practice']),

('interview_sql', 'LeetCode', 'practice', 'LeetCode Database Problems',
 'https://leetcode.com/problemset/database/',
 'SQL problems sorted by difficulty — focus on window functions, CTEs, and joins',
 2, 5, array['sql', 'interview', 'practice']),

-- System Design
('interview_system_design', 'GitHub', 'repo', 'System Design Primer',
 'https://github.com/donnemartin/system-design-primer',
 'Comprehensive system design resource with scalability concepts and real interview problems',
 3, 5, array['interview', 'system-design', 'architecture']),

('interview_system_design', 'ByteByteGo', 'docs', 'ByteByteGo System Design 101',
 'https://bytebytego.com/',
 'Visual system design explanations with newsletter and book by Alex Xu',
 2, 5, array['interview', 'system-design', 'visual']),

-- Behavioral / STAR Method
('interview_behavioral_prep', 'YouTube', 'video', 'Jeff H Sipe — Behavioral Interview Masterclass',
 'https://www.youtube.com/results?search_query=jeff+h+sipe+behavioral+interview+STAR+method',
 'Career coach with detailed STAR method walkthroughs and example answers',
 1, 5, array['interview', 'behavioral', 'star', 'video']),

('interview_behavioral_prep', 'Harvard Business Review', 'docs', 'HBR Interview Preparation Guide',
 'https://hbr.org/topic/subject/job-interviews',
 'Research-backed interview preparation advice from Harvard Business Review',
 2, 5, array['interview', 'behavioral', 'research']),

-- Mock Interview Platforms (external suggestions)
('interview_mock_external', 'Pramp', 'practice', 'Pramp Free Mock Interviews',
 'https://www.pramp.com/',
 'Free peer-to-peer mock interviews — practice with real people in structured sessions',
 2, 5, array['interview', 'mock', 'peer']),

('interview_mock_external', 'Interviewing.io', 'practice', 'Interviewing.io Anonymous Mocks',
 'https://interviewing.io/',
 'Anonymous mock interviews with engineers from top companies — see how you compare',
 3, 5, array['interview', 'mock', 'anonymous']),

-- Statistics / Data Concepts
('interview_stats', 'Khan Academy', 'video', 'Khan Academy Statistics & Probability',
 'https://www.khanacademy.org/math/statistics-probability',
 'Free comprehensive statistics course with videos and exercises — great for data role interviews',
 1, 3, array['statistics', 'probability', 'video']),

('interview_stats', 'StatQuest', 'video', 'StatQuest with Josh Starmer',
 'https://www.youtube.com/c/joshstarmer',
 'YouTube channel explaining statistics and ML concepts clearly with visual BAM! moments',
 1, 4, array['statistics', 'ml', 'video', 'youtube']);
