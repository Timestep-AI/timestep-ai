-- First, drop ALL RLS policies that might depend on columns we're changing

-- Drop policies on all tables
DROP POLICY IF EXISTS "Users can delete own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can insert own agents" ON public.agents; 
DROP POLICY IF EXISTS "Users can update own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can view own agents" ON public.agents;

DROP POLICY IF EXISTS "Users can manage their own contexts" ON public.contexts;

DROP POLICY IF EXISTS "Users can delete their own MCP servers" ON public.mcp_servers;
DROP POLICY IF EXISTS "Users can insert their own MCP servers" ON public.mcp_servers;
DROP POLICY IF EXISTS "Users can select system templates and own MCP servers" ON public.mcp_servers;
DROP POLICY IF EXISTS "Users can update their own MCP servers" ON public.mcp_servers;

DROP POLICY IF EXISTS "Users can delete model providers" ON public.model_providers;
DROP POLICY IF EXISTS "Users can insert model providers" ON public.model_providers;
DROP POLICY IF EXISTS "Users can update model providers" ON public.model_providers;
DROP POLICY IF EXISTS "Users can view all model providers" ON public.model_providers;

DROP POLICY IF EXISTS "Users can delete own agent cards" ON public.agent_cards;
DROP POLICY IF EXISTS "Users can insert own agent cards" ON public.agent_cards;
DROP POLICY IF EXISTS "Users can update own agent cards" ON public.agent_cards;
DROP POLICY IF EXISTS "Users can view own agent cards" ON public.agent_cards;

-- Disable RLS on all tables
ALTER TABLE public.agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contexts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_servers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_cards DISABLE ROW LEVEL SECURITY;