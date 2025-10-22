-- Create storage bucket for OpenAI files
-- This bucket is used for storing uploaded files in the OpenAI Files API

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'openai-polyfill-files',
  'openai-polyfill-files',
  false, -- Private bucket
  52428800, -- 50MB file size limit
  ARRAY[
    'text/plain',
    'text/markdown',
    'application/json',
    'application/jsonl',
    'application/x-ndjson',
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/x-python',
    'application/x-python-code',
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'application/typescript'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'openai-polyfill-files');

-- Allow users to view their own files
CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'openai-polyfill-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own files
CREATE POLICY "Users can update their own files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'openai-polyfill-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'openai-polyfill-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow service role full access
CREATE POLICY "Service role has full access to files" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'openai-polyfill-files');
