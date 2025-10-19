-- Add RPC function to search files by embedding using pgvector similarity
CREATE OR REPLACE FUNCTION search_files_by_embedding(
  query_embedding vector(1536),
  file_ids text[],
  match_count integer DEFAULT 10,
  score_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id text,
  user_id uuid,
  filename text,
  bytes integer,
  purpose text,
  status text,
  content_type text,
  created_at integer,
  expires_at integer,
  similarity_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.user_id,
    f.filename,
    f.bytes,
    f.purpose,
    f.status,
    f.content_type,
    f.created_at,
    f.expires_at,
    -- Calculate cosine similarity: 1 - cosine_distance
    (1 - (f.embedding <=> query_embedding))::float AS similarity_score
  FROM files f
  WHERE
    f.id = ANY(file_ids)
    AND f.embedding IS NOT NULL
    AND (1 - (f.embedding <=> query_embedding)) >= score_threshold
  ORDER BY f.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION search_files_by_embedding IS 'Searches files by semantic similarity using pgvector cosine distance. Returns files ordered by similarity score (higher is better).';
