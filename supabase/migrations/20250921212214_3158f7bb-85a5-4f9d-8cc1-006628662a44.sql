-- Drop the chats table and related triggers/functions
DROP TABLE IF EXISTS public.chats CASCADE;
DROP FUNCTION IF EXISTS public.update_chats_updated_at() CASCADE;