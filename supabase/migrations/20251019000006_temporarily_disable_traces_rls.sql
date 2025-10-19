-- Temporarily disable RLS on traces and spans tables to test if that's the issue
ALTER TABLE traces DISABLE ROW LEVEL SECURITY;
ALTER TABLE spans DISABLE ROW LEVEL SECURITY;
