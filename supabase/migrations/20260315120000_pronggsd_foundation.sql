-- ProngGSD Foundation Migration
-- Creates new tables for the learning orchestrator model and extends user_profiles.

-- =============================================================================
-- 1. Curated external resources (shared, no user_id)
-- =============================================================================
create table curated_resources (
  id uuid primary key default gen_random_uuid(),
  skill_area text not null,
  platform text not null,
  resource_type text not null,  -- 'practice', 'video', 'setup', 'docs', 'repo', 'research'
  title text not null,
  url text not null,
  description text,
  min_level integer default 1,
  max_level integer default 5,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table curated_resources enable row level security;
create policy "Authenticated users can read curated resources"
  on curated_resources for select
  to authenticated
  using (true);

-- =============================================================================
-- 2. Multi-week learning plan (one active per user)
-- =============================================================================
create table learning_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  total_weeks integer not null,
  pacing_profile text not null,  -- 'aggressive', 'steady', 'exploratory'
  plan_outline jsonb not null,   -- week-by-week high-level structure
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table learning_plans enable row level security;
create policy "Users can manage their own learning plans"
  on learning_plans for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 3. Plan blocks (weekly task sets per pillar)
-- =============================================================================
create table plan_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  plan_id uuid references learning_plans not null,
  pillar_id uuid not null,       -- intentionally no FK: pillars can be deleted/recreated by mentor
  week_number integer not null,
  title text not null,
  weekly_goal text not null,
  context_brief text,
  pacing_note text,
  completion_criteria text,
  is_completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table plan_blocks enable row level security;
create policy "Users can manage their own plan blocks"
  on plan_blocks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 4. Individual tasks within plan blocks
-- =============================================================================
create table plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_block_id uuid references plan_blocks not null,
  user_id uuid references auth.users not null,  -- needed for RLS scoping
  task_order integer not null,
  action text not null,
  platform text not null,
  resource_type text not null,   -- 'curated' or 'search_query'
  url text,                      -- populated if curated
  search_query text,             -- populated if search_query type
  estimated_time_minutes integer,
  why_text text,
  is_completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table plan_tasks enable row level security;
create policy "Users can manage their own plan tasks"
  on plan_tasks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 5. Streak and progress tracking
-- =============================================================================
create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  current_day integer default 1,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_activity_date date,
  total_tasks_completed integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_progress enable row level security;
create policy "Users can manage their own progress"
  on user_progress for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 6. Extend user_profiles with ProngGSD fields
-- =============================================================================
alter table user_profile add column if not exists pacing_profile text default 'steady';
alter table user_profile add column if not exists time_commitment text;
alter table user_profile add column if not exists job_situation text;
alter table user_profile add column if not exists job_timeline_weeks integer;
alter table user_profile add column if not exists tool_setup jsonb default '{}';
alter table user_profile add column if not exists resume_text text;
alter table user_profile add column if not exists linkedin_context text;

-- =============================================================================
-- 7. Seed curated_resources with starter entries
-- =============================================================================
insert into curated_resources (skill_area, platform, resource_type, title, url, description, min_level, max_level, tags) values
-- SQL
('sql_basics', 'HackerRank', 'practice', 'HackerRank SQL Domain', 'https://www.hackerrank.com/domains/sql', 'SQL practice challenges from basic to advanced', 1, 3, array['sql', 'practice', 'challenges']),
('sql_basics', 'SQLZoo', 'practice', 'SQLZoo Interactive Tutorials', 'https://sqlzoo.net/', 'Step-by-step interactive SQL tutorials', 1, 2, array['sql', 'tutorial', 'interactive']),
('sql_basics', 'W3Schools', 'docs', 'W3Schools SQL Tutorial', 'https://www.w3schools.com/sql/', 'SQL reference and beginner tutorials', 1, 2, array['sql', 'reference', 'beginner']),
('sql_intermediate', 'LeetCode', 'practice', 'LeetCode SQL Problems', 'https://leetcode.com/problemset/database/', 'SQL problems sorted by difficulty', 2, 5, array['sql', 'practice', 'interview']),
('sql_intermediate', 'DataLemur', 'practice', 'DataLemur SQL Interview Questions', 'https://datalemur.com/questions', 'Real SQL interview questions from top companies', 3, 5, array['sql', 'interview', 'practice']),
-- Python
('python_basics', 'Python.org', 'setup', 'Python Installation Guide', 'https://www.python.org/downloads/', 'Official Python download and installation', 1, 1, array['python', 'setup', 'installation']),
('python_basics', 'Codecademy', 'practice', 'Learn Python 3', 'https://www.codecademy.com/learn/learn-python-3', 'Interactive Python basics course', 1, 2, array['python', 'basics', 'interactive']),
('python_data', 'Kaggle', 'practice', 'Kaggle Pandas Course', 'https://www.kaggle.com/learn/pandas', 'Free hands-on pandas course with exercises', 1, 3, array['python', 'pandas', 'data']),
('python_data', 'Kaggle', 'practice', 'Kaggle Python Course', 'https://www.kaggle.com/learn/python', 'Free hands-on Python fundamentals course', 1, 2, array['python', 'basics', 'data']),
-- Interview Prep
('interview_technical', 'Pramp', 'practice', 'Pramp Mock Interviews', 'https://www.pramp.com/', 'Free peer-to-peer mock technical interviews', 3, 5, array['interview', 'mock', 'technical']),
('interview_technical', 'Interviewing.io', 'practice', 'Interviewing.io', 'https://interviewing.io/', 'Anonymous mock interviews with engineers', 3, 5, array['interview', 'mock', 'technical']),
('interview_behavioral', 'Glassdoor', 'research', 'Glassdoor Interview Questions', 'https://www.glassdoor.com/Interview/index.htm', 'Company-specific interview questions and reviews', 1, 5, array['interview', 'behavioral', 'research']),
-- Data Visualization
('data_viz', 'Kaggle', 'practice', 'Kaggle Data Visualization Course', 'https://www.kaggle.com/learn/data-visualization', 'Free hands-on data visualization with Python', 1, 3, array['visualization', 'python', 'matplotlib']),
-- General
('general_coding', 'VS Code', 'setup', 'Visual Studio Code Download', 'https://code.visualstudio.com/', 'Free code editor — recommended for beginners', 1, 1, array['setup', 'editor', 'beginner']),
('general_coding', 'GitHub', 'docs', 'GitHub Hello World Guide', 'https://docs.github.com/en/get-started/quickstart/hello-world', 'Getting started with GitHub — the basics', 1, 1, array['github', 'setup', 'beginner']);
