-- Create or update tables for Timestep integration

-- Create tools table if it doesn't exist
CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  input_schema JSONB,
  function_implementation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on tools table
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tools
DROP POLICY IF EXISTS "Users can manage their own tools" ON tools;
CREATE POLICY "Users can manage their own tools" 
ON tools FOR ALL 
USING (auth.uid() = user_id);

-- Add missing columns to existing agents table for Timestep compatibility
ALTER TABLE agents ADD COLUMN IF NOT EXISTS handoff_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tool_ids JSONB DEFAULT '[]'::jsonb;

-- Add missing columns to existing contexts table for Timestep compatibility  
ALTER TABLE contexts ADD COLUMN IF NOT EXISTS context_id TEXT;
ALTER TABLE contexts ADD COLUMN IF NOT EXISTS task_histories JSONB DEFAULT '{}'::jsonb;

-- Update contexts table to have context_id as unique if not already
CREATE UNIQUE INDEX IF NOT EXISTS idx_contexts_context_id ON contexts(context_id) WHERE context_id IS NOT NULL;

-- Add missing columns to existing traces table for Timestep compatibility
ALTER TABLE traces ADD COLUMN IF NOT EXISTS context_id TEXT;
ALTER TABLE traces ADD COLUMN IF NOT EXISTS trace_data JSONB;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
CREATE INDEX IF NOT EXISTS idx_tools_user_id ON tools(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_handoff_ids ON agents USING GIN(handoff_ids);
CREATE INDEX IF NOT EXISTS idx_agents_tool_ids ON agents USING GIN(tool_ids);
CREATE INDEX IF NOT EXISTS idx_contexts_task_histories ON contexts USING GIN(task_histories);
CREATE INDEX IF NOT EXISTS idx_traces_context_id ON traces(context_id);
CREATE INDEX IF NOT EXISTS idx_traces_trace_data ON traces USING GIN(trace_data);

-- Create trigger to automatically update updated_at timestamp for tools
CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tools_updated_at_trigger ON tools;
CREATE TRIGGER update_tools_updated_at_trigger
  BEFORE UPDATE ON tools
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_updated_at();