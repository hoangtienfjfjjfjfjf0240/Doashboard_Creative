-- Add CTST (Creative Tool) column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ctst TEXT;

-- Create index for CTST queries
CREATE INDEX IF NOT EXISTS idx_tasks_ctst ON tasks(ctst);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_ctst ON tasks(assignee_name, ctst);
