import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ThreadMetadata, ThreadItem, Page } from './chatkit/types.ts';
import type { Store, AttachmentStore } from './chatkit/store.ts';

export type TContext = {
  supabase: SupabaseClient;
  user_id: string | null;
  user_jwt: string | null;
  agent_id?: string | null;
};

function randomId(len = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
}

export class PostgresStore implements Store<TContext> {
  static generate_thread_id(_context?: TContext | null): string {
    // UUID v4 style simplified
    return crypto.randomUUID();
  }

  generate_thread_id(context?: TContext | null): string {
    return PostgresStore.generate_thread_id(context);
  }

  generate_item_id(item_type: string, _thread: ThreadMetadata, _context?: TContext | null): string {
    const ts = Date.now();
    return `${item_type}_${ts}_${randomId()}`;
  }

  async add_thread_item(thread_id: string, item: ThreadItem, context?: TContext | null): Promise<void> {
    if (!context) throw new Error('Missing request context');
    if (!context.user_id) throw new Error("Missing user_id (supply 'x-user-id' header for anonymous users)");

    const supabase = context.supabase;
    const { data: nextIdx, error: rpcErr } = await supabase.rpc('get_next_message_index', { p_thread_id: thread_id });
    if (rpcErr) throw rpcErr;
    const message_index = Number(nextIdx ?? 0);

    let role = 'assistant';
    let content = '';
    if (item?.type === 'user_message') {
      role = 'user';
      content = Array.isArray(item.content)
        ? item.content.map((p: any) => p?.text || '').join('\n')
        : typeof item.content === 'string' ? item.content : '';
    } else if (item?.type === 'assistant_message') {
      role = 'assistant';
      content = Array.isArray(item.content)
        ? item.content.map((p: any) => p?.text || '').join('\n')
        : typeof item.content === 'string' ? item.content : '';
    } else {
      content = JSON.stringify(item);
    }

    const payload = {
      id: `msg_${Date.now()}_${randomId()}`,
      thread_id,
      user_id: context.user_id,
      message_index,
      role,
      content,
    };
    const { error } = await supabase.from('thread_messages').insert(payload);
    if (error) throw error;
  }

  async load_thread(thread_id: string, context?: TContext | null): Promise<ThreadMetadata> {
    if (!context) throw new Error('Missing request context');
    const supabase = context.supabase;
    const { data, error } = await supabase
      .from('threads')
      .select('id, user_id, created_at, metadata')
      .eq('id', thread_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return { id: thread_id, title: 'New Chat', created_at: new Date(), status: { type: 'active' }, metadata: {} };
    }
    const created = typeof data.created_at === 'number' ? new Date(data.created_at * 1000) : new Date();
    const metadata = data.metadata || {};
    return { id: data.id, title: metadata.title || 'New Chat', created_at: created, status: metadata.status || { type: 'active' }, metadata };
  }

  async load_thread_items(thread_id: string, after: string | null, limit: number, order: 'asc' | 'desc', context?: TContext | null): Promise<Page<ThreadItem>> {
    if (!context) throw new Error('Missing request context');
    const supabase = context.supabase;
    let q = supabase
      .from('thread_messages')
      .select('id, message_index, role, content, created_at')
      .eq('thread_id', thread_id);

    if (after !== null && after !== undefined) {
      const afterIdx = Number(after);
      if (order === 'asc') q = q.gt('message_index', afterIdx);
      else q = q.lt('message_index', afterIdx);
    }

    const effectiveLimit = Math.max(1, Math.min(limit || 50, 200));
    q = q.order('message_index', { ascending: order === 'asc' }).limit(effectiveLimit + 1);
    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];
    const has_more = rows.length > effectiveLimit;
    const page = rows.slice(0, effectiveLimit);
    const next_after = page.length ? String(page[page.length - 1].message_index) : null;

    const items: ThreadItem[] = page.map((r) => {
      const created = typeof r.created_at === 'number' ? new Date(r.created_at * 1000) : new Date();
      if (r.role === 'user') {
        return { type: 'user_message', id: r.id, thread_id, created_at: created, content: [{ type: 'input_text', text: r.content }], attachments: [], quoted_text: null, inference_options: {} };
      }
      return { type: 'assistant_message', id: r.id, thread_id, created_at: created, content: [{ type: 'output_text', text: r.content }] };
    });

    return { data: items, has_more, after: next_after };
  }

  async load_threads(limit: number, after: string | null, order: 'asc' | 'desc', context?: TContext | null): Promise<Page<ThreadMetadata>> {
    if (!context) throw new Error('Missing request context');
    if (!context.user_id) throw new Error("Missing user_id (supply 'x-user-id' header for anonymous users)");
    const supabase = context.supabase;
    let q = supabase.from('threads').select('id, user_id, created_at, metadata').eq('user_id', context.user_id);

    if (after !== null && after !== undefined) {
      const afterTs = Number(after);
      if (order === 'asc') q = q.gt('created_at', afterTs);
      else q = q.lt('created_at', afterTs);
    }

    q = q.order('created_at', { ascending: order === 'asc' }).limit((limit || 20) + 1);
    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];
    const has_more = rows.length > (limit || 20);
    const page = rows.slice(0, limit || 20);
    const next_after = page.length ? String(page[page.length - 1].created_at) : null;

    const out: ThreadMetadata[] = page.map((row) => {
      const created = typeof row.created_at === 'number' ? new Date(row.created_at * 1000) : new Date();
      const metadata = row.metadata || {};
      return { id: row.id, title: metadata.title || 'New Chat', created_at: created, status: metadata.status || { type: 'active' }, metadata };
    });
    return { data: out, has_more, after: next_after };
  }

  async save_thread(thread: ThreadMetadata, context?: TContext | null): Promise<void> {
    if (!context) throw new Error('Missing request context');
    if (!context.user_id) throw new Error("Missing user_id (supply 'x-user-id' header for anonymous users)");
    const supabase = context.supabase;
    const created_ts = Math.floor((thread.created_at instanceof Date ? thread.created_at : new Date()).getTime() / 1000);
    const payload = { id: thread.id, user_id: context.user_id, created_at: created_ts, metadata: thread.metadata || {}, object: 'thread' } as any;
    const { error } = await supabase.from('threads').upsert(payload);
    if (error) throw error;
  }
}

export class BlobStorageStore implements AttachmentStore<TContext> {
  constructor(private data_store: Store<TContext>) {}
  async delete_attachment(_attachment_id: string, _context?: TContext | null): Promise<void> {
    throw new Error('delete_attachment is not implemented');
  }
  generate_attachment_id(_mime_type: string, _context: TContext): string {
    throw new Error('generate_attachment_id is not implemented');
  }
}


