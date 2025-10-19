-- Fix embedding dimensions to match sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
-- This model produces 384-dimensional embeddings, not 1536

-- Drop existing indexes first
DROP INDEX IF EXISTS files_embedding_idx;
DROP INDEX IF EXISTS vector_store_files_embedding_idx;

-- Update files table embedding column to 384 dimensions
ALTER TABLE files
ALTER COLUMN embedding TYPE vector(384);

-- Update vector_store_files table embedding column to 384 dimensions  
ALTER TABLE vector_store_files
ALTER COLUMN embedding TYPE vector(384);

-- Recreate indexes with correct dimensions
CREATE INDEX IF NOT EXISTS files_embedding_idx ON files
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS vector_store_files_embedding_idx ON vector_store_files
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Update the search function to use 384 dimensions
CREATE OR REPLACE FUNCTION search_files_by_embedding(
  query_embedding vector(384),
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

-- Update comments to reflect correct dimensions
COMMENT ON COLUMN files.embedding IS 'Vector embedding of file content for semantic search (384 dimensions from sentence-transformers/all-MiniLM-L6-v2)';
COMMENT ON COLUMN vector_store_files.embedding IS 'Cached embedding from files table for faster vector store search (384 dimensions)';
COMMENT ON FUNCTION search_files_by_embedding IS 'Searches files by semantic similarity using pgvector cosine distance with 384-dimensional embeddings. Returns files ordered by similarity score (higher is better).';
