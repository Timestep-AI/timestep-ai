-- Fix contexts table to match edge function expectations
ALTER TABLE public.contexts ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.contexts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.contexts ADD COLUMN IF NOT EXISTS task_states JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.contexts ADD COLUMN IF NOT EXISTS tasks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.contexts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Drop existing primary key if it exists and add new one
ALTER TABLE public.contexts DROP CONSTRAINT IF EXISTS contexts_pkey;
ALTER TABLE public.contexts ADD PRIMARY KEY (id);

-- Add unique constraints for user-scoped data
ALTER TABLE public.agents ADD CONSTRAINT agents_user_id_id_unique UNIQUE (user_id, id);
ALTER TABLE public.model_providers ADD CONSTRAINT model_providers_user_id_id_unique UNIQUE (user_id, id);
ALTER TABLE public.mcp_servers ADD CONSTRAINT mcp_servers_user_id_id_unique UNIQUE (user_id, id);
ALTER TABLE public.contexts ADD CONSTRAINT contexts_user_id_context_id_unique UNIQUE (user_id, context_id);

-- Enable RLS on all tables
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contexts ENABLE ROW LEVEL SECURITY;

-- RLS policies for agents
CREATE POLICY "Users can manage their own agents" ON public.agents
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for model_providers  
CREATE POLICY "Users can manage their own model providers" ON public.model_providers
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for mcp_servers
CREATE POLICY "Users can manage their own MCP servers" ON public.mcp_servers
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for contexts
CREATE POLICY "Users can manage their own contexts" ON public.contexts
  FOR ALL USING (auth.uid() = user_id);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_contexts_updated_at
  BEFORE UPDATE ON public.contexts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_model_providers_updated_at
  BEFORE UPDATE ON public.model_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();