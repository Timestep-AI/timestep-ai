import type { ThreadMetadata, ThreadStreamEvent, Thread, UserMessageItem, ThreadItem, Page, WidgetItem, WidgetRootUpdated, WidgetComponentUpdated, WidgetStreamingTextValueDelta, HiddenContextItem } from './types.ts';
import type { Store, AttachmentStore, StoreItemType } from './store.ts';
import { ErrorCode, CustomStreamError, StreamError } from './errors.ts';
import { default_generate_id } from './store.ts';
import type { WidgetComponent, Markdown, Text, WidgetRoot } from './widgets.ts';
import type { Action } from './actions.ts';
import { logger } from './logger.ts';

// Match Python: TContext = TypeVar("TContext", default=Any) (line 251)
type TContext = any;

// Match Python: DEFAULT_PAGE_SIZE = 20 (line 74)
export const DEFAULT_PAGE_SIZE = 20;

// Match Python: DEFAULT_ERROR_MESSAGE = "An error occurred when generating a response." (line 75)
export const DEFAULT_ERROR_MESSAGE = "An error occurred when generating a response.";

// Match Python: diff_widget function (line 78-172)
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

// Match Python: stream_widget function (line 174-222)
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
    
    // Match Python: logger.info(f"Received request op: {parsed_request.type}") (line 315)
    logger.info(`Received request op: ${req.type}`);

    if (this._is_streaming_req(req)) {
      const stream = this._process_streaming(req, context);
      return new StreamingResult((async function* () {
        try {
          // Match Python: async for event in self._process_streaming_impl(request, context): b = self._serialize(event); yield b"data: " + b + b"\n\n"
          for await (const event of stream) {
            // Serialize event with proper date handling (matches Python model_dump_json behavior)
            // Python's datetime serializes to ISO format without timezone: "2025-11-03T18:10:07.829180"
            // NOT with Z timezone like JavaScript's toISOString(): "2025-11-04T02:07:12.171Z"
            const serialized = JSON.stringify(event, (key, value) => {
              // Convert Date objects to ISO strings without timezone (matching Python datetime.isoformat())
              if (value instanceof Date) {
                // Format as YYYY-MM-DDTHH:mm:ss.sss (no Z timezone, matching Python)
                const iso = value.toISOString();
                // Remove the 'Z' timezone suffix to match Python's datetime.isoformat()
                return iso.replace('Z', '');
              }
              return value;
            });
            
            // Log thread.item.done events for debugging (especially client_tool_call items)
            if (event.type === 'thread.item.done') {
              const item = (event as any).item;
              if (item?.type === 'client_tool_call') {
                console.log('[ChatKitServer] Emitting client_tool_call item in thread.item.done event');
                console.log('[ChatKitServer] Full serialized event:', serialized);
              }
            }
            
            yield encoder.encode(`data: ${serialized}\n\n`);
          }
        } catch (e) {
          // Match Python: except Exception: logger.exception("Error while generating streamed response"); raise
          // Python's logger.exception() captures the current exception context automatically
          // In TypeScript, we pass the exception explicitly
          logger.exception("Error while generating streamed response", e as Error);
          throw e;
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
        // Match Python: params = request.params; limit=params.limit or DEFAULT_PAGE_SIZE (line 334-340)
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
        // Match Python: await self.store.delete_attachment(...)
        await this.store.delete_attachment(req.params.attachment_id, context);
        return {};
      }
      case 'items.list': {
        // Match Python: filter out HiddenContextItems (line 382-387)
        const items = await this.store.load_thread_items(
          req.params.thread_id,
          req.params.after || null,
          req.params.limit || DEFAULT_PAGE_SIZE,
          req.params.order || 'asc',
          context,
        );
        // Match Python: filter out HiddenContextItems
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
        // Match Python: await self.store.delete_thread(...)
        await this.store.delete_thread(req.params.thread_id, context);
        return {};
      }
      default:
        // Match Python: case _: assert_never(request)
        const _exhaustive: never = req as never;
        throw new Error(`Unknown request type: ${(_exhaustive as any).type}`);
    }
  }

  async *_process_streaming(req: any, context: TCtx): AsyncIterable<ThreadStreamEvent> {
    switch (req.type) {
      case 'threads.create': {
        // Match Python: thread = Thread(id=..., created_at=..., items=Page())
        // Note: title is not set (matches Python - defaults to None/undefined)
        const thread: Thread = { 
          id: this.store.generate_thread_id(context), 
          created_at: new Date(), 
          status: { type: 'active' }, 
          metadata: {},
          items: { data: [], has_more: false, after: null } // Match Python: items=Page()
        };
        // Match Python: await self.store.save_thread(ThreadMetadata(**thread.model_dump()), context=context)
        // Extract metadata fields (without items) for saving
        // Python's model_dump() includes all fields, but ThreadMetadata() constructor only accepts its own fields
        const threadMetadata: ThreadMetadata = {
          id: thread.id,
          created_at: thread.created_at,
          status: thread.status,
          metadata: thread.metadata,
          title: thread.title, // Will be undefined, matching Python's None default
        };
        await this.store.save_thread(threadMetadata, context);
        // Match Python: yield ThreadCreatedEvent(thread=self._to_thread_response(thread))
        yield { type: 'thread.created', thread: this._to_thread_response(thread) };
        // Match Python: user_message = await self._build_user_message_item(request.params.input, thread, context)
        // Note: Python passes Thread object (which extends ThreadMetadata), so we pass thread (Thread) not threadMetadata
        const userMessage = await this._build_user_message_item(req.params?.input, thread, context);
        // Match Python: async for event in self._process_new_thread_item_respond(thread, user_message, context)
        yield* this._process_new_thread_item_respond(thread, userMessage, context);
        break;
      }
      case 'threads.add_user_message': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        // Match Python: user_message = await self._build_user_message_item(...)
        const userMessage = await this._build_user_message_item(req.params?.input, thread, context);
        yield* this._process_new_thread_item_respond(thread, userMessage, context);
        break;
      }
      case 'threads.retry_after_item': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        // Match Python: Collect items to remove (all items after the user message)
        const itemsToRemove: ThreadItem[] = [];
        let userMessageItem: UserMessageItem | null = null;

        // Match Python: async for item in self._paginate_thread_items_reverse(...)
        for await (const item of this._paginate_thread_items_reverse(req.params.thread_id, context)) {
          if (item.id === req.params.item_id) {
            // Match Python: if not isinstance(item, UserMessageItem): raise ValueError
            if (item.type !== 'user_message') {
              throw new Error(`Item ${req.params.item_id} is not a user message`);
            }
            userMessageItem = item as UserMessageItem;
            break;
          }
          itemsToRemove.push(item);
        }

        // Match Python: for item in items_to_remove: await self.store.delete_thread_item(...)
        if (userMessageItem) {
          for (const item of itemsToRemove) {
            await this.store.delete_thread_item(req.params.thread_id, item.id, context);
          }
          // Match Python: lambda: self.respond(thread_metadata, user_message_item, context)
          yield* this._process_events(thread, context, () => this.respond(thread, userMessageItem!, context));
        }
        break;
      }
      case 'threads.action':
      case 'threads.custom_action': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        // Match Python: item: ThreadItem | None = None; if request.params.item_id: item = await self.store.load_item(...)
        let item: ThreadItem | null = null;
        if (req.params.item_id) {
          // Match Python: item = await self.store.load_item(...)
          item = await this.store.load_item(req.params.thread_id, req.params.item_id, context);
        }

        // Match Python: if item and not isinstance(item, WidgetItem): yield ErrorEvent(...); return
        if (item && item.type !== 'widget') {
          yield { type: 'error', code: 'STREAM_ERROR', allow_retry: false } as any;
          break;
        }

        // Match Python: lambda: self.action(thread_metadata, request.params.action, item, context)
        yield* this._process_events(thread, context, () => this.action(thread, req.params.action, item as WidgetItem | null, context));
        break;
      }
      case 'threads.add_client_tool_output': {
        const thread = await this.store.load_thread(req.params.thread_id, context);
        // Load recent items to find the pending client_tool_call
        // Match Python: items = await self.store.load_thread_items(thread.id, None, 1, "desc", context)
        const items = await this.store.load_thread_items(thread.id, null, 1, 'desc', context);
        // Match Python: tool_call = next((item for item in items.data if isinstance(item, ClientToolCallItem) and item.status == "pending"), None)
        const toolCall = items.data.find((item: ThreadItem) => {
          const typedItem = item as { type: string; status?: string };
          return typedItem.type === 'client_tool_call' && typedItem.status === 'pending';
        });

        // Match Python: if not tool_call: raise ValueError
        if (!toolCall) {
          throw new Error(`Last thread item in ${thread.id} was not a ClientToolCallItem`);
        }

        // Match Python: tool_call.output = request.params.result; tool_call.status = "completed"
        const typedToolCall = toolCall as { output?: unknown; status: string };
        typedToolCall.output = req.params.result;
        typedToolCall.status = 'completed';
        // Match Python: await self.store.save_item(thread.id, tool_call, context=context)
        await this.store.save_item(thread.id, toolCall, context);

        // Match Python: await self._cleanup_pending_client_tool_call(thread, context)
        await this._cleanup_pending_client_tool_call(thread, context);

        // Match Python: lambda: self.respond(thread, None, context)
        yield* this._process_events(thread, context, () => this.respond(thread, null, context));
        break;
      }
      default:
        // Match Python: case _: assert_never(request)
        const _exhaustive: never = req as never;
        throw new Error(`Unknown request type: ${(_exhaustive as any).type}`);
    }
  }

  async *_process_new_thread_item_respond(thread: ThreadMetadata, item: UserMessageItem, context: TCtx): AsyncIterable<ThreadStreamEvent> {
    await this.store.add_thread_item(thread.id, item, context);
    // Match Python: cleanup pending client tool calls BEFORE yielding ThreadItemDoneEvent
    await this._cleanup_pending_client_tool_call(thread, context);
    yield { type: 'thread.item.done', item };
    yield* this._process_events(thread, context, () => this.respond(thread, item, context));
  }

  // Match Python: _build_user_message_item method (line 669-683)
  async _build_user_message_item(input: any, thread: ThreadMetadata, context: TCtx): Promise<UserMessageItem> {
    const contentArray = Array.isArray(input?.content) ? input.content : [{ type: 'input_text', text: input?.content?.text || '' }];
    // Match Python: attachments=[await self.store.load_attachment(attachment_id, context) for attachment_id in input.attachments]
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

  // Match Python: _to_thread_response method (line 715-728)
  _to_thread_response(thread: ThreadMetadata | Thread): Thread {
    // Match Python: items = thread.items if isinstance(thread, Thread) else Page()
    const items = (thread as any).items || { data: [], has_more: false, after: null };
    // Match Python: items.data = [item for item in items.data if not is_hidden(item)]
    const filteredItems = {
      ...items,
      data: items.data.filter((item: ThreadItem) => item.type !== 'hidden_context_item'),
    };
    // Match Python: return Thread(id=..., title=..., created_at=..., items=..., status=...)
    // Note: Python doesn't explicitly set metadata, so we don't either (it's inherited from ThreadMetadata)
    return { 
      id: thread.id, 
      title: thread.title, 
      created_at: thread.created_at, 
      status: thread.status, 
      items: filteredItems 
    } as Thread;
  }

  protected async *_paginate_thread_items_reverse(threadId: string, context: TCtx): AsyncIterable<ThreadItem> {
    // Match Python: after = None; while True: ... DEFAULT_PAGE_SIZE (line 696-710)
    let after: string | null = null;
    while (true) {
      const items = await this.store.load_thread_items(threadId, after, DEFAULT_PAGE_SIZE, 'desc', context);
      for (const item of items.data) yield item;
      if (!items.has_more) break;
      after = items.after;
    }
  }

  protected async _load_full_thread(threadId: string, context: TCtx): Promise<Thread> {
    // Match Python: thread_meta = await self.store.load_thread(...); items = await self.store.load_thread_items(..., limit=DEFAULT_PAGE_SIZE, ...) (line 685-694)
    const meta = await this.store.load_thread(threadId, context);
    const items = await this.store.load_thread_items(threadId, null, DEFAULT_PAGE_SIZE, 'asc', context);
    // Match Python: return Thread(**thread_meta.model_dump(), items=thread_items)
    // Note: model_dump() includes all fields including metadata, so we spread meta and add items
    return { ...meta, items } as unknown as Thread;
  }

  protected async _cleanup_pending_client_tool_call(thread: ThreadMetadata, context: TCtx): Promise<void> {
    // Match Python: items = await self.store.load_thread_items(thread.id, None, DEFAULT_PAGE_SIZE, "desc", context) (line 565-570)
    const items = await this.store.load_thread_items(thread.id, null, DEFAULT_PAGE_SIZE, 'desc', context);
    for (const tool_call of items.data) {
      // Match Python: if not isinstance(tool_call, ClientToolCallItem): continue
      if ((tool_call as any).type !== 'client_tool_call') {
        continue;
      }
      const typedToolCall = tool_call as { status?: string; call_id?: string; id: string };
      // Match Python: if tool_call.status == "pending": logger.warning(...); await self.store.delete_thread_item(...)
      if (typedToolCall.status === 'pending') {
        // Match Python: logger.warning(f"Client tool call {tool_call.call_id} was not completed, ignoring")
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
    // Match Python: await asyncio.sleep(0)  # allow the response to start streaming
    // In TypeScript/Deno, we can use a microtask delay
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Match Python: last_thread = thread.model_copy(deep=True)
    let lastThread = JSON.parse(JSON.stringify(thread)) as ThreadMetadata;

    try {
      // Match Python: with agents_sdk_user_agent_override(): 
      // Note: User agent override is Python SDK specific, not needed in TypeScript
      for await (const event of stream()) {
        // Match Python: case ThreadItemDoneEvent(): await self.store.add_thread_item(...)
        if (event.type === 'thread.item.done') {
          const item = (event as any).item;
          await this.store.add_thread_item(thread.id, item, context);
        } else if (event.type === 'thread.item.removed') {
          // Match Python: case ThreadItemRemovedEvent(): await self.store.delete_thread_item(...)
          await this.store.delete_thread_item(thread.id, (event as any).item_id, context);
        } else if (event.type === 'thread.item.replaced') {
          // Match Python: case ThreadItemReplacedEvent(): await self.store.save_item(...)
          await this.store.save_item(thread.id, (event as any).item, context);
        }

        // Match Python: should_swallow_event = isinstance(event, ThreadItemDoneEvent) and isinstance(event.item, HiddenContextItem)
        const shouldSwallowEvent = event.type === 'thread.item.done' && 
          (event as any).item?.type === 'hidden_context_item';

        // Match Python: if not should_swallow_event: yield event
        if (!shouldSwallowEvent) {
          yield event;
        }

        // Match Python: in case user updated the thread while streaming
        // if thread != last_thread: ... yield ThreadUpdatedEvent
        const threadStr = JSON.stringify(thread);
        const lastThreadStr = JSON.stringify(lastThread);
        if (threadStr !== lastThreadStr) {
          lastThread = JSON.parse(JSON.stringify(thread)) as ThreadMetadata;
          await this.store.save_thread(thread, context);
          yield { type: 'thread.updated', thread: this._to_thread_response(thread) };
        }
      }
      
      // Match Python: in case user updated the thread while streaming (after loop)
      const threadStr = JSON.stringify(thread);
      const lastThreadStr = JSON.stringify(lastThread);
      if (threadStr !== lastThreadStr) {
        lastThread = JSON.parse(JSON.stringify(thread)) as ThreadMetadata;
        await this.store.save_thread(thread, context);
        yield { type: 'thread.updated', thread: this._to_thread_response(thread) };
      }
    } catch (e: any) {
      // Match Python: except CustomStreamError as e:
      if (e instanceof CustomStreamError) {
        yield {
          type: 'error',
          code: 'custom',
          message: e.message,
          allow_retry: e.allow_retry,
        };
      } else if (e instanceof StreamError) {
        // Match Python: except StreamError as e:
        yield {
          type: 'error',
          code: e.code,
          allow_retry: e.allow_retry,
        };
      } else {
        // Match Python: except Exception as e: logger.exception(e)
        yield {
          type: 'error',
          code: ErrorCode.STREAM_ERROR,
          allow_retry: true,
        };
        // Match Python: logger.exception(e) (line 662)
        logger.exception(e);
      }
    }

    // Match Python: if thread != last_thread: (at end of stream)
    const threadStr = JSON.stringify(thread);
    const lastThreadStr = JSON.stringify(lastThread);
    if (threadStr !== lastThreadStr) {
      await this.store.save_thread(thread, context);
      yield { type: 'thread.updated', thread: this._to_thread_response(thread) };
    }
  }

  // Match Python: _get_attachment_store method (line 263-269)
  protected _get_attachment_store(): AttachmentStore<TCtx> {
    /**Return the configured AttachmentStore or raise if missing.*/
    if (!this.attachment_store) {
      // Match Python: raise RuntimeError(...)
      throw new Error(
        "AttachmentStore is not configured. Provide a AttachmentStore to ChatKitServer to handle file operations."
      );
    }
    return this.attachment_store;
  }

  async add_feedback(_thread_id: string, _item_ids: string[], _feedback: unknown, _context: TCtx): Promise<void> {}

  // Match Python: action method signature (line 299-309)
  async *action(_thread: ThreadMetadata, _action: Action, _sender: WidgetItem | null, _context: TCtx): AsyncIterable<ThreadStreamEvent> {
    throw new Error('The action() method must be overridden to react to actions.');
  }

  // To be overridden by subclass
  async *respond(_thread: ThreadMetadata, _input: UserMessageItem | null, _context: TCtx): AsyncIterable<ThreadStreamEvent> { yield* []; }
}


