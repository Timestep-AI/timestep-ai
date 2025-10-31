import type { TContext } from '../stores.ts';
import type { ThreadMetadata, ThreadStreamEvent, Thread, UserMessageItem, ThreadItem, Page } from './types.ts';
import type { Store, AttachmentStore } from './store.ts';

export class StreamingResult {
  constructor(public json_events: AsyncIterable<Uint8Array>) {}
}

export class NonStreamingResult {
  constructor(public json: Uint8Array) {}
}

export class ChatKitServer<TCtx = TContext> {
  constructor(public store: Store<TCtx>, public attachment_store?: AttachmentStore<TCtx> | null) {}

  async process(requestBody: Uint8Array, context: TCtx): Promise<StreamingResult | NonStreamingResult> {
    const text = new TextDecoder().decode(requestBody);
    const req = JSON.parse(text);
    const encoder = new TextEncoder();

    if (this._is_streaming_req(req)) {
      const stream = this._process_streaming(req, context);
      return new StreamingResult((async function* () {
        for await (const event of stream) {
          yield encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
        }
      })());
    } else {
      const json = await this._process_non_streaming(req, context);
      return new NonStreamingResult(encoder.encode(JSON.stringify(json)));
    }
  }

  protected _is_streaming_req(req: { type: string }): boolean {
    return [
      'threads.create',
      'threads.add_user_message',
      'threads.action',
      'threads.custom_action',
      'threads.retry_after_item',
      'threads.add_client_tool_output',
    ].includes(req.type);
  }

  private async _process_non_streaming(req: any, context: TCtx): Promise<any> {
    switch (req.type) {
      case 'threads.get_by_id': {
        const thread = await this._load_full_thread(req.params.thread_id, context);
        return this._to_thread_response(thread);
      }
      case 'threads.list': {
        const page = await this.store.load_threads(
          req.params.limit || 20,
          req.params.after || null,
          req.params.order || 'desc',
          context,
        );
        return {
          has_more: page.has_more,
          after: page.after,
          data: page.data.map((t: ThreadMetadata) => this._to_thread_response(t)),
        } as Page<Thread>;
      }
      case 'items.feedback': {
        await this.add_feedback(req.params.thread_id, req.params.item_ids, req.params.kind, context);
        return {};
      }
      case 'attachments.create': {
        if (!this.attachment_store || !this.attachment_store.create_attachment) throw new Error('AttachmentStore is not configured');
        return await this.attachment_store.create_attachment(req.params, context);
      }
      case 'attachments.delete': {
        if (!this.attachment_store || !this.attachment_store.delete_attachment) throw new Error('AttachmentStore is not configured');
        await this.attachment_store.delete_attachment(req.params.attachment_id, context);
        if (this.store.delete_attachment) await this.store.delete_attachment(req.params.attachment_id, context as any);
        return {};
      }
      case 'items.list': {
        return await this.store.load_thread_items(
          req.params.thread_id,
          req.params.after || null,
          req.params.limit || 20,
          req.params.order || 'asc',
          context,
        );
      }
      case 'threads.update': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        thread.title = req.params.title;
        await this.store.save_thread(thread, context);
        return this._to_thread_response(thread);
      }
      case 'threads.delete': {
        if (this.store.delete_thread) await this.store.delete_thread(req.params.thread_id, context as any);
        return {};
      }
      default:
        throw new Error(`Unknown request type: ${req.type}`);
    }
  }

  async *_process_streaming(req: any, context: TCtx): AsyncIterable<ThreadStreamEvent> {
    switch (req.type) {
      case 'threads.create': {
        const thread: ThreadMetadata = { id: this.store.generate_thread_id(context), created_at: new Date(), status: { type: 'active' }, metadata: {} };
        await this.store.save_thread(thread, context);
        yield { type: 'thread.created', thread: this._to_thread_response(thread) };
        const userMessage = await this._build_user_message_item(req.params?.input, thread, context);
        yield* this._process_new_thread_item_respond(thread, userMessage, context);
        break;
      }
      case 'threads.add_user_message': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        const userMessage = await this._build_user_message_item(req.params?.input, thread, context);
        yield* this._process_new_thread_item_respond(thread, userMessage, context);
        break;
      }
      case 'threads.retry_after_item': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        // Remove all items after the selected user message, then re-run
        for await (const item of this._paginate_thread_items_reverse(req.params.thread_id, context)) {
          if (item.id === req.params.item_id) break;
          if (this.store.delete_thread_item) await this.store.delete_thread_item(req.params.thread_id, item.id, context as any);
        }
        yield* this._process_events(thread, context, () => this.respond(thread, req.params.user_message as UserMessageItem, context));
        break;
      }
      case 'threads.action':
      case 'threads.custom_action': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        yield* this._process_events(thread, context, () => this.action(thread, req.params.action, null, context));
        break;
      }
      default:
        yield { type: 'error', code: 'STREAM_ERROR', allow_retry: true };
    }
  }

  async *_process_new_thread_item_respond(thread: ThreadMetadata, item: UserMessageItem, context: TCtx): AsyncIterable<ThreadStreamEvent> {
    await this.store.add_thread_item(thread.id, item, context);
    yield { type: 'thread.item.done', item };
    yield* this._process_events(thread, context, () => this.respond(thread, item, context));
  }

  async _build_user_message_item(input: any, thread: ThreadMetadata, context: TCtx): Promise<UserMessageItem> {
    const contentArray = Array.isArray(input?.content) ? input.content : [{ type: 'input_text', text: input?.content?.text || '' }];
    return {
      type: 'user_message',
      id: this.store.generate_item_id('message', thread, context),
      content: contentArray,
      thread_id: thread.id,
      attachments: [],
      quoted_text: input?.quoted_text || null,
      inference_options: input?.inference_options || {},
      created_at: new Date(),
    } as UserMessageItem;
  }

  _to_thread_response(thread: ThreadMetadata | Thread): Thread {
    if ((thread as any).items) return thread as Thread;
    return { id: thread.id, title: thread.title, created_at: thread.created_at, status: thread.status, metadata: thread.metadata, items: { data: [], has_more: false, after: null } } as Thread;
  }

  protected async *_paginate_thread_items_reverse(threadId: string, context: TCtx): AsyncIterable<ThreadItem> {
    let after: string | null = null;
    while (true) {
      const items = await this.store.load_thread_items(threadId, after, 20, 'desc', context);
      for (const item of items.data) yield item;
      if (!items.has_more) break;
      after = items.after;
    }
  }

  protected async _load_full_thread(threadId: string, context: TCtx): Promise<Thread> {
    const meta = await this.store.load_thread(threadId, context);
    const items = await this.store.load_thread_items(threadId, null, 20, 'asc', context);
    return { id: meta.id, title: meta.title, created_at: meta.created_at, status: meta.status, metadata: meta.metadata, items } as unknown as Thread;
  }

  protected async * _process_events(
    thread: ThreadMetadata,
    context: TCtx,
    stream: () => AsyncIterable<ThreadStreamEvent>,
  ): AsyncIterable<ThreadStreamEvent> {
    try {
      for await (const event of stream()) {
        yield event;
      }
    } catch (_e) {
      yield { type: 'error', code: 'STREAM_ERROR', allow_retry: true } as any;
    }
  }

  async add_feedback(_thread_id: string, _item_ids: string[], _feedback: unknown, _context: TCtx): Promise<void> {}

  async *action(_thread: ThreadMetadata, _action: any, _sender: any, _context: TCtx): AsyncIterable<ThreadStreamEvent> {
    throw new Error('The action() method must be overridden to react to actions.');
  }

  // To be overridden by subclass
  async *respond(_thread: ThreadMetadata, _input: UserMessageItem, _context: TCtx): AsyncIterable<ThreadStreamEvent> { yield* []; }
}


