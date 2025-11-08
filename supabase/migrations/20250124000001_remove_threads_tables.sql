-- Remove threads and thread_messages tables as they're no longer in use
-- These tables have been replaced by chatkit_threads and chatkit_thread_items

-- Drop the function that depends on thread_messages first
DROP FUNCTION IF EXISTS get_next_message_index(TEXT);

-- Drop policies for thread_messages table
DROP POLICY IF EXISTS "Users can view their own thread messages" ON thread_messages;
DROP POLICY IF EXISTS "Users can create their own thread messages" ON thread_messages;
DROP POLICY IF EXISTS "Users can update their own thread messages" ON thread_messages;
DROP POLICY IF EXISTS "Users can delete their own thread messages" ON thread_messages;

-- Drop indexes for thread_messages table
DROP INDEX IF EXISTS idx_thread_messages_thread_id;
DROP INDEX IF EXISTS idx_thread_messages_user_id;
DROP INDEX IF EXISTS idx_thread_messages_tool_call_id;

-- Drop the thread_messages table (it has a foreign key to threads, so drop it first)
DROP TABLE IF EXISTS thread_messages;

-- Drop policies for threads table
DROP POLICY IF EXISTS "Users can view their own threads" ON threads;
DROP POLICY IF EXISTS "Users can create their own threads" ON threads;
DROP POLICY IF EXISTS "Users can update their own threads" ON threads;
DROP POLICY IF EXISTS "Users can delete their own threads" ON threads;

-- Drop indexes for threads table
DROP INDEX IF EXISTS idx_threads_user_id;
DROP INDEX IF EXISTS idx_threads_created_at;
DROP INDEX IF EXISTS idx_threads_vector_store_id;

-- Drop the threads table
DROP TABLE IF EXISTS threads;

-- Also drop thread_run_states table as it's related and no longer in use
DROP POLICY IF EXISTS "Users can view their own thread run states" ON thread_run_states;
DROP POLICY IF EXISTS "Users can create their own thread run states" ON thread_run_states;
DROP POLICY IF EXISTS "Users can update their own thread run states" ON thread_run_states;
DROP POLICY IF EXISTS "Users can delete their own thread run states" ON thread_run_states;

-- Drop index for thread_run_states table
DROP INDEX IF EXISTS idx_thread_run_states_user_id;

-- Drop the thread_run_states table
DROP TABLE IF EXISTS thread_run_states;

