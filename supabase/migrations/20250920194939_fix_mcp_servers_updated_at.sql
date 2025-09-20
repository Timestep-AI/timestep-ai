-- Fix mcp_servers table to add updated_at column and trigger
-- This should resolve the persistence issue where updates aren't being saved

-- Add updated_at column to mcp_servers table if it doesn't exist
ALTER TABLE public.mcp_servers 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add trigger for automatic updated_at timestamp updates
CREATE TRIGGER update_mcp_servers_updated_at
  BEFORE UPDATE ON public.mcp_servers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
