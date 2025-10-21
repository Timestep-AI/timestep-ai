-- Update default model to ollama/gpt-oss:120b-cloud for existing agents
UPDATE agents 
SET model = 'ollama/gpt-oss:120b-cloud' 
WHERE model IS NULL OR model = '';

-- Update the default value for the model column (this affects new agents)
-- Note: PostgreSQL doesn't support ALTER COLUMN SET DEFAULT with a dynamic value,
-- so we'll rely on the application code to set the default from the environment variable
