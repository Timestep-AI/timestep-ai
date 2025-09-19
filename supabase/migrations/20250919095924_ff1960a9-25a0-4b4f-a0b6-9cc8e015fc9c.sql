-- Now safely make the schema changes

-- Drop foreign key constraints first
ALTER TABLE public.agent_cards DROP CONSTRAINT IF EXISTS agent_cards_agent_id_fkey;

-- Update agents table structure
ALTER TABLE public.agents 
  DROP CONSTRAINT IF EXISTS agents_pkey CASCADE,
  ALTER COLUMN id TYPE TEXT,
  ADD PRIMARY KEY (id);

-- Remove columns not used by edge function
ALTER TABLE public.agents 
  DROP COLUMN IF EXISTS prompt,
  DROP COLUMN IF EXISTS handoffs,
  DROP COLUMN IF EXISTS tools,
  DROP COLUMN IF EXISTS mcp_servers,
  DROP COLUMN IF EXISTS input_guardrails,
  DROP COLUMN IF EXISTS output_guardrails,
  DROP COLUMN IF EXISTS reset_tool_choice,
  DROP COLUMN IF EXISTS model_api_key_id,
  DROP COLUMN IF EXISTS output_type,
  DROP COLUMN IF EXISTS tool_use_behavior;

-- Ensure required columns exist
ALTER TABLE public.agents 
  ADD COLUMN IF NOT EXISTS handoff_description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS handoff_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tool_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS model_settings JSONB DEFAULT '{}'::jsonb;

-- Add unique constraint for upserts
ALTER TABLE public.agents 
  ADD CONSTRAINT agents_user_id_id_unique UNIQUE (user_id, id);

-- Update agent_cards agent_id column to match
ALTER TABLE public.agent_cards
  ALTER COLUMN agent_id TYPE TEXT;

-- Update contexts table structure  
ALTER TABLE public.contexts
  DROP CONSTRAINT IF EXISTS contexts_pkey CASCADE,
  ALTER COLUMN context_id TYPE TEXT,
  ADD PRIMARY KEY (context_id);

-- Remove unused context columns
ALTER TABLE public.contexts
  DROP COLUMN IF EXISTS id,
  DROP COLUMN IF EXISTS user_id,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS last_activity_at,
  DROP COLUMN IF EXISTS task_id,
  DROP COLUMN IF EXISTS conversation_context,
  DROP COLUMN IF EXISTS pending_interruptions,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS task_states,
  DROP COLUMN IF EXISTS serialized_agent_state,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS tasks;

-- Ensure agent_id is TEXT and add task_histories
ALTER TABLE public.contexts
  ALTER COLUMN agent_id TYPE TEXT,
  ADD COLUMN IF NOT EXISTS task_histories JSONB DEFAULT '{}'::jsonb;

-- Update mcp_servers table structure
ALTER TABLE public.mcp_servers
  DROP CONSTRAINT IF EXISTS mcp_servers_pkey CASCADE,
  ALTER COLUMN id TYPE TEXT,
  ADD PRIMARY KEY (id);

-- Remove unused mcp_servers columns  
ALTER TABLE public.mcp_servers
  DROP COLUMN IF EXISTS url,
  DROP COLUMN IF EXISTS config;

-- Add required mcp_servers columns
ALTER TABLE public.mcp_servers
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS env JSONB DEFAULT '{}'::jsonb;

-- Add unique constraint for upserts
ALTER TABLE public.mcp_servers
  ADD CONSTRAINT mcp_servers_user_id_id_unique UNIQUE (user_id, id);

-- Update model_providers table structure
ALTER TABLE public.model_providers
  DROP CONSTRAINT IF EXISTS model_providers_pkey CASCADE,
  ALTER COLUMN id TYPE TEXT,
  ADD PRIMARY KEY (id);

-- Add unique constraint for upserts
ALTER TABLE public.model_providers
  ADD CONSTRAINT model_providers_user_id_id_unique UNIQUE (user_id, id);