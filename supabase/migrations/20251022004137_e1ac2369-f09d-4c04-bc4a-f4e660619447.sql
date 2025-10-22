-- Fix RLS policies to properly scope anonymous users to their own data only
-- Remove the blanket "auth.role() = 'anon'" conditions that allow all anonymous users
-- to see all data, and rely solely on auth.uid() = user_id which works for both
-- authenticated and anonymous users (anonymous users get a UUID from Supabase)

-- Update threads table policies
DROP POLICY IF EXISTS "Users can view their own threads" ON public.threads;
CREATE POLICY "Users can view their own threads"
  ON public.threads
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own threads" ON public.threads;
CREATE POLICY "Users can create their own threads"
  ON public.threads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own threads" ON public.threads;
CREATE POLICY "Users can update their own threads"
  ON public.threads
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own threads" ON public.threads;
CREATE POLICY "Users can delete their own threads"
  ON public.threads
  FOR DELETE
  USING (auth.uid() = user_id);

-- Update thread_messages table policies
DROP POLICY IF EXISTS "Users can view their own thread messages" ON public.thread_messages;
CREATE POLICY "Users can view their own thread messages"
  ON public.thread_messages
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own thread messages" ON public.thread_messages;
CREATE POLICY "Users can create their own thread messages"
  ON public.thread_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own thread messages" ON public.thread_messages;
CREATE POLICY "Users can update their own thread messages"
  ON public.thread_messages
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own thread messages" ON public.thread_messages;
CREATE POLICY "Users can delete their own thread messages"
  ON public.thread_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Update thread_run_states table policies
DROP POLICY IF EXISTS "Users can view their own thread run states" ON public.thread_run_states;
CREATE POLICY "Users can view their own thread run states"
  ON public.thread_run_states
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own thread run states" ON public.thread_run_states;
CREATE POLICY "Users can create their own thread run states"
  ON public.thread_run_states
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own thread run states" ON public.thread_run_states;
CREATE POLICY "Users can update their own thread run states"
  ON public.thread_run_states
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own thread run states" ON public.thread_run_states;
CREATE POLICY "Users can delete their own thread run states"
  ON public.thread_run_states
  FOR DELETE
  USING (auth.uid() = user_id);

-- Fix search_threads_by_embedding function to remove anonymous access
CREATE OR REPLACE FUNCTION public.search_threads_by_embedding(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 10
)
RETURNS TABLE(
  id text,
  user_id uuid,
  created_at integer,
  metadata jsonb,
  object text,
  updated_at timestamp with time zone,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    threads.id,
    threads.user_id,
    threads.created_at,
    threads.metadata,
    threads.object,
    threads.updated_at,
    1 - (threads.embedding <=> query_embedding) AS similarity
  FROM threads
  WHERE threads.embedding IS NOT NULL
    AND 1 - (threads.embedding <=> query_embedding) > match_threshold
    AND auth.uid() = threads.user_id
  ORDER BY threads.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Add search_path to search_files_by_embedding function
CREATE OR REPLACE FUNCTION public.search_files_by_embedding(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 10
)
RETURNS TABLE(
  id text,
  user_id uuid,
  filename text,
  bytes integer,
  purpose text,
  status text,
  created_at integer,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    files.id,
    files.user_id,
    files.filename,
    files.bytes,
    files.purpose,
    files.status,
    files.created_at,
    1 - (files.embedding <=> query_embedding) AS similarity
  FROM files
  WHERE files.embedding IS NOT NULL
    AND 1 - (files.embedding <=> query_embedding) > match_threshold
    AND auth.uid() = files.user_id
  ORDER BY files.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Add search_path to get_next_message_index function
CREATE OR REPLACE FUNCTION public.get_next_message_index(p_thread_id text)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lock_key BIGINT;
  v_next_index INTEGER;
BEGIN
  -- Generate a consistent lock key from thread_id using hashtext
  v_lock_key := abs(hashtext(p_thread_id));

  -- Acquire session-level advisory lock
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

-- Add search_path to update triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_uploads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_files_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_vector_stores_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_vector_store_files_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_vector_store_file_counts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  vs_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    vs_id := OLD.vector_store_id;
  ELSE
    vs_id := NEW.vector_store_id;
  END IF;

  UPDATE vector_stores
  SET
    files_in_progress = (
      SELECT COUNT(*) FROM vector_store_files
      WHERE vector_store_id = vs_id AND status = 'in_progress'
    ),
    files_completed = (
      SELECT COUNT(*) FROM vector_store_files
      WHERE vector_store_id = vs_id AND status = 'completed'
    ),
    files_failed = (
      SELECT COUNT(*) FROM vector_store_files
      WHERE vector_store_id = vs_id AND status = 'failed'
    ),
    files_cancelled = (
      SELECT COUNT(*) FROM vector_store_files
      WHERE vector_store_id = vs_id AND status = 'cancelled'
    ),
    files_total = (
      SELECT COUNT(*) FROM vector_store_files
      WHERE vector_store_id = vs_id
    ),
    usage_bytes = (
      SELECT COALESCE(SUM(usage_bytes), 0) FROM vector_store_files
      WHERE vector_store_id = vs_id
    ),
    last_active_at = EXTRACT(EPOCH FROM timezone('utc'::text, now()))::INTEGER
  WHERE id = vs_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;