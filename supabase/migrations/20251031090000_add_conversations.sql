-- Conversations storage
create table if not exists public.conversations (
  id text primary key,
  user_id uuid not null,
  created_at bigint not null,
  metadata jsonb default '{}'
);

create table if not exists public.conversation_items (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  created_at bigint not null,
  type text not null,
  role text,
  content jsonb not null
);

create index if not exists idx_conversations_user_created on public.conversations(user_id, created_at desc);
create index if not exists idx_items_conv_created on public.conversation_items(conversation_id, created_at asc);

-- RLS
alter table public.conversations enable row level security;
alter table public.conversation_items enable row level security;

do $$ begin
  create policy conv_select on public.conversations for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy conv_insert on public.conversations for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy conv_delete on public.conversations for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy conv_items_select on public.conversation_items for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy conv_items_insert on public.conversation_items for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy conv_items_delete on public.conversation_items for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;


