-- Update mcp_servers table to match expected schema exactly
-- First drop existing constraints and add missing columns
ALTER TABLE mcp_servers 
  DROP COLUMN IF EXISTS disabled,
  DROP COLUMN IF EXISTS env,
  DROP COLUMN IF EXISTS status;

-- Ensure we have the right columns with right types
ALTER TABLE mcp_servers 
  ADD COLUMN IF NOT EXISTS server_url TEXT,
  ADD COLUMN IF NOT EXISTS auth_token TEXT;

-- Change id column to UUID type if it's not already
ALTER TABLE mcp_servers ALTER COLUMN id TYPE UUID USING id::UUID;

-- Drop existing primary key and recreate as compound key
ALTER TABLE mcp_servers DROP CONSTRAINT IF EXISTS mcp_servers_pkey;
ALTER TABLE mcp_servers ADD PRIMARY KEY (user_id, id);

-- Update agents table to match expected schema
-- Change id column to UUID if not already
ALTER TABLE agents ALTER COLUMN id TYPE UUID USING id::UUID;

-- Drop existing primary key and recreate as compound key  
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_pkey;
ALTER TABLE agents ADD PRIMARY KEY (user_id, id);

-- Ensure model column exists and is required
ALTER TABLE agents ALTER COLUMN model SET NOT NULL;

-- Update contexts table to match expected schema
-- Ensure agent_id column is UUID type
ALTER TABLE contexts ALTER COLUMN agent_id TYPE UUID USING agent_id::UUID;

-- Drop existing primary key and recreate as compound key
ALTER TABLE contexts DROP CONSTRAINT IF EXISTS contexts_pkey;
ALTER TABLE contexts ADD PRIMARY KEY (user_id, id);

-- Update model_providers table to match expected schema
-- Change id column to UUID if not already
ALTER TABLE model_providers ALTER COLUMN id TYPE UUID USING id::UUID;

-- Drop existing primary key and recreate as compound key
ALTER TABLE model_providers DROP CONSTRAINT IF EXISTS model_providers_pkey;
ALTER TABLE model_providers ADD PRIMARY KEY (user_id, id);

-- Create missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_contexts_user_id ON contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_contexts_context_id ON contexts(context_id);
CREATE INDEX IF NOT EXISTS idx_contexts_agent_id ON contexts(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers(name);
CREATE INDEX IF NOT EXISTS idx_model_providers_user_id ON model_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_model_providers_provider ON model_providers(provider);