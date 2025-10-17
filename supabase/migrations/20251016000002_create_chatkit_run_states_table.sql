-- Create table for storing agent run states
CREATE TABLE IF NOT EXISTS chatkit_run_states (
  thread_id TEXT PRIMARY KEY,
  state_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chatkit_run_states ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Service role has full access to run states"
  ON chatkit_run_states
  FOR ALL TO service_role
  USING (true);

-- Create policy to allow authenticated users to manage their own run states
CREATE POLICY "Users can manage their own run states"
  ON chatkit_run_states
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatkit_threads
      WHERE chatkit_threads.id = chatkit_run_states.thread_id
      AND chatkit_threads.user_id = auth.uid()
    )
  );

