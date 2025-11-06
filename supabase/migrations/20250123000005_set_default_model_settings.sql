-- Set default model settings for agents
-- This migration sets up the default model configuration

-- Set default model settings for existing agents
UPDATE agents 
SET model_settings = '{"temperature": 0.0, "toolChoice": "auto"}'::jsonb 
WHERE model_settings IS NULL OR model_settings = '{}'::jsonb;

-- Update the default value for the column
ALTER TABLE agents ALTER COLUMN model_settings SET DEFAULT '{"temperature": 0.0, "toolChoice": "auto"}'::jsonb;

-- Update default model to openai/gpt-4.1 for existing agents
-- Update all agents that don't already have the correct model
UPDATE agents 
SET model = 'openai/gpt-4.1' 
WHERE model IS NULL OR model = '' OR model = 'ollama/gpt-oss:120b-cloud';

-- Note: PostgreSQL doesn't support ALTER COLUMN SET DEFAULT with a dynamic value,
-- so we'll rely on the application code to set the default from the environment variable
