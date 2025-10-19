-- Simplify RLS policies to allow all operations for now
-- This will help us identify if RLS is the issue

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own traces" ON traces;
DROP POLICY IF EXISTS "Users can insert their own traces" ON traces;
DROP POLICY IF EXISTS "Users can update their own traces" ON traces;
DROP POLICY IF EXISTS "Users can delete their own traces" ON traces;

DROP POLICY IF EXISTS "Users can view their own spans" ON spans;
DROP POLICY IF EXISTS "Users can insert their own spans" ON spans;
DROP POLICY IF EXISTS "Users can update their own spans" ON spans;
DROP POLICY IF EXISTS "Users can delete their own spans" ON spans;

DROP POLICY IF EXISTS "Users can view their own responses" ON responses;
DROP POLICY IF EXISTS "Users can insert their own responses" ON responses;
DROP POLICY IF EXISTS "Users can update their own responses" ON responses;
DROP POLICY IF EXISTS "Users can delete their own responses" ON responses;

-- Create simple policies that allow all operations
CREATE POLICY "Allow all operations on traces" ON traces FOR ALL USING (true);
CREATE POLICY "Allow all operations on spans" ON spans FOR ALL USING (true);
CREATE POLICY "Allow all operations on responses" ON responses FOR ALL USING (true);
