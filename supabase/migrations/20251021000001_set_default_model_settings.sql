-- Set default model settings for existing agents
UPDATE agents 
SET model_settings = '{"temperature": 0.0, "toolChoice": "auto"}'::jsonb 
WHERE model_settings IS NULL OR model_settings = '{}'::jsonb;

-- Update the default value for the column
ALTER TABLE agents ALTER COLUMN model_settings SET DEFAULT '{"temperature": 0.0, "toolChoice": "auto"}'::jsonb;
