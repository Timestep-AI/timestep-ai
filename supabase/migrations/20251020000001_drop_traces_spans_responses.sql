-- Drop tables related to custom tracing (we're using OpenAI's built-in tracing instead)
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS spans CASCADE;
DROP TABLE IF EXISTS traces CASCADE;
