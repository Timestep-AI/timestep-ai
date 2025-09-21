-- Drop the existing tasks table and recreate it to match the edge function schema
DROP TABLE IF EXISTS public.tasks CASCADE;

-- Create tasks table to match edge function schema exactly
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id TEXT NOT NULL,
  task_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, task_id)
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own tasks" 
ON public.tasks 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);