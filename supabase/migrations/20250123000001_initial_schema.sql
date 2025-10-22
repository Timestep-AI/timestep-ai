-- Initial consolidated schema for Timestep AI
-- This migration creates all the core tables needed for the application

-- Create utility function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create profiles table for user profile information
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Create function to update updated_at timestamp for profiles
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profiles_updated_at();

-- Enable Row Level Security for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Service role has full access to profiles"
  ON profiles
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON profiles
  FOR DELETE
  USING (auth.uid() = id);

-- Create mcp_servers table with composite primary key (id, user_id)
CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  auth_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- Create index for efficient user_id lookups
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_mcp_servers_updated_at BEFORE UPDATE ON mcp_servers
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add RLS (Row Level Security) policies for mcp_servers
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

-- RLS policies for mcp_servers
CREATE POLICY "Users can read own mcp_servers" ON mcp_servers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mcp_servers" ON mcp_servers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mcp_servers" ON mcp_servers
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mcp_servers" ON mcp_servers
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to mcp_servers" ON mcp_servers
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create agents table with composite primary key (id, user_id)
CREATE TABLE IF NOT EXISTS agents (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  instructions TEXT NOT NULL,
  tool_ids TEXT[] NOT NULL DEFAULT '{}',
  handoff_ids UUID[] NOT NULL DEFAULT '{}',
  model TEXT,
  model_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- Create index for efficient user_id lookups
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add RLS (Row Level Security) policies for agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- RLS policies for agents
CREATE POLICY "Users can read own agents" ON agents
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agents" ON agents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents" ON agents
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents" ON agents
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to agents" ON agents
  FOR ALL
  USING (auth.role() = 'service_role');
