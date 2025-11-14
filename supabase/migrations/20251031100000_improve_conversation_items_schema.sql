-- Improve conversation_items schema to better match OpenAI Conversations API spec
-- This adds columns for function_call specific fields to avoid storing everything in content JSONB

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'conversation_items') then
    -- Make content nullable (function_call items don't need content)
    alter table public.conversation_items
      alter column content drop not null;

    -- Add columns for function_call and function_call_output items
    alter table public.conversation_items
      add column if not exists call_id text,
      add column if not exists name text,
      add column if not exists arguments text, -- Per spec, arguments is always a JSON string
      add column if not exists output jsonb, -- Can be string or array per spec
      add column if not exists status text; -- 'completed', 'in_progress', or 'incomplete'

    -- Add index for call_id lookups
    create index if not exists idx_conversation_items_call_id on public.conversation_items(call_id) where call_id is not null;

    -- Add check constraint for status values (drop first if exists to avoid errors)
    alter table public.conversation_items
      drop constraint if exists check_status_values;
    
    alter table public.conversation_items
      add constraint check_status_values
      check (status is null or status in ('completed', 'in_progress', 'incomplete'));
  end if;
end $$;

-- Note: 
-- - content JSONB is used for message items (array of content parts like [{type: "input_text", text: "..."}])
-- - content can be null for function_call and function_call_output items (they use dedicated columns)
-- - The new columns are used for function_call items per OpenAI spec

