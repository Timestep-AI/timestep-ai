-- Create conversations table (replaces chatkit_threads)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  object TEXT DEFAULT 'conversation',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversation_items table (replaces chatkit_thread_items and conversations)
CREATE TABLE IF NOT EXISTS conversation_items (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item_index INTEGER NOT NULL,
  item_type TEXT NOT NULL, -- 'message', 'custom_tool_call', 'custom_tool_call_output', etc.
  role TEXT, -- 'user', 'assistant', 'system', 'tool', etc.
  content JSONB, -- The actual item content
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, item_index)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_items_conversation_id ON conversation_items(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_items_user_id ON conversation_items(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_items_item_index ON conversation_items(conversation_id, item_index);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Users can view their own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can insert their own conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can update their own conversations" ON conversations
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can delete their own conversations" ON conversations
  FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'anon');

-- RLS policies for conversation_items
CREATE POLICY "Users can view their own conversation items" ON conversation_items
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can insert their own conversation items" ON conversation_items
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can update their own conversation items" ON conversation_items
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can delete their own conversation items" ON conversation_items
  FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'anon');
