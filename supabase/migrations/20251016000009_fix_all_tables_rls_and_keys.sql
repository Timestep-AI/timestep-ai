-- Fix all tables to have proper RLS with user_id and composite keys

-- 1. Fix chatkit_thread_items table
-- Add user_id column
ALTER TABLE chatkit_thread_items ADD COLUMN user_id UUID;

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_chatkit_thread_items_user_id ON chatkit_thread_items(user_id);

-- Update RLS policies to include anonymous users
DROP POLICY IF EXISTS "Users can view items from their chatkit threads" ON chatkit_thread_items;
DROP POLICY IF EXISTS "Users can create items in their chatkit threads" ON chatkit_thread_items;
DROP POLICY IF EXISTS "Users can delete items from their chatkit threads" ON chatkit_thread_items;

-- Allow authenticated and anonymous users to view items from their threads
CREATE POLICY "Users can view items from their chatkit threads" ON chatkit_thread_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chatkit_threads
    WHERE chatkit_threads.id = chatkit_thread_items.thread_id
    AND chatkit_threads.user_id = auth.uid()
  )
  OR auth.role() = 'service_role'
);

-- Allow authenticated and anonymous users to create items in their threads
CREATE POLICY "Users can create items in their chatkit threads" ON chatkit_thread_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chatkit_threads
    WHERE chatkit_threads.id = chatkit_thread_items.thread_id
    AND chatkit_threads.user_id = auth.uid()
  )
  OR auth.role() = 'service_role'
);

-- Allow authenticated and anonymous users to delete items from their threads
CREATE POLICY "Users can delete items from their chatkit threads" ON chatkit_thread_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM chatkit_threads
    WHERE chatkit_threads.id = chatkit_thread_items.thread_id
    AND chatkit_threads.user_id = auth.uid()
  )
  OR auth.role() = 'service_role'
);

-- 2. Fix chatkit_run_states table
-- Drop existing primary key
ALTER TABLE chatkit_run_states DROP CONSTRAINT chatkit_run_states_pkey;

-- Add composite primary key
ALTER TABLE chatkit_run_states ADD CONSTRAINT chatkit_run_states_pkey PRIMARY KEY (thread_id, user_id);

-- Update RLS policies to include anonymous users
DROP POLICY IF EXISTS "Users can manage their own run states" ON chatkit_run_states;
DROP POLICY IF EXISTS "Anonymous users can manage their own run states" ON chatkit_run_states;

-- Allow authenticated and anonymous users to manage their own run states
CREATE POLICY "Users can manage their own run states" ON chatkit_run_states
FOR ALL
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 3. Fix chatkit_threads table RLS policies to include anonymous users
DROP POLICY IF EXISTS "Users can view their own chatkit threads" ON chatkit_threads;
DROP POLICY IF EXISTS "Users can create their own chatkit threads" ON chatkit_threads;
DROP POLICY IF EXISTS "Users can update their own chatkit threads" ON chatkit_threads;
DROP POLICY IF EXISTS "Users can delete their own chatkit threads" ON chatkit_threads;

-- Allow authenticated and anonymous users to view their own threads
CREATE POLICY "Users can view their own chatkit threads" ON chatkit_threads
FOR SELECT
USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to create their own threads
CREATE POLICY "Users can create their own chatkit threads" ON chatkit_threads
FOR INSERT
WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to update their own threads
CREATE POLICY "Users can update their own chatkit threads" ON chatkit_threads
FOR UPDATE
USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to delete their own threads
CREATE POLICY "Users can delete their own chatkit threads" ON chatkit_threads
FOR DELETE
USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- 4. Fix agents table RLS policies to include anonymous users
DROP POLICY IF EXISTS "Users can read own agents" ON agents;
DROP POLICY IF EXISTS "Users can insert own agents" ON agents;
DROP POLICY IF EXISTS "Users can update own agents" ON agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON agents;

-- Allow authenticated and anonymous users to read their own agents
CREATE POLICY "Users can read own agents" ON agents
FOR SELECT
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to insert their own agents
CREATE POLICY "Users can insert own agents" ON agents
FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to update their own agents
CREATE POLICY "Users can update own agents" ON agents
FOR UPDATE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to delete their own agents
CREATE POLICY "Users can delete own agents" ON agents
FOR DELETE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 5. Fix mcp_servers table RLS policies to include anonymous users
DROP POLICY IF EXISTS "Users can read own mcp_servers" ON mcp_servers;
DROP POLICY IF EXISTS "Users can insert own mcp_servers" ON mcp_servers;
DROP POLICY IF EXISTS "Users can update own mcp_servers" ON mcp_servers;
DROP POLICY IF EXISTS "Users can delete own mcp_servers" ON mcp_servers;

-- Allow authenticated and anonymous users to read their own MCP servers
CREATE POLICY "Users can read own mcp_servers" ON mcp_servers
FOR SELECT
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to insert their own MCP servers
CREATE POLICY "Users can insert own mcp_servers" ON mcp_servers
FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to update their own MCP servers
CREATE POLICY "Users can update own mcp_servers" ON mcp_servers
FOR UPDATE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to delete their own MCP servers
CREATE POLICY "Users can delete own mcp_servers" ON mcp_servers
FOR DELETE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 6. Fix conversations table RLS policies to include anonymous users
DROP POLICY IF EXISTS "Users can read own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;

-- Allow authenticated and anonymous users to read their own conversations
CREATE POLICY "Users can read own conversations" ON conversations
FOR SELECT
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to insert their own conversations
CREATE POLICY "Users can insert own conversations" ON conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to update their own conversations
CREATE POLICY "Users can update own conversations" ON conversations
FOR UPDATE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to delete their own conversations
CREATE POLICY "Users can delete own conversations" ON conversations
FOR DELETE
USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 7. Fix profiles table RLS policies to include anonymous users
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

-- Allow authenticated and anonymous users to read their own profile
CREATE POLICY "Users can read own profile" ON profiles
FOR SELECT
USING (auth.uid() = id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE
USING (auth.uid() = id OR auth.role() = 'service_role');

-- Allow authenticated and anonymous users to delete their own profile
CREATE POLICY "Users can delete own profile" ON profiles
FOR DELETE
USING (auth.uid() = id OR auth.role() = 'service_role');
