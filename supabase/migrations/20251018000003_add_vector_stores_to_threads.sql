-- Add vector_store_id to threads table
-- Each thread gets its own vector store for semantic search
ALTER TABLE threads
ADD COLUMN vector_store_id TEXT REFERENCES vector_stores(id) ON DELETE SET NULL;

-- Add file_id to thread_messages table
-- Each message is also stored as a file for vector store indexing
ALTER TABLE thread_messages
ADD COLUMN file_id TEXT REFERENCES files(id) ON DELETE SET NULL;

-- Create index for vector_store_id lookups
CREATE INDEX IF NOT EXISTS idx_threads_vector_store_id ON threads(vector_store_id);

-- Create index for file_id lookups
CREATE INDEX IF NOT EXISTS idx_thread_messages_file_id ON thread_messages(file_id);

-- Add comment explaining the architecture
COMMENT ON COLUMN threads.vector_store_id IS 'Vector store for semantic search across thread messages';
COMMENT ON COLUMN thread_messages.file_id IS 'File ID for vector store indexing (messages stored as files)';
