-- Day offs for tracking member leave days
CREATE TABLE IF NOT EXISTS day_offs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  date DATE NOT NULL,
  reason TEXT,
  is_half_day BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_email, date)
);

-- Enable RLS
ALTER TABLE day_offs ENABLE ROW LEVEL SECURITY;

-- Policy: users can see all day_offs (for team visibility)
CREATE POLICY "day_offs_select" ON day_offs FOR SELECT USING (true);

-- Policy: users can insert their own day_offs
CREATE POLICY "day_offs_insert" ON day_offs FOR INSERT WITH CHECK (
  auth.jwt() ->> 'email' = user_email
);

-- Policy: users can delete their own day_offs  
CREATE POLICY "day_offs_delete" ON day_offs FOR DELETE USING (
  auth.jwt() ->> 'email' = user_email
);

-- Duedate history for tracking changes from Asana
CREATE TABLE IF NOT EXISTS duedate_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_gid TEXT NOT NULL,
  task_name TEXT,
  old_duedate DATE,
  new_duedate DATE,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by TEXT
);

-- Enable RLS
ALTER TABLE duedate_history ENABLE ROW LEVEL SECURITY;

-- Policy: all authenticated users can read
CREATE POLICY "duedate_history_select" ON duedate_history FOR SELECT USING (true);

-- Policy: only service role can insert (from backend sync)
CREATE POLICY "duedate_history_insert" ON duedate_history FOR INSERT WITH CHECK (true);
