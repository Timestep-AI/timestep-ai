-- Create chatkit_threads table
CREATE TABLE IF NOT EXISTS chatkit_threads (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_chatkit_threads_user_id ON chatkit_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chatkit_threads_created_at ON chatkit_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatkit_threads_user_created ON chatkit_threads(user_id, created_at DESC);

-- Create chatkit_thread_items table
CREATE TABLE IF NOT EXISTS chatkit_thread_items (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chatkit_threads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('user_message', 'assistant_message', 'hidden_context_item', 'client_tool_call', 'widget')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Additional fields for tool calls
  name TEXT,
  call_id TEXT,
  arguments TEXT,
  output TEXT,
  status TEXT,
  widget JSONB
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_chatkit_items_thread_id ON chatkit_thread_items(thread_id);
CREATE INDEX IF NOT EXISTS idx_chatkit_items_created_at ON chatkit_thread_items(thread_id, created_at ASC);

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_chatkit_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chatkit_threads_updated_at
BEFORE UPDATE ON chatkit_threads
FOR EACH ROW
EXECUTE FUNCTION update_chatkit_threads_updated_at();

-- Enable Row Level Security
ALTER TABLE chatkit_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatkit_thread_items ENABLE ROW LEVEL SECURITY;

-- Policies for chatkit_threads
-- Allow service role full access
CREATE POLICY "Service role has full access to chatkit threads" ON chatkit_threads
FOR ALL TO service_role
USING (true);

-- Allow authenticated users to view their own threads
CREATE POLICY "Users can view their own chatkit threads" ON chatkit_threads
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Allow authenticated users to create their own threads
CREATE POLICY "Users can create their own chatkit threads" ON chatkit_threads
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to update their own threads
CREATE POLICY "Users can update their own chatkit threads" ON chatkit_threads
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Allow authenticated users to delete their own threads
CREATE POLICY "Users can delete their own chatkit threads" ON chatkit_threads
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Policies for chatkit_thread_items
-- Allow service role full access
CREATE POLICY "Service role has full access to chatkit items" ON chatkit_thread_items
FOR ALL TO service_role
USING (true);

-- Allow authenticated users to view items from their threads
CREATE POLICY "Users can view items from their chatkit threads" ON chatkit_thread_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chatkit_threads
    WHERE chatkit_threads.id = chatkit_thread_items.thread_id
    AND chatkit_threads.user_id = auth.uid()
  )
);

-- Allow authenticated users to create items in their threads
CREATE POLICY "Users can create items in their chatkit threads" ON chatkit_thread_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chatkit_threads
    WHERE chatkit_threads.id = chatkit_thread_items.thread_id
    AND chatkit_threads.user_id = auth.uid()
  )
);

-- Allow authenticated users to delete items from their threads
CREATE POLICY "Users can delete items from their chatkit threads" ON chatkit_thread_items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chatkit_threads
    WHERE chatkit_threads.id = chatkit_thread_items.thread_id
    AND chatkit_threads.user_id = auth.uid()
  )
);

