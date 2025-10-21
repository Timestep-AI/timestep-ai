-- Cleanup migration to remove unwanted tables and functions from production
-- This migration ensures any leftover tables from previous iterations are properly removed

-- Drop any remaining old chatkit tables (should already be dropped, but ensuring cleanup)
DROP TABLE IF EXISTS chatkit_threads CASCADE;
DROP TABLE IF EXISTS chatkit_thread_items CASCADE;
DROP TABLE IF EXISTS chatkit_run_states CASCADE;

-- Drop any remaining old conversation tables (should already be dropped, but ensuring cleanup)
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS conversation_items CASCADE;
DROP TABLE IF EXISTS run_states CASCADE;

-- Drop any remaining tracing tables (should already be dropped, but ensuring cleanup)
DROP TABLE IF EXISTS traces CASCADE;
DROP TABLE IF EXISTS spans CASCADE;
DROP TABLE IF EXISTS responses CASCADE;

-- Drop any remaining old agent/mcp tables that might have been recreated
-- (These will be recreated by the proper migrations if needed)
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS mcp_servers CASCADE;

-- Note: The proper tables (threads, thread_messages, thread_run_states, 
-- files, uploads, vector_stores, vector_store_files, profiles) will be 
-- recreated by the existing migrations in the correct order.

-- Clean up any orphaned functions or procedures that might reference dropped tables
-- (PostgreSQL will automatically drop dependent functions with CASCADE, but being explicit)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
