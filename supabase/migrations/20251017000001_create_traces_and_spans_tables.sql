-- Create traces table to store OpenTelemetry traces
CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY, -- Trace ID from OpenTelemetry
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT REFERENCES threads(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Trace metadata
  name TEXT, -- Root span name
  status TEXT, -- ok, error, unset
  duration_ms NUMERIC, -- Total trace duration in milliseconds

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create spans table to store individual spans within traces
CREATE TABLE IF NOT EXISTS spans (
  id TEXT PRIMARY KEY, -- Span ID from OpenTelemetry
  trace_id TEXT NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  parent_span_id TEXT, -- NULL for root spans, references spans(id) for child spans
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Span timing
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_ms NUMERIC, -- Span duration in milliseconds

  -- Span details
  name TEXT NOT NULL, -- Span name (e.g., "agent.run", "tool.execute")
  kind TEXT, -- internal, server, client, producer, consumer
  status TEXT, -- ok, error, unset
  status_message TEXT, -- Error message if status is error

  -- Span attributes (OpenTelemetry attributes)
  attributes JSONB DEFAULT '{}'::jsonb,

  -- Events within the span
  events JSONB DEFAULT '[]'::jsonb,

  -- Links to other spans
  links JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add foreign key constraint for parent_span_id (after table creation to allow self-reference)
ALTER TABLE spans
  ADD CONSTRAINT spans_parent_span_id_fkey
  FOREIGN KEY (parent_span_id) REFERENCES spans(id) ON DELETE CASCADE;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS traces_user_id_idx ON traces(user_id);
CREATE INDEX IF NOT EXISTS traces_thread_id_idx ON traces(thread_id);
CREATE INDEX IF NOT EXISTS traces_created_at_idx ON traces(created_at DESC);

CREATE INDEX IF NOT EXISTS spans_trace_id_idx ON spans(trace_id);
CREATE INDEX IF NOT EXISTS spans_parent_span_id_idx ON spans(parent_span_id);
CREATE INDEX IF NOT EXISTS spans_user_id_idx ON spans(user_id);
CREATE INDEX IF NOT EXISTS spans_start_time_idx ON spans(start_time DESC);

-- Add GIN index for JSONB columns to enable fast searching
CREATE INDEX IF NOT EXISTS traces_metadata_idx ON traces USING GIN (metadata);
CREATE INDEX IF NOT EXISTS spans_attributes_idx ON spans USING GIN (attributes);
CREATE INDEX IF NOT EXISTS spans_events_idx ON spans USING GIN (events);

-- Enable Row Level Security (RLS)
ALTER TABLE traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE spans ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for traces
CREATE POLICY "Users can view their own traces"
  ON traces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own traces"
  ON traces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own traces"
  ON traces FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own traces"
  ON traces FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for spans
CREATE POLICY "Users can view their own spans"
  ON spans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own spans"
  ON spans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own spans"
  ON spans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own spans"
  ON spans FOR DELETE
  USING (auth.uid() = user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_traces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER traces_updated_at_trigger
  BEFORE UPDATE ON traces
  FOR EACH ROW
  EXECUTE FUNCTION update_traces_updated_at();
