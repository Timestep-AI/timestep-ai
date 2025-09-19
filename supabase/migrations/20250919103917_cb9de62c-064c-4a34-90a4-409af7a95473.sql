-- Clean up orphaned data (created without proper authentication)
DELETE FROM model_providers WHERE user_id IS NULL;
DELETE FROM mcp_servers WHERE user_id IS NULL;
DELETE FROM contexts WHERE user_id IS NULL;

-- Now make user_id columns NOT NULL for proper RLS enforcement
ALTER TABLE public.contexts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.mcp_servers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.model_providers ALTER COLUMN user_id SET NOT NULL;