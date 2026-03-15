-- =============================================================================
-- Phase 8: Expand curated_resources with quality free resources
-- Adds ~40 resources across SQL, Python, Interview Prep, Data Viz, and General
-- Skips entries already seeded in the foundation migration
-- =============================================================================

insert into curated_resources (skill_area, platform, resource_type, title, url, description, min_level, max_level, tags) values

-- ---------------------------------------------------------------------------
-- SQL — Basics
-- ---------------------------------------------------------------------------
('sql_basics', 'SQLBolt', 'practice', 'SQLBolt Interactive Lessons',
 'https://sqlbolt.com/',
 'Browser-based interactive lessons teaching SQL step-by-step with inline exercises',
 1, 2, array['sql', 'interactive', 'beginner']),

('sql_basics', 'Khan Academy', 'practice', 'Khan Academy Intro to SQL',
 'https://www.khanacademy.org/computing/computer-programming/sql',
 'Video lessons paired with interactive SQL challenges covering tables, queries, and aggregation',
 1, 2, array['sql', 'video', 'beginner']),

-- ---------------------------------------------------------------------------
-- SQL — Intermediate
-- ---------------------------------------------------------------------------
('sql_intermediate', 'Mode Analytics', 'docs', 'Mode SQL Tutorial',
 'https://mode.com/sql-tutorial/',
 'Three-part tutorial (Basic, Intermediate, Advanced) focused on analytics SQL with real-world data',
 2, 4, array['sql', 'analytics', 'window-functions']),

('sql_intermediate', 'PostgreSQL Tutorial', 'docs', 'PostgreSQL Official Tutorial',
 'https://www.postgresql.org/docs/current/tutorial.html',
 'Official tutorial covering table creation, querying, joins, views, transactions, and window functions',
 2, 4, array['sql', 'postgresql', 'official']),

('sql_intermediate', 'Kaggle', 'practice', 'Kaggle Intro to SQL',
 'https://www.kaggle.com/learn/intro-to-sql',
 'Free micro-course with hands-on BigQuery notebooks covering SQL fundamentals',
 2, 3, array['sql', 'bigquery', 'practice']),

('sql_intermediate', 'SQLiteOnline', 'setup', 'SQLiteOnline Browser Sandbox',
 'https://sqliteonline.com/',
 'Free browser-based SQL editor supporting SQLite, PostgreSQL, and MySQL — no install needed',
 1, 4, array['sql', 'sandbox', 'setup']),

-- ---------------------------------------------------------------------------
-- SQL — Advanced
-- ---------------------------------------------------------------------------
('sql_advanced', 'Use The Index, Luke', 'docs', 'SQL Indexing and Tuning Guide',
 'https://use-the-index-luke.com/',
 'Deep guide to SQL indexing, execution plans, join algorithms, and performance anti-patterns',
 3, 5, array['sql', 'performance', 'indexing']),

('sql_advanced', 'PostgreSQL Tutorial', 'docs', 'PostgreSQL Window Functions Guide',
 'https://www.postgresql.org/docs/current/tutorial-window.html',
 'Official guide to ROW_NUMBER, RANK, LAG, LEAD, running totals, and partitioned aggregates',
 3, 5, array['sql', 'window-functions', 'analytics']),

-- ---------------------------------------------------------------------------
-- Python — Basics
-- ---------------------------------------------------------------------------
('python_basics', 'Python.org', 'docs', 'Official Python Tutorial',
 'https://docs.python.org/3/tutorial/',
 'The authoritative Python tutorial covering syntax, data structures, modules, and I/O',
 1, 2, array['python', 'official', 'tutorial']),

('python_basics', 'Google', 'practice', 'Google Python Class',
 'https://developers.google.com/edu/python',
 'Free two-day course with videos and coding exercises covering strings, lists, dicts, and files',
 1, 2, array['python', 'google', 'beginner']),

('python_basics', 'W3Schools', 'practice', 'W3Schools Python Tutorial',
 'https://www.w3schools.com/python/',
 'Interactive browser-based Python tutorial with Try-it-Yourself editor on every page',
 1, 2, array['python', 'interactive', 'reference']),

('python_basics', 'Automate the Boring Stuff', 'docs', 'Automate the Boring Stuff with Python',
 'https://automatetheboringstuff.com/',
 'Free online book teaching Python through practical automation projects like web scraping and spreadsheets',
 1, 3, array['python', 'book', 'automation']),

-- ---------------------------------------------------------------------------
-- Python — Data
-- ---------------------------------------------------------------------------
('python_data', 'pandas.pydata.org', 'docs', 'Pandas Getting Started Tutorials',
 'https://pandas.pydata.org/docs/getting_started/intro_tutorials/',
 'Official pandas tutorials covering DataFrames, selecting data, plotting, reshaping, and combining',
 2, 3, array['python', 'pandas', 'official']),

('python_data', 'numpy.org', 'docs', 'NumPy for Absolute Beginners',
 'https://numpy.org/doc/stable/user/absolute_beginners.html',
 'Official NumPy tutorial covering array creation, indexing, slicing, and basic operations',
 2, 3, array['python', 'numpy', 'arrays']),

('python_data', 'Real Python', 'docs', 'Pandas DataFrames 101',
 'https://realpython.com/pandas-dataframe/',
 'Comprehensive tutorial on creating, accessing, and modifying pandas DataFrames with runnable examples',
 2, 3, array['python', 'pandas', 'tutorial']),

('python_data', 'matplotlib.org', 'docs', 'Matplotlib Official Tutorials',
 'https://matplotlib.org/stable/tutorials/index.html',
 'Official tutorials from basic plotting through advanced figure customization and annotations',
 2, 4, array['python', 'matplotlib', 'visualization']),

('python_data', 'pandas.pydata.org', 'docs', 'Pandas User Guide (Advanced)',
 'https://pandas.pydata.org/docs/user_guide/index.html',
 'Full pandas guide covering MultiIndex, merge strategies, pivoting, time series, and performance',
 3, 5, array['python', 'pandas', 'advanced']),

('python_data', 'Kaggle', 'practice', 'Kaggle Intro to Machine Learning',
 'https://www.kaggle.com/learn/intro-to-machine-learning',
 'Hands-on micro-course covering decision trees, model validation, and random forests with scikit-learn',
 3, 4, array['python', 'ml', 'scikit-learn']),

('python_data', 'GitHub Pages', 'docs', 'Python Data Science Handbook',
 'https://jakevdp.github.io/PythonDataScienceHandbook/',
 'Free online book covering NumPy, pandas, matplotlib, and scikit-learn in depth as Jupyter notebooks',
 3, 5, array['python', 'data-science', 'book']),

-- ---------------------------------------------------------------------------
-- Interview Prep — Technical
-- ---------------------------------------------------------------------------
('interview_technical', 'LeetCode', 'practice', 'LeetCode Coding Problems',
 'https://leetcode.com/',
 'Industry-standard coding interview platform with 2000+ problems across easy, medium, and hard',
 1, 5, array['interview', 'coding', 'algorithms']),

('interview_technical', 'NeetCode', 'practice', 'NeetCode 150 Roadmap',
 'https://neetcode.io/',
 'Curated roadmap of 150 LeetCode problems organized by pattern with free video explanations',
 2, 4, array['interview', 'roadmap', 'patterns']),

('interview_technical', 'GitHub', 'repo', 'Tech Interview Handbook',
 'https://github.com/yangshun/tech-interview-handbook',
 'Open-source guide with algorithm cheat sheets, Blind 75 question list, and study plans',
 1, 4, array['interview', 'handbook', 'study-plan']),

('interview_technical', 'GitHub', 'repo', 'System Design Primer',
 'https://github.com/donnemartin/system-design-primer',
 'Definitive system design resource covering scalability, caching, databases, and real design problems',
 3, 5, array['interview', 'system-design', 'architecture']),

('interview_technical', 'HackerRank', 'practice', 'HackerRank Interview Prep Kit',
 'https://www.hackerrank.com/interview/interview-preparation-kit',
 'Curated set of coding challenges organized by topic for interview preparation',
 1, 3, array['interview', 'practice', 'beginner']),

('interview_technical', 'LeetCode', 'practice', 'LeetCode Mock Interviews',
 'https://leetcode.com/interview/',
 'Timed mock interview simulations with company-specific problem sets and performance scoring',
 2, 5, array['interview', 'mock', 'timed']),

-- ---------------------------------------------------------------------------
-- Interview Prep — Behavioral
-- ---------------------------------------------------------------------------
('interview_behavioral', 'Tech Interview Handbook', 'docs', 'Behavioral Interview Guide',
 'https://www.techinterviewhandbook.org/behavioral-interview/',
 'Common behavioral questions at FAANG companies with STAR answer frameworks for technical roles',
 1, 4, array['interview', 'behavioral', 'STAR']),

('interview_behavioral', 'Indeed', 'docs', 'Common Behavioral Interview Questions',
 'https://www.indeed.com/career-advice/interviewing/most-common-behavioral-interview-questions-and-answers',
 'Practical guide with 20+ common behavioral questions and sample answers for teamwork and leadership',
 1, 3, array['interview', 'behavioral', 'questions']),

-- ---------------------------------------------------------------------------
-- Data Visualization
-- ---------------------------------------------------------------------------
('data_viz', 'Matplotlib', 'docs', 'Matplotlib Official Tutorials',
 'https://matplotlib.org/stable/tutorials/index.html',
 'Official tutorial gallery from pyplot basics through advanced customization and annotations',
 1, 3, array['visualization', 'matplotlib', 'python']),

('data_viz', 'Seaborn', 'docs', 'Seaborn Official Tutorial',
 'https://seaborn.pydata.org/tutorial.html',
 'Official guide covering relational, distributional, and categorical plots with styling and multi-plot grids',
 1, 3, array['visualization', 'seaborn', 'python']),

('data_viz', 'Storytelling with Data', 'research', 'Storytelling with Data Blog',
 'https://www.storytellingwithdata.com/blog',
 'Blog on data communication covering chart decluttering, effective visuals, and before/after makeovers',
 2, 4, array['visualization', 'design', 'communication']),

('data_viz', 'Python Graph Gallery', 'practice', 'Python Graph Gallery',
 'https://www.python-graph-gallery.com/',
 'Hundreds of chart examples with copy-paste Python code organized by chart type — a reference cookbook',
 2, 4, array['visualization', 'python', 'examples']),

('data_viz', 'Plotly', 'docs', 'Plotly Python Documentation',
 'https://plotly.com/python/',
 'Interactive chart tutorials covering statistical, scientific, financial, and geographic visualizations',
 2, 4, array['visualization', 'plotly', 'interactive']),

('data_viz', 'D3.js', 'docs', 'D3.js Getting Started',
 'https://d3js.org/getting-started',
 'Official D3.js guide for building custom interactive web-based data visualizations with SVG and Canvas',
 3, 5, array['visualization', 'd3', 'javascript']),

-- ---------------------------------------------------------------------------
-- General Coding
-- ---------------------------------------------------------------------------
('general_coding', 'GitHub', 'repo', 'Coding Interview University',
 'https://github.com/jwasham/coding-interview-university',
 'Multi-month self-study plan covering CS fundamentals: data structures, algorithms, and system design',
 1, 4, array['cs-fundamentals', 'study-plan', 'self-paced']);
