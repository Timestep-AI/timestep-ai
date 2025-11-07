import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ThreadMetadata, ThreadItem, Page } from './chatkit/types.ts';
import type { Store, AttachmentStore } from './chatkit/store.ts';
import OpenAI from 'openai';

export type TContext = {
  supabase: SupabaseClient;
  user_id: string | null;
  user_jwt: string | null;
  agent_id?: string | null;
};

/**
 * ChatKit Data Store implementation using OpenAI ChatKit API via OpenAI client.
 * This store calls the ChatKit API endpoints in the openai-polyfill edge function.
 */
export class ChatKitDataStore implements Store<TContext> {
  private base_url: string;

  constructor() {
    // Point to our Supabase edge function that implements ChatKit API
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321';
    this.base_url = `${supabaseUrl}/functions/v1/openai-polyfill`;
  }

  private _get_client(context: TContext | null): OpenAI {
    const api_key = context?.user_jwt || 'dummy-key';
    return new OpenAI({
      apiKey: api_key,
      baseURL: this.base_url,
      defaultHeaders: {
        'OpenAI-Beta': 'chatkit_beta=v1',
      },
    });
  }

  static generate_thread_id(_context?: TContext | null): string {
    return `cthr_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
  }

  generate_thread_id(context?: TContext | null): string {
    return ChatKitDataStore.generate_thread_id(context);
  }

  generate_item_id(_item_type: string, _thread: ThreadMetadata, _context?: TContext | null): string {
    const timestamp = Date.now();
    const random_str = crypto.randomUUID().replace(/-/g, '').substring(0, 6);
    return `cthi_${timestamp}_${random_str}`;
  }

  async add_thread_item(thread_id: string, item: ThreadItem, context?: TContext | null): Promise<void> {
    if (!context) throw new Error('Missing request context');
    if (!context.user_id) throw new Error('Missing user_id');

    const client = this._get_client(context);

    // CUSTOM: Ensure thread exists
    try {
      await client.post(`/chatkit/threads/${thread_id}/ensure`, { body: null });
    } catch (e) {
      throw new Error(`Failed to ensure thread: ${e}`);
    }

    // CUSTOM: Get next item index
    let next_index: number;
    try {
      const result: any = await client.post(`/chatkit/threads/${thread_id}/next_index`, { body: null });
      next_index = result.next_index;
    } catch (e) {
      throw new Error(`Failed to get next index: ${e}`);
    }

    // Serialize item to ChatKit format
    const item_data = this._serialize_thread_item(item);

    // CUSTOM: Add thread item
    try {
      await client.post(`/chatkit/threads/${thread_id}/items`, {
        body: {
          id: item.id,
          created_at: Math.floor(item.created_at.getTime() / 1000),
          type: item_data.type,
          data: item_data,
          item_index: next_index,
        },
      });
    } catch (e) {
      throw new Error(`Failed to add thread item: ${e}`);
    }
  }

  private _serialize_thread_item(item: ThreadItem): any {
    if (item.type === 'user_message') {
      const result: any = {
        type: 'chatkit.user_message',
        content: Array.isArray(item.content)
          ? item.content.filter((p: any) => p?.text).map((p: any) => ({ type: 'input_text', text: p.text }))
          : [],
        attachments: item.attachments || [],
      };
      if (item.inference_options) {
        result.inference_options = item.inference_options;
      }
      return result;
    } else if (item.type === 'assistant_message') {
      return {
        type: 'chatkit.assistant_message',
        content: Array.isArray(item.content)
          ? item.content.filter((p: any) => p?.text).map((p: any) => ({ type: 'output_text', text: p.text }))
          : [],
      };
    } else if (item.type === 'client_tool_call') {

      // isinstance(item.arguments, dict) is True only for dicts, not for arrays, None, etc.
      const arguments_value = (item as any).arguments;
      const serialized_arguments = (arguments_value && typeof arguments_value === 'object' && !Array.isArray(arguments_value) && arguments_value !== null)
        ? JSON.stringify(arguments_value)
        : arguments_value;

      const output_value = (item as any).output;
      const serialized_output = (output_value && typeof output_value === 'object' && !Array.isArray(output_value) && output_value !== null)
        ? JSON.stringify(output_value)
        : output_value;

      return {
        type: 'chatkit.client_tool_call',
        status: (item as any).status,
        call_id: (item as any).call_id,
        name: (item as any).name,
        arguments: serialized_arguments,
        output: serialized_output,
      };
    } else {
      throw new Error(`Unsupported item type: ${item.type}`);
    }
  }

  private _deserialize_thread_item(item_data: any): ThreadItem {
    const item_type = item_data.type;
    const item_id = item_data.id;
    const thread_id = item_data.thread_id;

    const created_at = new Date((item_data.created_at || Date.now() / 1000) * 1000);

    if (item_type === 'chatkit.user_message') {
      const content = (item_data.content || [])
        .filter((p: any) => p?.type === 'input_text')
        .map((p: any) => ({ type: 'input_text', text: p.text }));

      const inference_options_data = item_data.inference_options;
      let inference_options: any = null;
      if (inference_options_data) {
        if (typeof inference_options_data === 'object' && !Array.isArray(inference_options_data)) {

          inference_options = inference_options_data;
        } else {
          inference_options = inference_options_data;
        }
      }

      return {
        type: 'user_message',
        id: item_id,
        thread_id,
        created_at,
        content,
        attachments: item_data.attachments || [],
        quoted_text: null,
        inference_options,
      };
    } else if (item_type === 'chatkit.assistant_message') {
      const content = (item_data.content || [])
        .filter((p: any) => p?.type === 'output_text')
        .map((p: any) => ({
          type: 'output_text',
          text: p.text ?? '',
          annotations: Array.isArray(p.annotations) ? p.annotations : [],
        }));

      return {
        type: 'assistant_message',
        id: item_id,
        thread_id,
        created_at,
        content,
      };
    } else if (item_type === 'chatkit.client_tool_call') {
      let arguments_obj = item_data.arguments || '{}';
      if (typeof arguments_obj === 'string') {
        try {
          arguments_obj = JSON.parse(arguments_obj);
        } catch {
          arguments_obj = {};
        }
      }

      let output_obj = item_data.output;
      if (output_obj && typeof output_obj === 'string') {
        try {
          output_obj = JSON.parse(output_obj);
        } catch {
          // keep as string
        }
      }

      return {
        type: 'client_tool_call',
        id: item_id,
        thread_id,
        created_at,
        status: item_data.status || 'pending',
        call_id: item_data.call_id || '',
        name: item_data.name || '',
        arguments: arguments_obj,
        output: output_obj,
      } as any;
    } else {
      throw new Error(`Unsupported item type: ${item_type}`);
    }
  }

  async load_thread(thread_id: string, context?: TContext | null): Promise<ThreadMetadata> {
    if (!context) throw new Error('Missing request context');

    const client = this._get_client(context);

    try {
      const thread = await client.beta.chatkit.threads.retrieve(thread_id);
      return {
        id: thread.id,
        created_at: new Date(thread.created_at * 1000),
        status: { type: 'active' } as const,
        metadata: {},
      };
    } catch (e: any) {
      if (e?.status === 404 || e?.message?.includes('404')) {
        throw new Error('Thread not found');
      }
      throw e;
    }
  }

  async load_thread_items(thread_id: string, after: string | null, limit: number, order: 'asc' | 'desc', context?: TContext | null): Promise<Page<ThreadItem>> {
    if (!context) throw new Error('Missing request context');

    const client = this._get_client(context);

    try {
      const params: any = {
        limit,
        order,
      };
      if (after) {
        params.after = after;
      }

      const response = await client.beta.chatkit.threads.listItems(thread_id, params);

      const items = response.data.map((item: any) => this._deserialize_thread_item(item));

      return {
        data: items,
        has_more: response.has_more,
        after: response.last_id || null,
      };
    } catch (e: any) {
      if (e?.status === 404 || e?.message?.includes('404')) {
        throw new Error('Thread not found');
      }
      throw e;
    }
  }

  async load_threads(limit: number, after: string | null, order: 'asc' | 'desc', context?: TContext | null): Promise<Page<ThreadMetadata>> {
    if (!context) throw new Error('Missing request context');

    const client = this._get_client(context);

    const params: any = {
      limit,
      order,
    };
    if (after) {
      params.after = after;
    }

    const response = await client.beta.chatkit.threads.list(params);

    const threads = response.data.map((t: any) => ({
      id: t.id,
      created_at: new Date(t.created_at * 1000),
      status: { type: 'active' } as const,
      metadata: {},
    }));

    return {
      data: threads,
      has_more: response.has_more,
      after: response.last_id || null,
    };
  }

  async save_thread(_thread: ThreadMetadata, _context?: TContext | null): Promise<void> {
    // Threads are auto-created when adding items
  }

  async save_item(thread_id: string, item: ThreadItem, context?: TContext | null): Promise<void> {
    if (!context) throw new Error('Missing request context');

    const client = this._get_client(context);
    const item_data = this._serialize_thread_item(item);

    // CUSTOM: Update thread item
    try {
      await client.put(`/chatkit/threads/${thread_id}/items/${item.id}`, {
        body: { data: item_data },
      });
    } catch (e) {
      throw new Error(`Failed to update thread item: ${e}`);
    }
  }

  async delete_thread_item(thread_id: string, item_id: string, context?: TContext | null): Promise<void> {
    if (!context) throw new Error('Missing request context');

    const client = this._get_client(context);

    // CUSTOM: Delete thread item
    try {
      await client.delete(`/chatkit/threads/${thread_id}/items/${item_id}`);
    } catch (e) {
      throw new Error(`Failed to delete thread item: ${e}`);
    }
  }

  async delete_attachment(_attachment_id: string, _context?: TContext | null): Promise<void> {
    throw new Error('Attachments not yet supported');
  }

  async delete_thread(_thread_id: string, _context?: TContext | null): Promise<void> {
    throw new Error('delete_thread not yet implemented');
  }

  async load_attachment(_attachment_id: string, _context?: TContext | null): Promise<any> {
    throw new Error('Attachments not yet supported');
  }

  async load_item(_thread_id: string, _item_id: string, _context?: TContext | null): Promise<ThreadItem> {
    throw new Error('load_item not yet implemented');
  }

  async save_attachment(_attachment_id: string, _data: any, _context?: TContext | null): Promise<void> {
    throw new Error('Attachments not yet supported');
  }
}

export class ChatKitAttachmentStore implements AttachmentStore<TContext> {
  constructor(private data_store: Store<TContext>) {}

  async delete_attachment(_attachment_id: string, _context?: TContext | null): Promise<void> {
    throw new Error('Attachments not yet supported');
  }

  generate_attachment_id(_context?: TContext | null): string {
    return `attach_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
  }

  async load_attachment(_attachment_id: string, _context?: TContext | null): Promise<any> {
    throw new Error('Attachments not yet supported');
  }

  async save_attachment(_attachment_id: string, _data: any, _context?: TContext | null): Promise<void> {
    throw new Error('Attachments not yet supported');
  }
}
