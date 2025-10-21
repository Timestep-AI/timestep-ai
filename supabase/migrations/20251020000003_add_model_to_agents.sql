-- Add model field to agents table
-- Note: The default value will be set by the application using DEFAULT_AGENT_MODEL environment variable
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model TEXT;

-- Update existing agents to have the default model (will be set by application logic)
-- UPDATE agents SET model = 'hf_inference_endpoints/HuggingFaceTB/SmolLM3-3B' WHERE model IS NULL;
