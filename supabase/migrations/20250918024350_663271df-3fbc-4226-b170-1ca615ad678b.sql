-- Drop the tools table since it's no longer needed
DROP TABLE IF EXISTS tools CASCADE;

-- Update contexts table to add missing columns for task states and tasks
ALTER TABLE contexts 
ADD COLUMN IF NOT EXISTS task_states JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tasks JSONB DEFAULT '[]';