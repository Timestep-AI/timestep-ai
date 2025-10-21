-- Add model field to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gpt-4o-mini';

-- Update existing agents to have the default model
UPDATE agents SET model = 'gpt-4o-mini' WHERE model IS NULL;
