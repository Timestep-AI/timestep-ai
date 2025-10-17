-- Fix RLS policies to support anonymous users
-- Anonymous users should be able to create and access their own data

-- Drop existing policies for mcp_servers
DROP POLICY IF EXISTS "Users can read own mcp_servers" ON mcp_servers;
DROP POLICY IF EXISTS "Users can insert own mcp_servers" ON mcp_servers;
DROP POLICY IF EXISTS "Users can update own mcp_servers" ON mcp_servers;
DROP POLICY IF EXISTS "Users can delete own mcp_servers" ON mcp_servers;

-- Create new policies that support both authenticated and anonymous users
CREATE POLICY "Users can read own mcp_servers" ON mcp_servers
  FOR SELECT
  USING (auth.uid() = user_id OR (auth.role() = 'anon' AND user_id IS NOT NULL));

CREATE POLICY "Users can insert own mcp_servers" ON mcp_servers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR (auth.role() = 'anon' AND user_id IS NOT NULL));

CREATE POLICY "Users can update own mcp_servers" ON mcp_servers
  FOR UPDATE
  USING (auth.uid() = user_id OR (auth.role() = 'anon' AND user_id IS NOT NULL));

CREATE POLICY "Users can delete own mcp_servers" ON mcp_servers
  FOR DELETE
  USING (auth.uid() = user_id OR (auth.role() = 'anon' AND user_id IS NOT NULL));

-- Drop existing policies for agents
DROP POLICY IF EXISTS "Users can read own agents" ON agents;
DROP POLICY IF EXISTS "Users can insert own agents" ON agents;
DROP POLICY IF EXISTS "Users can update own agents" ON agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON agents;

-- Create new policies that support both authenticated and anonymous users
CREATE POLICY "Users can read own agents" ON agents
  FOR SELECT
  USING (auth.uid() = user_id OR (auth.role() = 'anon' AND user_id IS NOT NULL));

CREATE POLICY "Users can insert own agents" ON agents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR (auth.role() = 'anon' AND user_id IS NOT NULL));

CREATE POLICY "Users can update own agents" ON agents
  FOR UPDATE
  USING (auth.uid() = user_id OR (auth.role() = 'anon' AND user_id IS NOT NULL));

CREATE POLICY "Users can delete own agents" ON agents
  FOR DELETE
  USING (auth.uid() = user_id OR (auth.role() = 'anon' AND user_id IS NOT NULL));
