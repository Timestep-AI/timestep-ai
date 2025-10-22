-- Add pgvector extension for vector embeddings
-- This enables vector similarity search functionality

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column to threads table for embedding search
ALTER TABLE threads ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Add vector column to files table for embedding search
ALTER TABLE files ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Add vector column to vector_store_files table for embedding search
ALTER TABLE vector_store_files ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Create index for vector similarity search on threads
CREATE INDEX IF NOT EXISTS threads_embedding_idx ON threads USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for vector similarity search on files
CREATE INDEX IF NOT EXISTS files_embedding_idx ON files USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for vector similarity search on vector_store_files
CREATE INDEX IF NOT EXISTS vector_store_files_embedding_idx ON vector_store_files USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add function to search threads by embedding similarity
CREATE OR REPLACE FUNCTION search_threads_by_embedding(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id text,
  user_id uuid,
  created_at integer,
  metadata jsonb,
  object text,
  updated_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
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
    AND (auth.uid() = threads.user_id OR auth.role() = 'anon')
  ORDER BY threads.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Add function to search files by embedding similarity
CREATE OR REPLACE FUNCTION search_files_by_embedding(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id text,
  user_id uuid,
  filename text,
  bytes integer,
  purpose text,
  status text,
  created_at integer,
  similarity float
)
LANGUAGE sql STABLE
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
