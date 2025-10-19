-- Re-enable RLS on traces and spans tables with proper anonymous user support
-- Drop the temporary disable migration
DROP POLICY IF EXISTS "Users can view their own traces" ON traces;
DROP POLICY IF EXISTS "Users can insert their own traces" ON traces;
DROP POLICY IF EXISTS "Users can update their own traces" ON traces;
DROP POLICY IF EXISTS "Users can delete their own traces" ON traces;

DROP POLICY IF EXISTS "Users can view their own spans" ON spans;
DROP POLICY IF EXISTS "Users can insert their own spans" ON spans;
DROP POLICY IF EXISTS "Users can update their own spans" ON spans;
DROP POLICY IF EXISTS "Users can delete their own spans" ON spans;

-- Re-enable RLS
ALTER TABLE traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE spans ENABLE ROW LEVEL SECURITY;

-- Create policies that support both authenticated and anonymous users
-- For anonymous users, we need to check if the user_id is not null
CREATE POLICY "Users can view their own traces" ON traces
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own traces" ON traces
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own traces" ON traces
  FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own traces" ON traces
  FOR DELETE
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

-- Create policies for spans
CREATE POLICY "Users can view their own spans" ON spans
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own spans" ON spans
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own spans" ON spans
  FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own spans" ON spans
  FOR DELETE
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

-- Also update responses table RLS policies to support anonymous users
DROP POLICY IF EXISTS "Users can view their own responses" ON responses;
DROP POLICY IF EXISTS "Users can insert their own responses" ON responses;
DROP POLICY IF EXISTS "Users can update their own responses" ON responses;
DROP POLICY IF EXISTS "Users can delete their own responses" ON responses;

CREATE POLICY "Users can view their own responses" ON responses
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own responses" ON responses
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own responses" ON responses
  FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own responses" ON responses
  FOR DELETE
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );
