-- Create threads and messages tables for chat functionality

-- Create the threads table
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    created_at INTEGER NOT NULL, -- Unix timestamp
    metadata JSONB DEFAULT '{}'::jsonb,
    object TEXT DEFAULT 'thread' NOT NULL,
    vector_store_id TEXT, -- Optional vector store ID for file attachments
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add RLS for threads table
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own threads" ON threads
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can create their own threads" ON threads
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can update their own threads" ON threads
    FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can delete their own threads" ON threads
    FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'anon');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_vector_store_id ON threads(vector_store_id);

-- Create the thread_messages table
CREATE TABLE IF NOT EXISTS thread_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    message_index INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'user', 'assistant', or 'tool'
    content TEXT, -- Text content (for user messages, assistant text, or tool results)
    name TEXT, -- Optional name/identifier
    tool_calls JSONB, -- Tool calls made by assistant (stored as JSON)
    tool_call_id TEXT, -- For tool messages, the ID of the tool call this responds to
    file_id TEXT, -- Optional file attachment ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE (thread_id, message_index) -- Ensure order within a thread
);

-- Add RLS for thread_messages table
ALTER TABLE thread_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own thread messages" ON thread_messages
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can create their own thread messages" ON thread_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can update their own thread messages" ON thread_messages
    FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can delete their own thread messages" ON thread_messages
    FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'anon');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id ON thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_user_id ON thread_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_tool_call_id ON thread_messages(tool_call_id);

-- Function to get the next message index for a thread with advisory locking
CREATE OR REPLACE FUNCTION get_next_message_index(p_thread_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key BIGINT;
  v_next_index INTEGER;
BEGIN
  -- Generate a consistent lock key from thread_id using hashtext
  v_lock_key := abs(hashtext(p_thread_id));

  -- Acquire session-level advisory lock (automatically released when connection closes)
  -- This blocks until the lock is available
  PERFORM pg_advisory_lock(v_lock_key);

  -- Get the next message index while holding the lock
  SELECT COALESCE(MAX(message_index) + 1, 0)
  INTO v_next_index
  FROM thread_messages
  WHERE thread_id = p_thread_id;

  -- Release the lock immediately after getting the index
  PERFORM pg_advisory_unlock(v_lock_key);

  RETURN v_next_index;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_next_message_index(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_message_index(TEXT) TO anon;

-- Create the thread_run_states table
CREATE TABLE IF NOT EXISTS thread_run_states (
    thread_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    state_data TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    PRIMARY KEY (thread_id, user_id) -- Composite primary key
);

-- Add RLS for thread_run_states table
ALTER TABLE thread_run_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own thread run states" ON thread_run_states
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can create their own thread run states" ON thread_run_states
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can update their own thread run states" ON thread_run_states
    FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can delete their own thread run states" ON thread_run_states
    FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'anon');

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_thread_run_states_user_id ON thread_run_states(user_id);

-- Add foreign key constraint for vector_store_id (will be added after vector_stores table is created)
-- This will be handled in the files_and_vector_stores migration
