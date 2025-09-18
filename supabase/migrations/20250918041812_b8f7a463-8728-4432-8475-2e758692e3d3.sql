-- Create model_providers table for Timestep integration
CREATE TABLE public.model_providers (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  api_key TEXT,
  base_url TEXT NOT NULL,
  models_url TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_model_providers_provider ON public.model_providers(provider);
CREATE INDEX idx_model_providers_user_id ON public.model_providers(user_id);

-- Enable Row Level Security
ALTER TABLE public.model_providers ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view all model providers" 
ON public.model_providers 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can insert model providers" 
ON public.model_providers 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can update model providers" 
ON public.model_providers 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Users can delete model providers" 
ON public.model_providers 
FOR DELETE 
TO authenticated 
USING (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_model_providers_updated_at
BEFORE UPDATE ON public.model_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();