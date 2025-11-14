-- Create thread_conversations table to map chatkit threads to OpenAI conversation IDs
-- This table provides a persistent mapping between our thread IDs and OpenAI's conversation IDs

CREATE TABLE IF NOT EXISTS thread_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL UNIQUE,
  conversation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient lookups by thread_id
CREATE INDEX IF NOT EXISTS idx_thread_conversations_thread_id ON thread_conversations(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_conversations_conversation_id ON thread_conversations(conversation_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_thread_conversations_updated_at BEFORE UPDATE ON thread_conversations
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE thread_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for thread_conversations
-- Allow authenticated and anon users full access (thread_id provides isolation)
CREATE POLICY "Users can read thread conversations" ON thread_conversations
  FOR SELECT
  USING (auth.role() IN ('authenticated', 'anon'));

CREATE POLICY "Users can insert thread conversations" ON thread_conversations
  FOR INSERT
  WITH CHECK (auth.role() IN ('authenticated', 'anon'));

CREATE POLICY "Users can update thread conversations" ON thread_conversations
  FOR UPDATE
  USING (auth.role() IN ('authenticated', 'anon'));

CREATE POLICY "Users can delete thread conversations" ON thread_conversations
  FOR DELETE
  USING (auth.role() IN ('authenticated', 'anon'));

CREATE POLICY "Service role has full access to thread_conversations" ON thread_conversations
  FOR ALL TO service_role
  USING (true);
