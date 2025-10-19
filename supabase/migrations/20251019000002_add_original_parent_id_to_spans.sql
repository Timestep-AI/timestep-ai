-- Add original_parent_id column to spans table to track orphaned spans
ALTER TABLE spans ADD COLUMN original_parent_id TEXT;

-- Add index for efficient lookups
CREATE INDEX idx_spans_original_parent_id ON spans(original_parent_id) WHERE original_parent_id IS NOT NULL;
