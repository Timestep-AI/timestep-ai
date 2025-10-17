-- Create run_states table for storing agent run states
CREATE TABLE IF NOT EXISTS run_states (
  thread_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  state_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_run_states_thread_id ON run_states(thread_id);
CREATE INDEX IF NOT EXISTS idx_run_states_user_id ON run_states(user_id);
CREATE INDEX IF NOT EXISTS idx_run_states_updated_at ON run_states(updated_at);

-- Enable RLS
ALTER TABLE run_states ENABLE ROW LEVEL SECURITY;

-- RLS policies for run_states
CREATE POLICY "Users can view their own run states" ON run_states
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can insert their own run states" ON run_states
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can update their own run states" ON run_states
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can delete their own run states" ON run_states
  FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'anon');
