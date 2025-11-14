-- Fix RLS policies to properly scope anonymous users to their own data only
-- Remove the blanket "auth.role() = 'anon'" conditions that allow all anonymous users
-- to see all data, and rely solely on auth.uid() = user_id which works for both
-- authenticated and anonymous users (anonymous users get a UUID from Supabase)

-- Note: threads, thread_messages, and thread_run_states tables were removed in
-- migration 20250124000001_remove_threads_tables.sql, so those policy updates
-- and the search_threads_by_embedding function are skipped here.

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

-- Note: get_next_message_index function was dropped in migration 20250124000001_remove_threads_tables.sql
-- because it referenced the thread_messages table which no longer exists.

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