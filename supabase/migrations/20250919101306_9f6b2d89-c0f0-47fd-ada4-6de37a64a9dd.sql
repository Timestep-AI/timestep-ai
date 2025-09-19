-- Fix handoff_description column to be nullable as expected by the edge function
ALTER TABLE public.agents ALTER COLUMN handoff_description DROP NOT NULL;
ALTER TABLE public.agents ALTER COLUMN handoff_description DROP DEFAULT;