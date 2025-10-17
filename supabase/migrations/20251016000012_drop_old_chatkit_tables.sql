-- Drop old ChatKit tables that are being replaced
DROP TABLE IF EXISTS conversation_items CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS chatkit_thread_items CASCADE;
DROP TABLE IF EXISTS chatkit_threads CASCADE;
DROP TABLE IF EXISTS chatkit_run_states CASCADE;
