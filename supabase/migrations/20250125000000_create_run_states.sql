-- Create run_states table for persisting agent run states (human-in-the-loop)
-- This table stores serialized run states when tool calls require approval

CREATE TABLE IF NOT EXISTS run_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  state_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient lookups by thread_id
CREATE INDEX IF NOT EXISTS idx_run_states_thread_id ON run_states(thread_id);
CREATE INDEX IF NOT EXISTS idx_run_states_user_id ON run_states(user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_run_states_updated_at BEFORE UPDATE ON run_states
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE run_states ENABLE ROW LEVEL SECURITY;

-- RLS policies for run_states
CREATE POLICY "Users can read own run states" ON run_states
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own run states" ON run_states
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own run states" ON run_states
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own run states" ON run_states
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to run_states" ON run_states
  FOR ALL TO service_role
  USING (true);

