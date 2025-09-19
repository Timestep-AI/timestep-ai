-- Make user_id columns NOT NULL for proper RLS enforcement
ALTER TABLE public.contexts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.mcp_servers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.model_providers ALTER COLUMN user_id SET NOT NULL;