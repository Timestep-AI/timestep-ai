-- Create uploads table for OpenAI Uploads API (multipart uploads)
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY, -- Upload ID (e.g., upload-abc123)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  bytes INTEGER NOT NULL, -- Total expected bytes
  bytes_uploaded INTEGER NOT NULL DEFAULT 0, -- Bytes uploaded so far
  purpose TEXT NOT NULL CHECK (purpose IN (
    'assistants',
    'batch',
    'fine-tune',
    'vision'
  )),
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),

  created_at INTEGER NOT NULL, -- Unix timestamp
  expires_at INTEGER NOT NULL, -- Unix timestamp

  part_ids TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of part IDs in upload order
  file_id TEXT, -- References files(id) when completed

  created_at_ts TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create files table for OpenAI Files API
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY, -- File ID (e.g., file-abc123)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN (
    'assistants',
    'assistants_output',
    'batch',
    'batch_output',
    'fine-tune',
    'fine-tune-results',
    'vision',
    'user_data'
  )),
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processed', 'error')),
  status_details TEXT,
  created_at INTEGER NOT NULL, -- Unix timestamp
  expires_at INTEGER, -- Unix timestamp (optional)
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',

  created_at_ts TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create vector_stores table for OpenAI Vector Stores API
CREATE TABLE IF NOT EXISTS vector_stores (
  id TEXT PRIMARY KEY, -- Vector store ID (e.g., vs-abc123)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  usage_bytes INTEGER NOT NULL DEFAULT 0,

  -- File counts
  files_in_progress INTEGER NOT NULL DEFAULT 0,
  files_completed INTEGER NOT NULL DEFAULT 0,
  files_failed INTEGER NOT NULL DEFAULT 0,
  files_cancelled INTEGER NOT NULL DEFAULT 0,
  files_total INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('expired', 'in_progress', 'completed')),

  -- Expiration settings
  expires_after_anchor TEXT CHECK (expires_after_anchor IN ('last_active_at')),
  expires_after_days INTEGER,
  expires_at INTEGER, -- Unix timestamp

  last_active_at INTEGER, -- Unix timestamp
  created_at INTEGER NOT NULL, -- Unix timestamp

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at_ts TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create vector_store_files junction table
CREATE TABLE IF NOT EXISTS vector_store_files (
  id TEXT PRIMARY KEY, -- Vector store file ID (e.g., file-vs-abc123)
  vector_store_id TEXT NOT NULL REFERENCES vector_stores(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),
  usage_bytes INTEGER NOT NULL DEFAULT 0,

  -- Chunking strategy
  chunking_strategy_type TEXT,
  chunking_strategy JSONB DEFAULT '{}'::jsonb,

  created_at INTEGER NOT NULL, -- Unix timestamp
  last_error TEXT,

  created_at_ts TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(vector_store_id, file_id)
);

-- Create indexes for uploads table
CREATE INDEX IF NOT EXISTS uploads_user_id_idx ON uploads(user_id);
CREATE INDEX IF NOT EXISTS uploads_status_idx ON uploads(status);
CREATE INDEX IF NOT EXISTS uploads_created_at_idx ON uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS uploads_expires_at_idx ON uploads(expires_at);

-- Create indexes for files table
CREATE INDEX IF NOT EXISTS files_user_id_idx ON files(user_id);
CREATE INDEX IF NOT EXISTS files_purpose_idx ON files(purpose);
CREATE INDEX IF NOT EXISTS files_created_at_idx ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS files_status_idx ON files(status);
CREATE INDEX IF NOT EXISTS files_expires_at_idx ON files(expires_at);

-- Create indexes for vector_stores table
CREATE INDEX IF NOT EXISTS vector_stores_user_id_idx ON vector_stores(user_id);
CREATE INDEX IF NOT EXISTS vector_stores_created_at_idx ON vector_stores(created_at DESC);
CREATE INDEX IF NOT EXISTS vector_stores_status_idx ON vector_stores(status);
CREATE INDEX IF NOT EXISTS vector_stores_last_active_at_idx ON vector_stores(last_active_at DESC);

-- Create GIN index for JSONB columns
CREATE INDEX IF NOT EXISTS vector_stores_metadata_idx ON vector_stores USING GIN (metadata);

-- Create indexes for vector_store_files table
CREATE INDEX IF NOT EXISTS vector_store_files_vector_store_id_idx ON vector_store_files(vector_store_id);
CREATE INDEX IF NOT EXISTS vector_store_files_file_id_idx ON vector_store_files(file_id);
CREATE INDEX IF NOT EXISTS vector_store_files_user_id_idx ON vector_store_files(user_id);
CREATE INDEX IF NOT EXISTS vector_store_files_status_idx ON vector_store_files(status);

-- Enable Row Level Security (RLS)
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_store_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for uploads
CREATE POLICY "Users can view their own uploads"
  ON uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own uploads"
  ON uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads"
  ON uploads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads"
  ON uploads FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for files
CREATE POLICY "Users can view their own files"
  ON files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
  ON files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files"
  ON files FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
  ON files FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for vector_stores
CREATE POLICY "Users can view their own vector stores"
  ON vector_stores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vector stores"
  ON vector_stores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vector stores"
  ON vector_stores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vector stores"
  ON vector_stores FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for vector_store_files
CREATE POLICY "Users can view their own vector store files"
  ON vector_store_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vector store files"
  ON vector_store_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vector store files"
  ON vector_store_files FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vector store files"
  ON vector_store_files FOR DELETE
  USING (auth.uid() = user_id);

-- Create functions to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_vector_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_vector_store_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER uploads_updated_at_trigger
  BEFORE UPDATE ON uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_uploads_updated_at();

CREATE TRIGGER files_updated_at_trigger
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_files_updated_at();

CREATE TRIGGER vector_stores_updated_at_trigger
  BEFORE UPDATE ON vector_stores
  FOR EACH ROW
  EXECUTE FUNCTION update_vector_stores_updated_at();

CREATE TRIGGER vector_store_files_updated_at_trigger
  BEFORE UPDATE ON vector_store_files
  FOR EACH ROW
  EXECUTE FUNCTION update_vector_store_files_updated_at();

-- Create function to update vector store file counts when files are added/removed
CREATE OR REPLACE FUNCTION update_vector_store_file_counts()
RETURNS TRIGGER AS $$
DECLARE
  vs_id TEXT;
BEGIN
  -- Get the vector_store_id from either NEW or OLD
  IF TG_OP = 'DELETE' THEN
    vs_id := OLD.vector_store_id;
  ELSE
    vs_id := NEW.vector_store_id;
  END IF;

  -- Update the file counts in vector_stores
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
$$ LANGUAGE plpgsql;

-- Create trigger to update vector store file counts
CREATE TRIGGER vector_store_file_counts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON vector_store_files
  FOR EACH ROW
  EXECUTE FUNCTION update_vector_store_file_counts();
