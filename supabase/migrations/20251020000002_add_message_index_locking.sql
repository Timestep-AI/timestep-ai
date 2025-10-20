-- Simple function to get the next message index for a thread
-- Uses advisory locks to prevent concurrent access

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
