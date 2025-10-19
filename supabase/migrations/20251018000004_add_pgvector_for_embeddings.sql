-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to files table
-- Using 1536 dimensions for text-embedding-ada-002 and text-embedding-3-small
ALTER TABLE files
ADD COLUMN embedding vector(1536);

-- Create index for fast similarity search
CREATE INDEX IF NOT EXISTS files_embedding_idx ON files
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add embedding column to vector_store_files for faster lookups
ALTER TABLE vector_store_files
ADD COLUMN embedding vector(1536);

-- Create index for fast similarity search within vector stores
CREATE INDEX IF NOT EXISTS vector_store_files_embedding_idx ON vector_store_files
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add helper function to compute cosine similarity
CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector)
RETURNS float
AS $$
  SELECT 1 - (a <=> b);
$$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

-- Add comment explaining the architecture
COMMENT ON COLUMN files.embedding IS 'Vector embedding of file content for semantic search (1536 dimensions)';
COMMENT ON COLUMN vector_store_files.embedding IS 'Cached embedding from files table for faster vector store search';
