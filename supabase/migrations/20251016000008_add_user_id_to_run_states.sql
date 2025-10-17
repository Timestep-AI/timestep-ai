-- Add user_id column to chatkit_run_states table
ALTER TABLE chatkit_run_states ADD COLUMN user_id UUID;

-- Update existing records to have user_id (this will be null for existing records)
-- In a real migration, you'd want to populate this properly

-- Create index for efficient user_id lookups
CREATE INDEX IF NOT EXISTS idx_chatkit_run_states_user_id ON chatkit_run_states(user_id);

-- Update RLS policies to use user_id directly
DROP POLICY IF EXISTS "Users can manage their own run states" ON chatkit_run_states;

-- Allow authenticated users to manage their own run states
CREATE POLICY "Users can manage their own run states"
  ON chatkit_run_states
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Allow anonymous users to manage their own run states
CREATE POLICY "Anonymous users can manage their own run states"
  ON chatkit_run_states
  FOR ALL TO anon
  USING (auth.uid() = user_id);
