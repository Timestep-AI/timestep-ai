import type { ThreadMetadata, ThreadStreamEvent, Thread, UserMessageItem, ThreadItem, Page, WidgetItem, WidgetRootUpdated, WidgetComponentUpdated, WidgetStreamingTextValueDelta, HiddenContextItem } from './types.ts';
import type { Store, AttachmentStore, StoreItemType } from './store.ts';
import { ErrorCode, CustomStreamError, StreamError } from './errors.ts';
import { default_generate_id } from './store.ts';
import type { WidgetComponent, Markdown, Text, WidgetRoot } from './widgets.ts';
import type { Action } from './actions.ts';
import { logger } from './logger.ts';

type TContext = any;

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_ERROR_MESSAGE = "An error occurred when generating a response.";

export function diff_widget(
  before: WidgetRoot,
  after: WidgetRoot
): Array<WidgetStreamingTextValueDelta | WidgetRootUpdated | WidgetComponentUpdated> {
  /**
   * Compare two WidgetRoots and return a list of deltas.
   */
  
  function full_replace(before: WidgetComponent, after: WidgetComponent): boolean {
    if (
      before.type !== after.type ||
      before.id !== after.id ||
      before.key !== after.key
    ) {
      return true;
    }

    function full_replace_value(beforeValue: any, afterValue: any): boolean {
      if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
        if (beforeValue.length !== afterValue.length) {
          return true;
        }
        for (let i = 0; i < beforeValue.length; i++) {
          if (full_replace_value(beforeValue[i], afterValue[i])) {
            return true;
          }
        }
      } else if (beforeValue !== afterValue) {
        if (beforeValue && typeof beforeValue === 'object' && 'type' in beforeValue &&
            afterValue && typeof afterValue === 'object' && 'type' in afterValue) {
          return full_replace(beforeValue as WidgetComponent, afterValue as WidgetComponent);
        } else {
          return true;
        }
      }
      return false;
    }

    // Check all fields that exist in either object
    const allFields = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const field of allFields) {
      if ((before as any).type === 'Markdown' || (before as any).type === 'Text') {
        if ((after as any).type === 'Markdown' || (after as any).type === 'Text') {
          if (field === 'value' && (after as any).value?.startsWith((before as any).value || '')) {
            // Appends to the value prop of Markdown or Text do not trigger a full replace
            continue;
          }
        }
      }
      if (full_replace_value((before as any)[field], (after as any)[field])) {
        return true;
      }
    }

    return false;
  }

  if (full_replace(before as unknown as WidgetComponent, after as unknown as WidgetComponent)) {
    return [{ type: 'widget.root.updated', widget: after }];
  }

  const deltas: Array<WidgetStreamingTextValueDelta | WidgetComponentUpdated | WidgetRootUpdated> = [];

  function find_all_streaming_text_components(
    component: WidgetComponent | WidgetRoot
  ): Record<string, Markdown | Text> {
    const components: Record<string, Markdown | Text> = {};

    function recurse(comp: WidgetComponent | WidgetRoot) {
      if ((comp.type === 'Markdown' || comp.type === 'Text') && comp.id) {
        components[comp.id] = comp as Markdown | Text;
      }

      if ('children' in comp && comp.children) {
        const children = Array.isArray(comp.children) ? comp.children : [];
        for (const child of children) {
          recurse(child);
        }
      }
    }

    recurse(component);
    return components;
  }

  const beforeNodes = find_all_streaming_text_components(before);
  const afterNodes = find_all_streaming_text_components(after);

  for (const [id, afterNode] of Object.entries(afterNodes)) {
    const beforeNode = beforeNodes[id];
    if (!beforeNode) {
      throw new Error(
        `Node ${id} was not present when the widget was initially rendered. All nodes with ID must persist across all widget updates.`
      );
    }

    if (beforeNode.value !== afterNode.value) {
      if (!afterNode.value.startsWith(beforeNode.value)) {
        throw new Error(
          `Node ${id} was updated with a new value that is not a prefix of the initial value. All widget updates must be cumulative.`
        );
      }
      const done = !afterNode.streaming;
      deltas.push({
        type: 'widget.streaming_text.value_delta',
        component_id: id,
        delta: afterNode.value.substring(beforeNode.value.length),
        done: done,
      });
    }
  }

  return deltas;
}

export async function* stream_widget(
  thread: ThreadMetadata,
  widget: WidgetRoot | AsyncGenerator<WidgetRoot, void>,
  copy_text: string | null = null,
  generate_id: (item_type: StoreItemType) => string = default_generate_id,
): AsyncIterable<ThreadStreamEvent> {
  const item_id = generate_id("message");

  // Check if widget is a generator
  const isAsyncGenerator = typeof (widget as any)[Symbol.asyncIterator] === 'function';
  
  if (!isAsyncGenerator) {
    yield {
      type: 'thread.item.done',
      item: {
        id: item_id,
        thread_id: thread.id,
        created_at: new Date(),
        type: 'widget',
        widget: widget as WidgetRoot,
        copy_text: copy_text,
      } as WidgetItem,
    };
    return;
  }

  const widgetGen = widget as AsyncGenerator<WidgetRoot, void>;
  const initialResult = await widgetGen.next();
  if (initialResult.done) {
    return;
  }
  const initial_state = initialResult.value;

  const item: WidgetItem = {
    id: item_id,
    created_at: new Date(),
    widget: initial_state,
    copy_text: copy_text,
    thread_id: thread.id,
    type: 'widget',
  };

  yield { type: 'thread.item.added', item };

  let last_state = initial_state;

  while (true) {
    try {
      const nextResult = await widgetGen.next();
      if (nextResult.done) {
        break;
      }
      const new_state = nextResult.value;
      for (const update of diff_widget(last_state, new_state)) {
        yield {
          type: 'thread.item.updated',
          item_id: item_id,
          update: update,
        };
      }
      last_state = new_state;
    } catch (e) {
      if (e instanceof Error && e.name === 'StopAsyncIteration') {
        break;
      }
      throw e;
    }
  }

  yield {
    type: 'thread.item.done',
    item: {
      ...item,
      widget: last_state,
    } as WidgetItem,
  };
}

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
    
    logger.info(`Received request op: ${req.type}`);

    if (this._is_streaming_req(req)) {
      const stream = this._process_streaming(req, context);
      return new StreamingResult((async function* () {
        try {
          for await (const event of stream) {
            // Serialize event with proper date handling
            // Date objects serialize to ISO format without timezone: "2025-11-03T18:10:07.829180"
            // NOT with Z timezone like JavaScript's toISOString(): "2025-11-04T02:07:12.171Z"
            const serialized = JSON.stringify(event, (key, value) => {
              // Convert Date objects to ISO strings without timezone
              if (value instanceof Date) {
                // Format as YYYY-MM-DDTHH:mm:ss.sss (no Z timezone)
                const iso = value.toISOString();
                // Remove the 'Z' timezone suffix
                return iso.replace('Z', '');
              }
              return value;
            });
            
            // Log thread.item.done events for debugging (especially client_tool_call items)
            if (event.type === 'thread.item.done') {
              const item = (event as any).item;
              if (item?.type === 'client_tool_call') {
                logger.info('[ChatKitServer] Emitting client_tool_call item in thread.item.done event');
                logger.info('[ChatKitServer] Full serialized event:', serialized);
              }
            }
            
            yield encoder.encode(`data: ${serialized}\n\n`);
          }
        } catch (e) {
          logger.exception("Error while generating streamed response", e as Error);
          throw e;
        }
      })());
    } else {
      const json = await this._process_non_streaming(req, context);
      // Serialize with proper date handling
      // Date objects serialize to ISO format without timezone: "2025-11-03T18:10:07.829180"
      // NOT with Z timezone like JavaScript's toISOString(): "2025-11-04T02:07:12.171Z"
      const serialized = JSON.stringify(json, (key, value) => {
        // Convert Date objects to ISO strings without timezone
        if (value instanceof Date) {
          const iso = value.toISOString();
          // Remove the 'Z' timezone suffix
          return iso.replace('Z', '');
        }
        return value;
      });
      return new NonStreamingResult(encoder.encode(serialized));
    }
  }

  protected _is_streaming_req(req: { type: string }): boolean {
    return [
      'threads.create',
      'threads.add_user_message',
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
        const params = req.params;
        const page = await this.store.load_threads(
          params.limit || DEFAULT_PAGE_SIZE,
          params.after || null,
          params.order || 'desc',
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
        const attachment_store = this._get_attachment_store();
        return await attachment_store.create_attachment!(req.params, context);
      }
      case 'attachments.delete': {
        const attachment_store = this._get_attachment_store();
        await attachment_store.delete_attachment(req.params.attachment_id, context);
        await this.store.delete_attachment(req.params.attachment_id, context);
        return {};
      }
      case 'items.list': {
        const items = await this.store.load_thread_items(
          req.params.thread_id,
          req.params.after || null,
          req.params.limit || DEFAULT_PAGE_SIZE,
          req.params.order || 'asc',
          context,
        );
        // filter out HiddenContextItems
        items.data = items.data.filter((item: ThreadItem) => item.type !== 'hidden_context_item');
        return items;
      }
      case 'threads.update': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        thread.title = req.params.title;
        await this.store.save_thread(thread, context);
        return this._to_thread_response(thread);
      }
      case 'threads.delete': {
        await this.store.delete_thread(req.params.thread_id, context);
        return {};
      }
      default: {
        const _exhaustive: never = req as never;
        throw new Error(`Unknown request type: ${(_exhaustive as any).type}`);
      }
    }
  }

  async *_process_streaming(req: any, context: TCtx): AsyncIterable<ThreadStreamEvent> {
    switch (req.type) {
      case 'threads.create': {
        const thread: Thread = { 
          id: this.store.generate_thread_id(context), 
          created_at: new Date(), 
          status: { type: 'active' }, 
          metadata: {},
          items: { data: [], has_more: false, after: null }
        };
        const threadMetadata: ThreadMetadata = {
          id: thread.id,
          created_at: thread.created_at,
          status: thread.status,
          metadata: thread.metadata,
          title: thread.title,
        };
        await this.store.save_thread(threadMetadata, context);
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
        // Collect items to remove (all items after the user message)
        const itemsToRemove: ThreadItem[] = [];
        let userMessageItem: UserMessageItem | null = null;

        for await (const item of this._paginate_thread_items_reverse(req.params.thread_id, context)) {
          if (item.id === req.params.item_id) {
            if (item.type !== 'user_message') {
              throw new Error(`Item ${req.params.item_id} is not a user message`);
            }
            userMessageItem = item as UserMessageItem;
            break;
          }
          itemsToRemove.push(item);
        }

        if (userMessageItem) {
          for (const item of itemsToRemove) {
            await this.store.delete_thread_item(req.params.thread_id, item.id, context);
          }
          yield* this._process_events(thread, context, () => this.respond(thread, userMessageItem!, context));
        }
        break;
      }
      case 'threads.custom_action': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        let item: ThreadItem | null = null;
        if (req.params.item_id) {
          item = await this.store.load_item(req.params.thread_id, req.params.item_id, context);
        }

        if (item && item.type !== 'widget') {
          // shouldn't happen if the caller is using the API correctly.
          yield { 
            type: 'error', 
            code: ErrorCode.STREAM_ERROR, 
            allow_retry: false 
          };
          break;
        }

        yield* this._process_events(thread, context, () => this.action(thread, req.params.action, item as WidgetItem | null, context));
        break;
      }
      case 'threads.add_client_tool_output': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        const items = await this.store.load_thread_items(thread.id, null, 1, 'desc', context);
        const toolCall = items.data.find((item: ThreadItem) => {
          const typedItem = item as { type: string; status?: string };
          return typedItem.type === 'client_tool_call' && typedItem.status === 'pending';
        });

        if (!toolCall) {
          throw new Error(`Last thread item in ${thread.id} was not a ClientToolCallItem`);
        }

        const typedToolCall = toolCall as { output?: unknown; status: string };
        typedToolCall.output = req.params.result;
        typedToolCall.status = 'completed';

        await this.store.save_item(thread.id, toolCall, context);

        // Safety against dangling pending tool calls if there are
        // multiple in a row, which should be impossible, and
        // integrations should ultimately filter out pending tool calls
        // when creating input response messages.
        await this._cleanup_pending_client_tool_call(thread, context);

        yield* this._process_events(thread, context, () => this.respond(thread, null, context));
        break;
      }
      default: {
        const _exhaustive: never = req as never;
        throw new Error(`Unknown request type: ${(_exhaustive as any).type}`);
      }
    }
  }

  async *_process_new_thread_item_respond(thread: ThreadMetadata, item: UserMessageItem, context: TCtx): AsyncIterable<ThreadStreamEvent> {
    await this.store.add_thread_item(thread.id, item, context);
    await this._cleanup_pending_client_tool_call(thread, context);
    yield { type: 'thread.item.done', item };
    yield* this._process_events(thread, context, () => this.respond(thread, item, context));
  }

  async _build_user_message_item(input: any, thread: ThreadMetadata, context: TCtx): Promise<UserMessageItem> {
    const contentArray = Array.isArray(input?.content) ? input.content : [{ type: 'input_text', text: input?.content?.text || '' }];
    const attachments = await Promise.all(
      (input?.attachments || []).map((attachment_id: string) => this.store.load_attachment(attachment_id, context))
    );
    return {
      type: 'user_message',
      id: this.store.generate_item_id('message', thread, context),
      content: contentArray,
      thread_id: thread.id,
      attachments: attachments,
      quoted_text: input?.quoted_text || null,
      inference_options: input?.inference_options || {},
      created_at: new Date(),
    } as UserMessageItem;
  }

  _to_thread_response(thread: ThreadMetadata | Thread): Thread {
    const is_hidden = (item: ThreadItem) => item.type === 'hidden_context_item';
    const items = (thread as any).items || { data: [], has_more: false, after: null };
    items.data = items.data.filter((item: ThreadItem) => !is_hidden(item));
    return {
      id: thread.id,
      title: thread.title,
      created_at: thread.created_at,
      items: items,
      status: thread.status,
    } as Thread;
  }

  protected async *_paginate_thread_items_reverse(threadId: string, context: TCtx): AsyncIterable<ThreadItem> {
    /**Paginate through thread items in reverse order (newest first).*/
    let after: string | null = null;
    while (true) {
      const items = await this.store.load_thread_items(threadId, after, DEFAULT_PAGE_SIZE, 'desc', context);
      for (const item of items.data) yield item;
      if (!items.has_more) break;
      after = items.after;
    }
  }

  protected async _load_full_thread(threadId: string, context: TCtx): Promise<Thread> {
    const meta = await this.store.load_thread(threadId, context);
    const items = await this.store.load_thread_items(threadId, null, DEFAULT_PAGE_SIZE, 'asc', context);
    return { ...meta, items } as unknown as Thread;
  }

  protected async _cleanup_pending_client_tool_call(thread: ThreadMetadata, context: TCtx): Promise<void> {
    const items = await this.store.load_thread_items(thread.id, null, DEFAULT_PAGE_SIZE, 'desc', context);
    for (const tool_call of items.data) {
      if ((tool_call as any).type !== 'client_tool_call') {
        continue;
      }
      const typedToolCall = tool_call as { status?: string; call_id?: string; id: string };
      if (typedToolCall.status === 'pending') {
        logger.warn(`Client tool call ${typedToolCall.call_id} was not completed, ignoring`);
        await this.store.delete_thread_item(thread.id, typedToolCall.id, context);
      }
    }
  }

  protected async * _process_events(
    thread: ThreadMetadata,
    context: TCtx,
    stream: () => AsyncIterable<ThreadStreamEvent>,
  ): AsyncIterable<ThreadStreamEvent> {
    await new Promise(resolve => setTimeout(resolve, 0)); // allow the response to start streaming
    
    let lastThread = JSON.parse(JSON.stringify(thread)) as ThreadMetadata;

    try {
      for await (const event of stream()) {
        if (event.type === 'thread.item.done') {
          const item = (event as any).item;
          await this.store.add_thread_item(thread.id, item, context);
        } else if (event.type === 'thread.item.removed') {
          await this.store.delete_thread_item(thread.id, (event as any).item_id, context);
        } else if (event.type === 'thread.item.replaced') {
          await this.store.save_item(thread.id, (event as any).item, context);
        }

        // special case - don't send hidden context items back to the client
        const shouldSwallowEvent = event.type === 'thread.item.done' && 
          (event as any).item?.type === 'hidden_context_item';

        if (!shouldSwallowEvent) {
          yield event;
        }

        // in case user updated the thread while streaming
        const threadStr = JSON.stringify(thread);
        const lastThreadStr = JSON.stringify(lastThread);
        if (threadStr !== lastThreadStr) {
          lastThread = JSON.parse(JSON.stringify(thread)) as ThreadMetadata;
          await this.store.save_thread(thread, context);
          yield { type: 'thread.updated', thread: this._to_thread_response(thread) };
        }
      }
      
      // in case user updated the thread while streaming
      const threadStr = JSON.stringify(thread);
      const lastThreadStr = JSON.stringify(lastThread);
      if (threadStr !== lastThreadStr) {
        lastThread = JSON.parse(JSON.stringify(thread)) as ThreadMetadata;
        await this.store.save_thread(thread, context);
        yield { type: 'thread.updated', thread: this._to_thread_response(thread) };
      }
    } catch (e: any) {
      if (e instanceof CustomStreamError) {
        yield {
          type: 'error',
          code: 'custom',
          message: e.message,
          allow_retry: e.allow_retry,
        };
      } else if (e instanceof StreamError) {
        yield {
          type: 'error',
          code: e.code,
          allow_retry: e.allow_retry,
        };
      } else {
        yield {
          type: 'error',
          code: ErrorCode.STREAM_ERROR,
          allow_retry: true,
        };
        logger.exception(e);
      }
    }

    const threadStr = JSON.stringify(thread);
    const lastThreadStr = JSON.stringify(lastThread);
    if (threadStr !== lastThreadStr) {
      // in case user updated the thread at the end of the stream
      await this.store.save_thread(thread, context);
      yield { type: 'thread.updated', thread: this._to_thread_response(thread) };
    }
  }

  protected _get_attachment_store(): AttachmentStore<TCtx> {
    /**Return the configured AttachmentStore or raise if missing.*/
    if (!this.attachment_store) {
      throw new Error(
        "AttachmentStore is not configured. Provide a AttachmentStore to ChatKitServer to handle file operations."
      );
    }
    return this.attachment_store;
  }

  async add_feedback(_thread_id: string, _item_ids: string[], _feedback: unknown, _context: TCtx): Promise<void> {}

  async *action(_thread: ThreadMetadata, _action: Action, _sender: WidgetItem | null, _context: TCtx): AsyncIterable<ThreadStreamEvent> {
    throw new Error('The action() method must be overridden to react to actions.');
    // Unreachable, but TypeScript requires yield in async generator
    yield { type: 'error', code: ErrorCode.STREAM_ERROR, allow_retry: false };
  }

  // To be overridden by subclass
  async *respond(_thread: ThreadMetadata, _input: UserMessageItem | null, _context: TCtx): AsyncIterable<ThreadStreamEvent> { yield* []; }
}


