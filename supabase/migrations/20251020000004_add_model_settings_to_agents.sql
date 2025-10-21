-- Add model_settings field to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model_settings JSONB DEFAULT '{}';

-- Update existing agents to have empty model_settings
UPDATE agents SET model_settings = '{}' WHERE model_settings IS NULL;
