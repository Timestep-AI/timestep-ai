-- Fix RLS policies for thread_messages table to use correct anonymous role
-- Anonymous users have role 'anonymous', not 'anon'

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own thread messages" ON thread_messages;
DROP POLICY IF EXISTS "Users can create their own thread messages" ON thread_messages;
DROP POLICY IF EXISTS "Users can update their own thread messages" ON thread_messages;
DROP POLICY IF EXISTS "Users can delete their own thread messages" ON thread_messages;

-- Create new policies that support both authenticated and anonymous users
CREATE POLICY "Users can view their own thread messages" ON thread_messages
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can create their own thread messages" ON thread_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can update their own thread messages" ON thread_messages
  FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own thread messages" ON thread_messages
  FOR DELETE
  USING (
    auth.uid() = user_id OR 
    (auth.role() = 'anonymous' AND user_id IS NOT NULL)
  );
