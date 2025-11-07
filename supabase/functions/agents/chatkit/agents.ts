import type { ThreadStreamEvent, ThreadMetadata, UserMessageItem, ClientToolCallItem, WorkflowItem, Workflow, WorkflowSummary, Task, ThreadItemAddedEvent, ThreadItemUpdated, WorkflowTaskUpdated, WorkflowTaskAdded, DurationSummary, Annotation, FileSource, URLSource, ThreadItem, TaskItem, WidgetItem, EndOfTurnItem, HiddenContextItem, Attachment, UserMessageTagContent, AssistantMessageContent, AssistantMessageItem } from './types.ts';
import type { Store, StoreItemType } from './store.ts';
import { stream_widget } from './server.ts';
import type { WidgetRoot, Markdown, Text } from './widgets.ts';

export interface ClientToolCall {
  name: string;
  arguments: Record<string, any>;
}

// Sentinel class to mark queue completion (matches Python line 91 in agents.py)
class _QueueCompleteSentinel {}

// Match Python: TContext = TypeVar("TContext") (line 93)
type TContext = any;

// Wrapper for events from the queue (matches Python line 297 in agents.py)
class _EventWrapper {
  constructor(public event: ThreadStreamEvent) {}
}

export class AgentContext {
  public client_tool_call: ClientToolCall | null = null;
  public previous_response_id: string | null = null; // Match Python line 102
  public workflow_item: WorkflowItem | null = null; // Match Python line 104
  // Queue for events from agent context helpers (matches Python line 106 in agents.py)
  private _events: ThreadStreamEvent[] = [];
  // Track read position for queue iterator (allows resuming after merge)
  private _queueIndex: number = 0;

  constructor(
    public thread: ThreadMetadata,
    public store: Store<TContext>,
    public request_context: TContext,
  ) {}

  // Match Python: generate_id method (line 107-114)
  generate_id(type: StoreItemType, thread?: ThreadMetadata | null): string {
    if (type === "thread") {
      return this.store.generate_thread_id(this.request_context);
    }
    return this.store.generate_item_id(
      type,
      thread || this.thread,
      this.request_context
    );
  }

  // Match Python: stream_widget method (line 116-129)
  async stream_widget(
    widget: WidgetRoot | AsyncGenerator<WidgetRoot, void>,
    copy_text: string | null = null,
  ): Promise<void> {
    for await (const event of stream_widget(
      this.thread,
      widget,
      copy_text,
      (item_type: StoreItemType) => this.store.generate_item_id(
        item_type,
        this.thread,
        this.request_context
      ),
    )) {
      this.stream(event);
    }
  }

  // Match Python: end_workflow method (line 131-147)
  async end_workflow(
    summary: WorkflowSummary | null = null,
    expanded: boolean = false,
  ): Promise<void> {
    if (!this.workflow_item) {
      // No workflow to end
      return;
    }

    if (summary !== null) {
      this.workflow_item.workflow.summary = summary;
    } else if (this.workflow_item.workflow.summary === null || this.workflow_item.workflow.summary === undefined) {
      // If no summary was set or provided, set a basic work summary
      const delta = new Date().getTime() - (this.workflow_item.created_at instanceof Date ? this.workflow_item.created_at.getTime() : new Date(this.workflow_item.created_at).getTime());
      const duration = Math.floor(delta / 1000);
      this.workflow_item.workflow.summary = { duration } as DurationSummary;
    }
    this.workflow_item.workflow.expanded = expanded;
    await this.stream({ type: 'thread.item.done', item: this.workflow_item });
    this.workflow_item = null;
  }

  // Match Python: start_workflow method (line 149-161)
  async start_workflow(workflow: Workflow): Promise<void> {
    this.workflow_item = {
      id: this.generate_id("workflow"),
      created_at: new Date(),
      workflow: workflow,
      thread_id: this.thread.id,
      type: 'workflow',
    } as WorkflowItem;

    if (workflow.type !== "reasoning" && workflow.tasks.length === 0) {
      // Defer sending added event until we have tasks
      return;
    }

    await this.stream({ type: 'thread.item.added', item: this.workflow_item });
  }

  // Match Python: update_workflow_task method (line 163-176)
  async update_workflow_task(task: Task, task_index: number): Promise<void> {
    if (this.workflow_item === null) {
      throw new Error("Workflow is not set");
    }
    // ensure reference is updated in case task is a copy
    this.workflow_item.workflow.tasks[task_index] = task;
    await this.stream({
      type: 'thread.item.updated',
      item_id: this.workflow_item.id,
      update: {
        type: 'workflow.task.updated',
        task: task,
        task_index: task_index,
      } as WorkflowTaskUpdated,
    });
  }

  // Match Python: add_workflow_task method (line 178-199)
  async add_workflow_task(task: Task): Promise<void> {
    if (!this.workflow_item) {
      this.workflow_item = {
        id: this.generate_id("workflow"),
        created_at: new Date(),
        workflow: { type: "custom", tasks: [] },
        thread_id: this.thread.id,
        type: 'workflow',
      } as WorkflowItem;
    }
    const workflow = this.workflow_item.workflow;
    workflow.tasks.push(task);

    if (workflow.type !== "reasoning" && workflow.tasks.length === 1) {
      await this.stream({ type: 'thread.item.added', item: this.workflow_item });
    } else {
      await this.stream({
        type: 'thread.item.updated',
        item_id: this.workflow_item.id,
        update: {
          type: 'workflow.task.added',
          task: task,
          task_index: workflow.tasks.indexOf(task),
        } as WorkflowTaskAdded,
      });
    }
  }

  // Matches Python's AgentContext._complete() method (line 205-206 in agents.py)
  // Puts a sentinel in the queue to mark completion
  _complete(): void {
    // In TypeScript, we use a simple array instead of async queue
    // The sentinel will be checked when draining the queue
    this._events.push(null as any); // Use null as sentinel (will be checked in iterator)
  }

  // Match Python: stream method (line 201-202)
  // Add event to queue (for use by agent context helpers)
  async stream(event: ThreadStreamEvent): Promise<void> {
    this._events.push(event);
  }

  // Get the events queue (for creating queue iterator)
  get events(): ThreadStreamEvent[] {
    return this._events;
  }

  // Get current queue read position
  get queueIndex(): number {
    return this._queueIndex;
  }

  // Set queue read position (for queue iterator)
  set queueIndex(value: number) {
    this._queueIndex = value;
  }
}

// Match Python: StreamingThoughtTracker class (line 336-339)
export class StreamingThoughtTracker {
  item_id: string;
  index: number;
  task: Task;
  
  constructor(item_id: string, index: number, task: Task) {
    this.item_id = item_id;
    this.index = index;
    this.task = task;
  }
}

// Match Python: _convert_content function (line 208-221)
// Note: Content type from OpenAI responses - simplified for TypeScript
function _convert_content(content: any): AssistantMessageContent {
  if (content.type === "output_text") {
    const annotations: Annotation[] = [];
    if (content.annotations && Array.isArray(content.annotations)) {
      for (const annotation of content.annotations) {
        annotations.push(..._convert_annotation(annotation));
      }
    }
    return {
      text: content.text || '',
      annotations: annotations,
      type: "output_text",
    };
  } else {
    return {
      text: content.refusal || '',
      annotations: [],
      type: "output_text",
    };
  }
}

// Match Python: _convert_annotation function (line 224-254)
// Note: ResponsesAnnotation type from OpenAI responses - simplified for TypeScript
function _convert_annotation(annotation: any): Annotation[] {
  // Handle case where annotation might be a dict/object instead of proper type
  // (Python comment mentions OpenAPI client bug)
  
  const result: Annotation[] = [];
  
  if (annotation.type === "file_citation") {
    const filename = annotation.filename;
    if (!filename) {
      return [];
    }
    result.push({
      type: "annotation",
      source: {
        type: "file",
        filename: filename,
        title: filename,
      } as FileSource,
      index: annotation.index || null,
    });
  } else if (annotation.type === "url_citation") {
    result.push({
      type: "annotation",
      source: {
        type: "url",
        url: annotation.url,
        title: annotation.title || null,
      } as URLSource,
      index: annotation.end_index || null,
    });
  }
  
  return result;
}

// Match Python: accumulate_text function (line 614-625)
// Note: This is exported for external use but not used internally
export async function* accumulate_text<TWidget extends Markdown | Text>(
  events: AsyncIterable<any>,
  base_widget: TWidget,
): AsyncIterable<TWidget> {
  let text = "";
  yield { ...base_widget } as TWidget;
  for await (const event of events) {
    if (event.type === "raw_response_event") {
      if (event.data.type === "response.output_text.delta") {
        text += event.data.delta;
        yield { ...base_widget, value: text } as TWidget;
      }
    }
  }
  yield { ...base_widget, value: text, streaming: false } as TWidget;
}

// Match Python: ThreadItemConverter class (line 628-925)
export class ThreadItemConverter {
  /**
   * Converts thread items to Agent SDK input items.
   * Widgets, Tasks, and Workflows have default conversions but can be customized.
   * Attachments, Tags, and HiddenContextItems require custom handling based on the use case.
   * Other item types are converted automatically.
   */

  // Match Python: attachment_to_message_content (line 636-645)
  async attachment_to_message_content(attachment: Attachment): Promise<any> {
    /**
     * Convert an attachment in a user message into a message content part to send to the model.
     * Required when attachments are enabled.
     */
    throw new Error(
      "An Attachment was included in a UserMessageItem but Converter.attachment_to_message_content was not implemented"
    );
  }

  // Match Python: tag_to_message_content (line 647-656)
  async tag_to_message_content(tag: UserMessageTagContent): Promise<any> {
    /**
     * Convert a tag in a user message into a message content part to send to the model as context.
     * Required when tags are used.
     */
    throw new Error(
      "A Tag was included in a UserMessageItem but Converter.tag_to_message_content is not implemented"
    );
  }

  // Match Python: hidden_context_to_input (line 658-667)
  async hidden_context_to_input(item: HiddenContextItem): Promise<any | any[] | null> {
    /**
     * Convert a HiddenContextItem into input item(s) to send to the model.
     * Required when HiddenContextItem are used.
     */
    throw new Error(
      "HiddenContextItem were present in a user message but Converter.hidden_context_to_input was not implemented"
    );
  }

  // Match Python: task_to_input (line 669-692)
  async task_to_input(item: TaskItem): Promise<any | any[] | null> {
    /**
     * Convert a TaskItem into input item(s) to send to the model.
     */
    if (item.task.type !== "custom" || (!item.task.title && !item.task.content)) {
      return null;
    }
    const title = item.task.title ? `${item.task.title}` : "";
    const content = item.task.content ? `${item.task.content}` : "";
    const task_text = title && content ? `${title}: ${content}` : title || content;
    const text = `A message was displayed to the user that the following task was performed:\n<Task>\n${task_text}\n</Task>`;
    return {
      type: "message",
      content: [
        {
          type: "input_text",
          text: text,
        },
      ],
      role: "user",
    };
  }

  // Match Python: workflow_to_input (line 694-722)
  async workflow_to_input(item: WorkflowItem): Promise<any | any[] | null> {
    /**
     * Convert a WorkflowItem into input item(s) to send to the model.
     * Returns WorkflowItem workflow tasks by default.
     */
    const messages: any[] = [];
    for (const task of item.workflow.tasks) {
      if (task.type !== "custom" || (!task.title && !task.content)) {
        continue;
      }

      const title = task.title ? `${task.title}` : "";
      const content = task.content ? `${task.content}` : "";
      const task_text = title && content ? `${title}: ${content}` : title || content;
      const text = `A message was displayed to the user that the following task was performed:\n<Task>\n${task_text}\n</Task>`;
      messages.push({
        type: "message",
        content: [
          {
            type: "input_text",
            text: text,
          },
        ],
        role: "user",
      });
    }
    return messages;
  }

  // Match Python: widget_to_input (line 724-743)
  async widget_to_input(item: WidgetItem): Promise<any | any[] | null> {
    /**
     * Convert a WidgetItem into input item(s) to send to the model.
     * By default, WidgetItems converted to a text description with a JSON representation of the widget.
     */
    return {
      type: "message",
      content: [
        {
          type: "input_text",
          text: `The following graphical UI widget (id: ${item.id}) was displayed to the user:` +
            JSON.stringify(item.widget, null, 2),
        },
      ],
      role: "user",
    };
  }

  // Match Python: user_message_to_input (line 745-826)
  async user_message_to_input(item: UserMessageItem, is_last_message: boolean = true): Promise<any | any[] | null> {
    // Build the user text exactly as typed, rendering tags as @key
    const message_text_parts: string[] = [];
    // Track tags separately to add system context
    const raw_tags: UserMessageTagContent[] = [];

    for (const part of item.content) {
      if (part.type === "input_text") {
        message_text_parts.push(part.text);
      } else if (part.type === "input_tag") {
        message_text_parts.push(`@${part.text}`);
        raw_tags.push(part);
      }
    }

    const user_text_item = {
      role: "user",
      type: "message",
      content: [
        {
          type: "input_text",
          text: message_text_parts.join(""),
        },
        ...(await Promise.all(
          item.attachments.map((a) => this.attachment_to_message_content(a))
        )),
      ],
    };

    // Build system items (prepend later): quoted text and @-mention context
    const context_items: any[] = [];

    if (item.quoted_text && is_last_message) {
      context_items.push({
        role: "user",
        type: "message",
        content: [
          {
            type: "input_text",
            text: `The user is referring to this in particular: \n${item.quoted_text}`,
          },
        ],
      });
    }

    // Dedupe tags (preserve order) and resolve to message content
    if (raw_tags.length > 0) {
      const seen = new Set<string>();
      const uniq_tags: UserMessageTagContent[] = [];
      for (const t of raw_tags) {
        if (!seen.has(t.text)) {
          seen.add(t.text);
          uniq_tags.push(t);
        }
      }

      const tag_content = await Promise.all(
        uniq_tags.map((tag) => this.tag_to_message_content(tag))
      );

      if (tag_content.length > 0) {
        context_items.push({
          role: "user",
          type: "message",
          content: [
            {
              type: "input_text",
              text: `# User-provided context for @-mentions
- When referencing resolved entities, use their canonical names **without** '@'.
- The '@' form appears only in user text and should not be echoed.`.trim(),
            },
            ...tag_content,
          ],
        });
      }
    }

    return [user_text_item, ...context_items];
  }

  // Match Python: assistant_message_to_input (line 828-846)
  async assistant_message_to_input(item: AssistantMessageItem): Promise<any | any[] | null> {
    return {
      type: "message",
      content: item.content.map((c: AssistantMessageContent) => ({
        type: "output_text",
        text: c.text,
        annotations: [], // TODO: these should be sent back as well
      })),
      role: "assistant",
    };
  }

  // Match Python: client_tool_call_to_input (line 848-867)
  async client_tool_call_to_input(item: ClientToolCallItem): Promise<any | any[] | null> {
    if (item.status === "pending") {
      // Filter out pending tool calls - they cannot be sent to the model
      return null;
    }

    return [
      {
        type: "function_call",
        call_id: item.call_id,
        name: item.name,
        arguments: JSON.stringify(item.arguments),
      },
      {
        type: "function_call_output",
        call_id: item.call_id,
        output: JSON.stringify(item.output),
      },
    ];
  }

  // Match Python: end_of_turn_to_input (line 869-873)
  async end_of_turn_to_input(_item: EndOfTurnItem): Promise<any | any[] | null> {
    // Only used for UI hints - you shouldn't need to override this
    return null;
  }

  // Match Python: _thread_item_to_input_item (line 875-906)
  async _thread_item_to_input_item(
    item: ThreadItem,
    is_last_message: boolean = true,
  ): Promise<any[]> {
    if (item.type === "user_message") {
      const out = await this.user_message_to_input(item, is_last_message) || [];
      return Array.isArray(out) ? out : [out];
    } else if (item.type === "assistant_message") {
      const out = await this.assistant_message_to_input(item) || [];
      return Array.isArray(out) ? out : [out];
    } else if (item.type === "client_tool_call") {
      const out = await this.client_tool_call_to_input(item) || [];
      return Array.isArray(out) ? out : [out];
    } else if (item.type === "end_of_turn") {
      const out = await this.end_of_turn_to_input(item) || [];
      return Array.isArray(out) ? out : [out];
    } else if (item.type === "widget") {
      const out = await this.widget_to_input(item) || [];
      return Array.isArray(out) ? out : [out];
    } else if (item.type === "workflow") {
      const out = await this.workflow_to_input(item) || [];
      return Array.isArray(out) ? out : [out];
    } else if (item.type === "task") {
      const out = await this.task_to_input(item) || [];
      return Array.isArray(out) ? out : [out];
    } else if (item.type === "hidden_context_item") {
      const out = await this.hidden_context_to_input(item) || [];
      return Array.isArray(out) ? out : [out];
    } else {
      // TypeScript exhaustiveness check
      const _exhaustive: never = item;
      throw new Error(`Unknown thread item type: ${(_exhaustive as any).type}`);
    }
  }

  // Match Python: to_agent_input (line 908-925)
  async to_agent_input(
    thread_items: ThreadItem[] | ThreadItem,
  ): Promise<any[]> {
    const items = Array.isArray(thread_items) ? [...thread_items] : [thread_items];
    const output: any[] = [];
    for (const item of items) {
      output.push(...(await this._thread_item_to_input_item(
        item,
        item === items[items.length - 1],
      )));
    }
    return output;
  }
}

// Match Python: _DEFAULT_CONVERTER (line 928)
const _DEFAULT_CONVERTER = new ThreadItemConverter();

// Match Python: simple_to_agent_input function (line 931-932)
// Convert thread items to a minimal Agents input format
export async function simple_to_agent_input(thread_items: ThreadItem[] | ThreadItem): Promise<any[]> {
  return await _DEFAULT_CONVERTER.to_agent_input(thread_items);
}

// Queue iterator that wraps the events queue (matches Python line 302-334 in agents.py)
class _AsyncQueueIterator implements AsyncIterable<_EventWrapper> {
  private context: AgentContext;
  private completed: boolean = false;

  constructor(context: AgentContext) {
    this.context = context;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<_EventWrapper> {
    // Continue from current queue index (allows resuming after merge)
    const queue = this.context.events;
    while (this.context.queueIndex < queue.length && !this.completed) {
      const item = queue[this.context.queueIndex];
      this.context.queueIndex++;
      
      // Check for sentinel (null marks completion)
      if (item === null) {
        this.completed = true;
        break;
      }
      yield new _EventWrapper(item);
    }
  }
}

// Merge two async iterators (matches Python line 262-294 in agents.py)
// Python uses asyncio.wait() with FIRST_COMPLETED to yield items as they arrive
async function* _mergeGenerators<T1, T2>(
  a: AsyncIterable<T1>,
  b: AsyncIterable<T2>
): AsyncIterable<T1 | T2> {
  const aIterator = a[Symbol.asyncIterator]();
  const bIterator = b[Symbol.asyncIterator]();
  
  // Track pending next() calls
  let aNext: Promise<IteratorResult<T1>> | null = aIterator.next();
  let bNext: Promise<IteratorResult<T2>> | null = bIterator.next();
  let aDone = false;
  let bDone = false;

  // Match Python: while len(pending_tasks) > 0
  while (!aDone || !bDone) {
    // Match Python: asyncio.wait(..., return_when="FIRST_COMPLETED")
    // Use Promise.race to get the first completed promise
    const promises: Array<Promise<{ source: 'a' | 'b'; result: IteratorResult<T1 | T2> }>> = [];
    
    if (!aDone && aNext) {
      promises.push(
        aNext.then(result => ({ source: 'a' as const, result }))
      );
    }
    
    if (!bDone && bNext) {
      promises.push(
        bNext.then(result => ({ source: 'b' as const, result }))
      );
    }

    if (promises.length === 0) {
      break;
    }

    // Match Python: yield the first completed result
    const completed = await Promise.race(promises);
    
    if (completed.source === 'a') {
      const result = completed.result as IteratorResult<T1>;
      if (!result.done && result.value !== undefined) {
        yield result.value;
        aNext = aIterator.next();
      } else {
        aDone = true;
        aNext = null;
        // Match Python: when one iterator completes, yield remaining items from the other
        if (!bDone && bNext) {
          try {
            const bResult = await bNext;
            if (!bResult.done && bResult.value !== undefined) {
              yield bResult.value;
            }
          } catch (_e) {
            // Ignore errors
          }
        }
      }
    } else {
      const result = completed.result as IteratorResult<T2>;
      if (!result.done && result.value !== undefined) {
        yield result.value;
        bNext = bIterator.next();
      } else {
        bDone = true;
        bNext = null;
        // Match Python: when one iterator completes, yield remaining items from the other
        if (!aDone && aNext) {
          try {
            const aResult = await aNext;
            if (!aResult.done && aResult.value !== undefined) {
              yield aResult.value;
            }
          } catch (_e) {
            // Ignore errors
          }
        }
      }
    }
  }

  // Match Python: yield any remaining items from both iterators
  while (!aDone && aNext) {
    try {
      const result = await aNext;
      if (!result.done && result.value !== undefined) {
        yield result.value;
        aNext = aIterator.next();
      } else {
        aDone = true;
        break;
      }
    } catch (_e) {
      break;
    }
  }

  while (!bDone && bNext) {
    try {
      const result = await bNext;
      if (!result.done && result.value !== undefined) {
        yield result.value;
        bNext = bIterator.next();
      } else {
        bDone = true;
        break;
      }
    } catch (_e) {
      break;
    }
  }
}

// Transform agent events into ChatKit thread events
// Matches Python implementation from https://github.com/openai/chatkit-python
export async function* stream_agent_response(
  agent_context: AgentContext,
  result: AsyncIterable<any>
): AsyncIterable<ThreadStreamEvent> {
  // Track state for converting raw_model_stream_event to raw_response_event format
  let currentItemId: string | null = null;
  const currentContentIndex = 0;
  let accumulatedText = '';

  // Track tool call IDs from run_item_stream_event (matches Python lines 417-427)
  let currentToolCall: string | null = null;

  // Match Python: track produced items for cleanup on guardrail tripwire (line 351)
  const producedItems = new Set<string>();

  // Match Python: create queue iterator (line 350 in agents.py)
  const queueIterator = new _AsyncQueueIterator(agent_context);

  // Match Python: check if the last item in the thread was a workflow or a client tool call
  // if it was a client tool call, check if the second last item was a workflow
  // if either was, continue the workflow (lines 354-371)
  // Note: workflows might not be fully implemented in TypeScript, but we check anyway
  const thread = agent_context.thread;
  const items = await agent_context.store.load_thread_items(
    thread.id, null, 2, 'desc', agent_context.request_context
  );
  const lastItem = items.data[0] || null;
  const secondLastItem = items.data[1] || null;

  // Track workflow item if present (for future workflow support)
  // TypeScript doesn't have workflow_item property yet, so we'll just check but not store
  if (lastItem && (lastItem as any).type === 'workflow') {
    // Workflow continuation - would set ctx.workflow_item if workflows were implemented
    console.log('[stream_agent_response] Found workflow item, continuing workflow');
  } else if (
    lastItem && (lastItem as any).type === 'client_tool_call' &&
    secondLastItem && (secondLastItem as any).type === 'workflow'
  ) {
    // Workflow continuation after client tool call
    console.log('[stream_agent_response] Found workflow item before client_tool_call, continuing workflow');
  }

  // Merge generators: result stream and queue iterator (matches Python line 387 in agents.py)
  console.log('[stream_agent_response] Starting to iterate merged generators...');
  let rawEventCount = 0;
  for await (const event of _mergeGenerators(result, queueIterator)) {
    rawEventCount++;
    console.log(`[stream_agent_response] Raw event ${rawEventCount} from merged generators:`, event?.type || typeof event, event instanceof _EventWrapper ? 'EventWrapper' : 'direct');
    // Events emitted from agent context helpers (matches Python line 389-390 in agents.py)
    if (event instanceof _EventWrapper) {
      const wrappedEvent = event.event;
      console.log(`[stream_agent_response] Yielding wrapped event:`, wrappedEvent?.type);
      
      // Match Python: track produced items for cleanup on guardrail tripwire (lines 391-413)
      if (wrappedEvent.type === 'thread.item.added' || wrappedEvent.type === 'thread.item.done') {
        const item = (wrappedEvent as any).item;
        if (item?.id) {
          producedItems.add(item.id);
        }
      }
      
      yield wrappedEvent;
      continue;
    }
    // Track tool call IDs from run_item_stream_event (matches Python lines 417-427)
    if (event.type === 'run_item_stream_event') {
      const item = event.item;
      if (item && item.type === 'tool_call_item' && item.raw_item && item.raw_item.type === 'function_call') {
        currentToolCall = item.raw_item.call_id;
        currentItemId = item.raw_item.id;
        // Match Python: track produced items (line 426)
        if (currentItemId) {
          producedItems.add(currentItemId);
        }
        console.log('[stream_agent_response] Tracked tool call IDs:', { currentToolCall, currentItemId });
      }
      console.log(`[stream_agent_response] Skipping run_item_stream_event`);
      continue;
    }

    // Convert raw_model_stream_event to raw_response_event format if needed
    console.log(`[stream_agent_response] Processing event type:`, event?.type);
    if (event.type === 'raw_model_stream_event') {
      const eventData = event.data;
      
      // Handle response_done event - extract final text
      if (eventData?.type === 'response_done' && eventData?.response) {
        const response = eventData.response;
        const output = response.output || [];
        const messageItem = output.find((item: any) => item.type === 'message' && item.role === 'assistant');
        
        if (messageItem && messageItem.content) {
          const textContent = Array.isArray(messageItem.content)
            ? messageItem.content
                .filter((c: any) => c.type === 'output_text')
                .map((c: any) => c.text || '')
                .join('')
            : messageItem.content?.text || accumulatedText || '';

          // Generate item_id if not set
          if (!currentItemId) {
            currentItemId = messageItem.id || agent_context.store.generate_item_id('message', agent_context.thread, agent_context.request_context) || `item_${Date.now()}`;
          }

          // Update accumulated text if we haven't been tracking it
          if (!accumulatedText && textContent) {
            accumulatedText = textContent;
          }

          // Emit response.output_item.added if we haven't yet
          if (accumulatedText === textContent || !currentItemId) {
            yield {
              type: 'thread.item.added',
              item: {
                type: 'assistant_message',
                id: currentItemId,
                thread_id: agent_context.thread.id,
                content: [],
                created_at: new Date(),
              },
            } as ThreadStreamEvent;

            yield {
              type: 'thread.item.updated',
              item_id: currentItemId,
              update: {
                type: 'assistant_message.content_part.added',
                content_index: currentContentIndex,
                content: {
                  type: 'output_text',
                  text: '',
                  annotations: [],
                },
              },
            } as ThreadStreamEvent;
          }

          // Emit response.output_text.done (only if we haven't already emitted it)
          // But always emit it to ensure proper completion
          yield {
            type: 'thread.item.updated',
            item_id: currentItemId,
            update: {
              type: 'assistant_message.content_part.done',
              content_index: currentContentIndex,
              content: {
                type: 'output_text',
                text: textContent,
                annotations: [],
              },
            },
          } as ThreadStreamEvent;

          // Emit response.output_item.done
          yield {
            type: 'thread.item.done',
            item: {
              type: 'assistant_message',
              id: currentItemId,
              thread_id: agent_context.thread.id,
              content: [
                {
                  type: 'output_text',
                  text: textContent,
                  annotations: [],
                },
              ],
              created_at: new Date(),
            },
          } as ThreadStreamEvent;
        }
        continue;
      }

      // Handle text delta events
      const innerEvent = eventData?.event || eventData;
      let delta: string | null = null;
      if (eventData?.type === 'output_text_delta' && eventData?.delta) {
        delta = eventData.delta;
      } else if (innerEvent?.type === 'output_text_delta') {
        delta = innerEvent.delta;
      } else if (innerEvent?.type === 'model' && innerEvent?.choices?.[0]?.delta?.content) {
        delta = innerEvent.choices[0].delta.content;
      }

      if (delta) {
        accumulatedText += delta;
        
        // Generate item_id if not set
        if (!currentItemId) {
          currentItemId = agent_context.store.generate_item_id('message', agent_context.thread, agent_context.request_context) || `item_${Date.now()}`;
        }

        // Emit response.output_item.added on first delta
        if (accumulatedText === delta) {
          yield {
            type: 'thread.item.added',
            item: {
              type: 'assistant_message',
              id: currentItemId,
              thread_id: agent_context.thread.id,
              content: [],
              created_at: new Date(),
            },
          } as ThreadStreamEvent;
        }

        // Emit response.content_part.added on first delta
        if (accumulatedText === delta) {
          yield {
            type: 'thread.item.updated',
            item_id: currentItemId,
            update: {
              type: 'assistant_message.content_part.added',
              content_index: currentContentIndex,
              content: {
                type: 'output_text',
                text: '',
                annotations: [],
              },
            },
          } as ThreadStreamEvent;
        }

        // Emit response.output_text.delta
        yield {
          type: 'thread.item.updated',
          item_id: currentItemId,
          update: {
            type: 'assistant_message.content_part.text_delta',
            content_index: currentContentIndex,
            delta: delta,
          },
        } as ThreadStreamEvent;
      }
      
      // Check for done event in model choices
      if (innerEvent?.type === 'model' && innerEvent?.choices?.[0]?.finish_reason) {
        // Emit response.output_text.done
        yield {
          type: 'thread.item.updated',
          item_id: currentItemId!,
          update: {
            type: 'assistant_message.content_part.done',
            content_index: currentContentIndex,
            content: {
              type: 'output_text',
              text: accumulatedText,
              annotations: [],
            },
          },
        } as ThreadStreamEvent;

        // Emit response.output_item.done
        yield {
          type: 'thread.item.done',
          item: {
            type: 'assistant_message',
            id: currentItemId!,
            thread_id: agent_context.thread.id,
            content: [
              {
                type: 'output_text',
                text: accumulatedText,
                annotations: [],
              },
            ],
            created_at: new Date(),
          },
        } as ThreadStreamEvent;
      }
      
      continue;
    }

    // Handle raw_response_event (Python format)
    if (event.type !== 'raw_response_event') {
      // Ignore everything else that isn't a raw response event
      continue;
    }

    // Handle Responses API events
    const responseEvent = event.data;
    if (!responseEvent) {
      continue;
    }

    if (responseEvent.type === 'response.content_part.added') {
      if (responseEvent.part?.type === 'reasoning_text') {
        continue;
      }
      const content = {
        type: 'output_text',
        text: responseEvent.part?.text || '',
        annotations: responseEvent.part?.annotations?.map((a: any) => ({
          source: a.source || {},
          index: a.index,
        })) || [],
      };
      yield {
        type: 'thread.item.updated',
        item_id: responseEvent.item_id,
        update: {
          type: 'assistant_message.content_part.added',
          content_index: responseEvent.content_index,
          content: content,
        },
      } as ThreadStreamEvent;
    } else if (responseEvent.type === 'response.output_text.delta') {
      yield {
        type: 'thread.item.updated',
        item_id: responseEvent.item_id,
        update: {
          type: 'assistant_message.content_part.text_delta',
          content_index: responseEvent.content_index,
          delta: responseEvent.delta,
        },
      } as ThreadStreamEvent;
    } else if (responseEvent.type === 'response.output_text.done') {
      yield {
        type: 'thread.item.updated',
        item_id: responseEvent.item_id,
        update: {
          type: 'assistant_message.content_part.done',
          content_index: responseEvent.content_index,
          content: {
            type: 'output_text',
            text: responseEvent.text,
            annotations: [],
          },
        },
      } as ThreadStreamEvent;
    } else if (responseEvent.type === 'response.output_text.annotation.added') {
      // Ignore annotation-added events; annotations are reflected in the final item content.
      continue;
    } else if (responseEvent.type === 'response.output_item.added') {
      const item = responseEvent.item;
      if (item.type === 'message') {
        // Match Python: track produced items (line 482)
        producedItems.add(item.id);
        const content = (item.content || []).map((c: any) => ({
          type: 'output_text',
          text: c.text || '',
          annotations: [],
        }));
        yield {
          type: 'thread.item.added',
          item: {
            type: 'assistant_message',
            id: item.id,
            thread_id: agent_context.thread.id,
            content: content,
            created_at: new Date(),
          },
        } as ThreadStreamEvent;
      }
    } else if (responseEvent.type === 'response.output_item.done') {
      const item = responseEvent.item;
      if (item.type === 'message') {
        // Match Python: track produced items (line 559)
        producedItems.add(item.id);
        const content = (item.content || []).map((c: any) => ({
          type: 'output_text',
          text: c.text || '',
          annotations: [],
        }));
        yield {
          type: 'thread.item.done',
          item: {
            type: 'assistant_message',
            id: item.id,
            thread_id: agent_context.thread.id,
            content: content,
            created_at: new Date(),
          },
        } as ThreadStreamEvent;
      }
    }
  }

  // Match Python: guardrail tripwire handling (lines 570-578)
  // Note: TypeScript doesn't have InputGuardrailTripwireTriggered/OutputGuardrailTripwireTriggered types yet
  // This would be caught by the outer try/catch if guardrails are implemented
  // For now, we'll skip the explicit handling but keep the structure

  // After streaming completes, mark context as complete (matches Python line 580 in agents.py)
  console.log(`[stream_agent_response] Finished iterating merged generators, rawEventCount: ${rawEventCount}`);
  agent_context._complete();

  // Drain remaining events from queue (matches Python lines 582-584 in agents.py)
  // Create a new iterator that continues from current queueIndex (after merge consumed some items)
  console.log(`[stream_agent_response] Draining queue events...`);
  const drainIterator = new _AsyncQueueIterator(agent_context);
  let queueEventCount = 0;
  for await (const event of drainIterator) {
    queueEventCount++;
    console.log(`[stream_agent_response] Queue event ${queueEventCount}:`, event.event?.type);
    yield event.event;
  }
  console.log(`[stream_agent_response] Drained ${queueEventCount} queue events`);

  // After context is complete and queue is drained, check if there's a client_tool_call to emit
  // ChatKit frontend extracts client tool calls from thread.item.done events and calls onClientTool
  // These items should NOT be saved to the database (they're transient execution instructions)
  console.log('[stream_agent_response] Checking for client_tool_call:', agent_context.client_tool_call);
  if (agent_context.client_tool_call) {
    console.log('[stream_agent_response] Emitting client_tool_call event');

    // Prefer tracked IDs from run_item_stream_event, fall back to generating new ones
    const item_id = currentItemId || agent_context.store.generate_item_id('tool_call', agent_context.thread, agent_context.request_context) || `cthi_${Date.now()}`;
    const call_id = currentToolCall || agent_context.store.generate_item_id('tool_call', agent_context.thread, agent_context.request_context) || `call_${Date.now()}`;

    // Emit thread.item.done event with client_tool_call item
    // The frontend's onClientTool will extract { name, params } from item.name and item.arguments
    // The server's _process_events will filter this out from database persistence
                const clientToolCallItem: ClientToolCallItem = {
                  id: item_id,
                  thread_id: agent_context.thread.id,
                  created_at: new Date(),
                  type: 'client_tool_call',
                  status: 'pending',
                  call_id: call_id,
                  name: agent_context.client_tool_call.name,
                  arguments: agent_context.client_tool_call.arguments,
                };

    const doneEvent: ThreadStreamEvent = {
      type: 'thread.item.done',
      item: clientToolCallItem,
    };

    console.log('[stream_agent_response] Emitting thread.item.done with client_tool_call:', JSON.stringify(doneEvent, null, 2));

    yield doneEvent;
    console.log('[stream_agent_response] client_tool_call event emitted');
  } else {
    console.log('[stream_agent_response] No client_tool_call to emit');
  }
}

// CamelCase aliases for TypeScript
export const simpleToAgentInput = simple_to_agent_input;
export const streamAgentResponse = stream_agent_response;


