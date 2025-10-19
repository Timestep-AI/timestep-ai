-- Create responses table to store full response data for trace enrichment
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,  -- response_id like resp_xxx
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT,  -- Optional thread reference
  model TEXT,
  instructions TEXT,
  usage JSONB,  -- Token usage: {input_tokens, output_tokens, total_tokens}
  tools JSONB,  -- Array of tool definitions
  messages JSONB,  -- Input messages
  output JSONB,  -- Response output
  output_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by response_id
CREATE INDEX responses_id_idx ON responses(id);

-- Index for user queries
CREATE INDEX responses_user_id_idx ON responses(user_id);

-- Index for thread queries
CREATE INDEX responses_thread_id_idx ON responses(thread_id);

-- Enable RLS
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own responses"
  ON responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own responses"
  ON responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
  ON responses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own responses"
  ON responses FOR DELETE
  USING (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role has full access to responses"
  ON responses FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
