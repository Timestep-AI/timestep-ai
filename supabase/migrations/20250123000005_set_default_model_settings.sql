-- Set default model settings for agents
-- This migration sets up the default model configuration

-- Set default model settings for existing agents
UPDATE agents 
SET model_settings = '{"temperature": 0.0, "toolChoice": "auto"}'::jsonb 
WHERE model_settings IS NULL OR model_settings = '{}'::jsonb;

-- Update the default value for the column
ALTER TABLE agents ALTER COLUMN model_settings SET DEFAULT '{"temperature": 0.0, "toolChoice": "auto"}'::jsonb;

-- Update default model to ollama/gpt-oss:120b-cloud for existing agents
UPDATE agents 
SET model = 'ollama/gpt-oss:120b-cloud' 
WHERE model IS NULL OR model = '';

-- Note: PostgreSQL doesn't support ALTER COLUMN SET DEFAULT with a dynamic value,
-- so we'll rely on the application code to set the default from the environment variable
