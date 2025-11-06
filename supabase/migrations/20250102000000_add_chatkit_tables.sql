-- Create ChatKit-specific tables
-- These are separate from the OpenAI Assistants API threads/messages tables

-- Create the chatkit_threads table
CREATE TABLE IF NOT EXISTS chatkit_threads (
    id TEXT PRIMARY KEY,
    object TEXT DEFAULT 'chatkit.thread' NOT NULL,
    created_at INTEGER NOT NULL, -- Unix timestamp in seconds
    title TEXT, -- Optional human-readable title (null until generated)
    status JSONB DEFAULT '{"type": "active"}'::jsonb NOT NULL, -- {type: "active"} or {type: "locked", reason: "..."}
    user_id UUID NOT NULL, -- Free-form string identifying the end user
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add RLS for chatkit_threads table
ALTER TABLE chatkit_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chatkit threads" ON chatkit_threads
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can create their own chatkit threads" ON chatkit_threads
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can update their own chatkit threads" ON chatkit_threads
    FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can delete their own chatkit threads" ON chatkit_threads
    FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'anon');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chatkit_threads_user_id ON chatkit_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chatkit_threads_created_at ON chatkit_threads(created_at DESC);

-- Create the chatkit_thread_items table
-- This stores all thread items: user_message, assistant_message, client_tool_call, widget_message, task, task_group
CREATE TABLE IF NOT EXISTS chatkit_thread_items (
    id TEXT PRIMARY KEY,
    object TEXT DEFAULT 'chatkit.thread_item' NOT NULL,
    thread_id TEXT NOT NULL REFERENCES chatkit_threads(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL, -- Unix timestamp in seconds
    type TEXT NOT NULL, -- 'chatkit.user_message', 'chatkit.assistant_message', 'chatkit.client_tool_call', etc.

    -- Item data stored as JSONB for flexibility
    -- Structure varies by type but always includes the discriminated union fields
    data JSONB NOT NULL,

    -- Denormalized fields for querying and ordering
    item_index INTEGER NOT NULL, -- Sequential order within thread

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    UNIQUE (thread_id, item_index) -- Ensure order within a thread
);

-- Add RLS for chatkit_thread_items table
ALTER TABLE chatkit_thread_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chatkit thread items" ON chatkit_thread_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chatkit_threads
            WHERE chatkit_threads.id = chatkit_thread_items.thread_id
            AND (chatkit_threads.user_id = auth.uid() OR auth.role() = 'anon')
        )
    );

CREATE POLICY "Users can create chatkit thread items" ON chatkit_thread_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chatkit_threads
            WHERE chatkit_threads.id = chatkit_thread_items.thread_id
            AND (chatkit_threads.user_id = auth.uid() OR auth.role() = 'anon')
        )
    );

CREATE POLICY "Users can update chatkit thread items" ON chatkit_thread_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM chatkit_threads
            WHERE chatkit_threads.id = chatkit_thread_items.thread_id
            AND (chatkit_threads.user_id = auth.uid() OR auth.role() = 'anon')
        )
    );

CREATE POLICY "Users can delete chatkit thread items" ON chatkit_thread_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM chatkit_threads
            WHERE chatkit_threads.id = chatkit_thread_items.thread_id
            AND (chatkit_threads.user_id = auth.uid() OR auth.role() = 'anon')
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chatkit_thread_items_thread_id ON chatkit_thread_items(thread_id);
CREATE INDEX IF NOT EXISTS idx_chatkit_thread_items_created_at ON chatkit_thread_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatkit_thread_items_type ON chatkit_thread_items(type);
CREATE INDEX IF NOT EXISTS idx_chatkit_thread_items_item_index ON chatkit_thread_items(thread_id, item_index);

-- Function to get the next item index for a chatkit thread with advisory locking
CREATE OR REPLACE FUNCTION get_next_chatkit_item_index(p_thread_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key BIGINT;
  v_next_index INTEGER;
BEGIN
  -- Generate a consistent lock key from thread_id using hashtext
  v_lock_key := abs(hashtext('chatkit_' || p_thread_id));

  -- Acquire session-level advisory lock
  PERFORM pg_advisory_lock(v_lock_key);

  -- Get the next item index while holding the lock
  SELECT COALESCE(MAX(item_index) + 1, 0)
  INTO v_next_index
  FROM chatkit_thread_items
  WHERE thread_id = p_thread_id;

  -- Release the lock
  PERFORM pg_advisory_unlock(v_lock_key);

  RETURN v_next_index;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_chatkit_item_index(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_chatkit_item_index(TEXT) TO anon;
