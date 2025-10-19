-- Create storage bucket for OpenAI files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'openai-files',
  'openai-files',
  false, -- Not public, requires authentication
  52428800, -- 50MB limit per file
  NULL -- Allow all MIME types
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (if not already enabled)
-- Note: In production this may already be enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create RLS policies for the openai-files bucket

-- Policy: Users can view their own files
CREATE POLICY "Users can view their own files in openai-files bucket"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'openai-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can upload files to their own folder
CREATE POLICY "Users can upload files to their own folder in openai-files bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'openai-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update their own files
CREATE POLICY "Users can update their own files in openai-files bucket"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'openai-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'openai-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own files in openai-files bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'openai-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
