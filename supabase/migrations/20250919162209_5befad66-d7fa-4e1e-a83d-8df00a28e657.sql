-- Remove the unique constraint on agents table for user_id + name combination
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_user_name_unique;