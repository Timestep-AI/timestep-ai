-- Create table for storing conversation history in OpenAI message format
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  message_index INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  message_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique messages per thread
  UNIQUE (thread_id, message_index)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(thread_id, message_index);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_conversations_updated_at();

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to conversations"
  ON conversations
  FOR ALL TO service_role
  USING (true);

-- Allow authenticated and anonymous users to read their own conversations
CREATE POLICY "Users can read own conversations"
  ON conversations
  FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to insert their own conversations
CREATE POLICY "Users can insert own conversations"
  ON conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to update their own conversations
CREATE POLICY "Users can update own conversations"
  ON conversations
  FOR UPDATE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to delete their own conversations
CREATE POLICY "Users can delete own conversations"
  ON conversations
  FOR DELETE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

