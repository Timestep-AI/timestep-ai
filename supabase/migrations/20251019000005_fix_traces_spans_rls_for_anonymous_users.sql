-- Fix RLS policies for traces and spans tables to support anonymous users
-- Anonymous users have role 'anonymous', not 'anon'

-- Drop existing policies for traces
DROP POLICY IF EXISTS "Users can view their own traces" ON traces;
DROP POLICY IF EXISTS "Users can insert their own traces" ON traces;
DROP POLICY IF EXISTS "Users can update their own traces" ON traces;
DROP POLICY IF EXISTS "Users can delete their own traces" ON traces;

-- Create new policies that support both authenticated and anonymous users
CREATE POLICY "Users can view their own traces" ON traces
  FOR SELECT
  USING (auth.uid() = user_id OR (auth.role() = 'anonymous' AND user_id IS NOT NULL));

CREATE POLICY "Users can insert their own traces" ON traces
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR (auth.role() = 'anonymous' AND user_id IS NOT NULL));

CREATE POLICY "Users can update their own traces" ON traces
  FOR UPDATE
  USING (auth.uid() = user_id OR (auth.role() = 'anonymous' AND user_id IS NOT NULL));

CREATE POLICY "Users can delete their own traces" ON traces
  FOR DELETE
  USING (auth.uid() = user_id OR (auth.role() = 'anonymous' AND user_id IS NOT NULL));

-- Drop existing policies for spans
DROP POLICY IF EXISTS "Users can view their own spans" ON spans;
DROP POLICY IF EXISTS "Users can insert their own spans" ON spans;
DROP POLICY IF EXISTS "Users can update their own spans" ON spans;
DROP POLICY IF EXISTS "Users can delete their own spans" ON spans;

-- Create new policies that support both authenticated and anonymous users
CREATE POLICY "Users can view their own spans" ON spans
  FOR SELECT
  USING (auth.uid() = user_id OR (auth.role() = 'anonymous' AND user_id IS NOT NULL));

CREATE POLICY "Users can insert their own spans" ON spans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR (auth.role() = 'anonymous' AND user_id IS NOT NULL));

CREATE POLICY "Users can update their own spans" ON spans
  FOR UPDATE
  USING (auth.uid() = user_id OR (auth.role() = 'anonymous' AND user_id IS NOT NULL));

CREATE POLICY "Users can delete their own spans" ON spans
  FOR DELETE
  USING (auth.uid() = user_id OR (auth.role() = 'anonymous' AND user_id IS NOT NULL));
