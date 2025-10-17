-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create mcp_servers table for storing MCP server configurations
CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  auth_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient user_id lookups
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_mcp_servers_updated_at BEFORE UPDATE ON mcp_servers
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add RLS (Row Level Security) policies for mcp_servers
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

-- Users can only read their own MCP servers
CREATE POLICY "Users can read own mcp_servers" ON mcp_servers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own MCP servers
CREATE POLICY "Users can insert own mcp_servers" ON mcp_servers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own MCP servers
CREATE POLICY "Users can update own mcp_servers" ON mcp_servers
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own MCP servers
CREATE POLICY "Users can delete own mcp_servers" ON mcp_servers
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role has full access to mcp_servers" ON mcp_servers
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create agents table for storing agent configurations
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Personal Assistant',
  instructions TEXT NOT NULL DEFAULT 'You are a helpful AI assistant that can answer questions and use tools to help users. When asked about weather, you MUST use the get_weather tool to get accurate, real-time weather information. Always use the available tools when they are relevant to the user''s question.',
  tool_ids TEXT[] NOT NULL DEFAULT '{}',
  handoff_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient user_id lookups
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add RLS (Row Level Security) policies for agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Users can only read their own agents
CREATE POLICY "Users can read own agents" ON agents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own agents
CREATE POLICY "Users can insert own agents" ON agents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own agents
CREATE POLICY "Users can update own agents" ON agents
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own agents
CREATE POLICY "Users can delete own agents" ON agents
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role has full access to agents" ON agents
  FOR ALL
  USING (auth.role() = 'service_role');

