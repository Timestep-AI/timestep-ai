import type { MemoryStore } from '../../stores/memory_store.ts';
import { Runner, RunState } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';
import { AgentService } from '../agent/service.ts';
import { AgentFactory } from '../agent/factories/agent_factory.ts';
import {
  isStreamingReq,
  type ChatKitRequest,
  type ThreadMetadata,
  type Thread,
  type UserMessageItem,
  type ThreadStreamEvent,
  type ThreadCreatedEvent,
  type ThreadUpdatedEvent,
  type ThreadItemDoneEvent,
  type ThreadItemAddedEvent,
  type UserMessageInput,
} from '../../types/chatkit.ts';

// Import from organized modules
import { ItemFactory } from './factories/item_factory.ts';
import { WidgetFactory } from './factories/widget_factory.ts';
import { MessageProcessor } from './processors/message_processor.ts';
import { StreamProcessor } from './processors/stream_processor.ts';
import { ToolCallOutputHandler } from './handlers/tool_call_output_handler.ts';
import { ToolCalledHandler } from './handlers/tool_called_handler.ts';
import { HandoffCallHandler } from './handlers/handoff_call_handler.ts';
import { HandoffOutputHandler } from './handlers/handoff_output_handler.ts';
import { ToolApprovalHandler } from './handlers/tool_approval_handler.ts';
import { ModelStreamHandler } from './handlers/model_stream_handler.ts';


export class ToolHandler {
  constructor(
    private store: MemoryStore<any>,
    private agentService: AgentService,
    private context: any
  ) {}

  async *handleApproval(
    thread: ThreadMetadata,
    action: any,
    params?: any
  ): AsyncIterable<ThreadStreamEvent> {
    const toolCallId = this.extractToolCallId(action, params);

    if (action.type === 'approve_tool_call' || action.type === 'tool.approve') {
      return yield* this.approveToolCall(thread, toolCallId);
    }

    if (action.type === 'reject_tool_call' || action.type === 'tool.deny') {
      return yield* this.rejectToolCall(thread, toolCallId);
    }
  }

  private extractToolCallId(action: any, params?: any): string {
    let toolCallId = action?.toolCallId || action?.payload?.tool_call_id || action?.tool_call_id;

    if (!toolCallId) {
      const itemId = action?.item_id || params?.item_id;
      if (itemId) {
        // In a real implementation, you'd load from database
        // For now, we'll assume it's passed in the action
      }
    }

    if (!toolCallId) {
      console.warn('[ToolHandler] No toolCallId found');
      throw new Error('No toolCallId found in action');
    }

    return toolCallId;
  }

  private async *approveToolCall(thread: ThreadMetadata, toolCallId: string): AsyncIterable<ThreadStreamEvent> {
    const { markApproved } = await import('../../stores/approval_store.ts');
    markApproved(thread.id, toolCallId);

    const serializedState = await this.store.loadRunState(thread.id);
    if (!serializedState) {
      yield this.createThreadUpdatedEvent(thread);
      return;
    }

    const agent = await this.agentService.getAgentFactory().createAgent(this.context.agentId, this.context.userId);
    const runState = await RunState.fromString(agent, serializedState);

    // Approve the specific tool call
    const interruptions = runState.getInterruptions();
    for (const approvalItem of interruptions) {
      const itemToolCallId = (approvalItem.rawItem as any)?.callId ||
                            (approvalItem.rawItem as any)?.call_id ||
                            (approvalItem.rawItem as any)?.id;
      if (itemToolCallId === toolCallId) {
        runState.approve(approvalItem, { alwaysApprove: false });
      }
    }

    const result = await this.runAgent(agent, runState, thread);
    await this.store.clearRunState(thread.id);

    yield* streamAgentResponse(result, thread.id, this.store);
  }

  private async *rejectToolCall(thread: ThreadMetadata, toolCallId: string): AsyncIterable<ThreadStreamEvent> {
    const { clearApproved } = await import('../../stores/approval_store.ts');
    clearApproved(thread.id, toolCallId);

    const serializedState = await this.store.loadRunState(thread.id);
    if (!serializedState) {
      yield this.createThreadUpdatedEvent(thread);
      return;
    }

    const agent = await this.agentService.getAgentFactory().createAgent(this.context.agentId, this.context.userId);
    const runState = await RunState.fromString(agent, serializedState);

    // Reject the specific tool call
    const interruptions = runState.getInterruptions();
    for (const approvalItem of interruptions) {
      const itemToolCallId = (approvalItem.rawItem as any)?.callId ||
                            (approvalItem.rawItem as any)?.call_id ||
                            (approvalItem.rawItem as any)?.id;
      if (itemToolCallId === toolCallId) {
        runState.reject(approvalItem, { alwaysReject: false });
      }
    }

    const result = await this.runAgent(agent, runState, thread);
    await this.store.clearRunState(thread.id);

    yield* streamAgentResponse(result, thread.id, this.store);
  }

  private async runAgent(agent: any, runState: RunState, thread: ThreadMetadata) {
    const modelProvider = new OpenAIProvider({
      apiKey: Deno.env.get('OPENAI_API_KEY') || '',
    });

    const runConfig = {
      model: 'gpt-4o-mini',
      modelProvider,
      traceIncludeSensitiveData: true,
      tracingDisabled: false,
      groupId: thread.id,
      metadata: { user_id: this.context.userId },
    };

    const runner = new Runner(runConfig);
    return await runner.run(agent, runState, {
      context: { threadId: thread.id, userId: this.context.userId },
      stream: true,
    });
  }

  private createThreadUpdatedEvent(thread: ThreadMetadata): ThreadUpdatedEvent {
    return {
      type: 'thread.updated',
      thread: {
        id: thread.id,
        created_at: typeof thread.created_at === 'number'
          ? thread.created_at
          : Math.floor(new Date(thread.created_at as any).getTime() / 1000),
        status: { type: 'active' },
        metadata: thread.metadata || {},
        items: { data: [], has_more: false, after: null },
      },
    };
  }
}

// Event Handlers for different streaming event types
export class ChatKitService {
  private messageProcessor: MessageProcessor;
  private streamProcessor: StreamProcessor;
  private toolHandler: ToolHandler;
  private itemFactory: ItemFactory;

  // Event handlers
  private toolCallOutputHandler: ToolCallOutputHandler;
  private toolCalledHandler: ToolCalledHandler;
  private handoffCallHandler: HandoffCallHandler;
  private handoffOutputHandler: HandoffOutputHandler;
  private toolApprovalHandler: ToolApprovalHandler;
  private modelStreamHandler: ModelStreamHandler;

  constructor(
    private store: MemoryStore<any>,
    private agentService: AgentService,
    private context: any
  ) {
    this.itemFactory = new ItemFactory(store);
    this.messageProcessor = new MessageProcessor(store, this.itemFactory);
    this.streamProcessor = new StreamProcessor(store);
    this.toolHandler = new ToolHandler(store, agentService, context);

    // Initialize event handlers
    this.toolCallOutputHandler = new ToolCallOutputHandler(store, this.itemFactory);
    this.toolCalledHandler = new ToolCalledHandler(store, this.itemFactory);
    this.handoffCallHandler = new HandoffCallHandler(store, this.itemFactory, new Set());
    this.handoffOutputHandler = new HandoffOutputHandler(store, this.itemFactory, new Set());
    this.toolApprovalHandler = new ToolApprovalHandler(store, this.itemFactory);
    this.modelStreamHandler = new ModelStreamHandler(this.itemFactory);
  }

  async processRequest(
    request: string | ArrayBuffer | Uint8Array
  ): Promise<{ streaming: boolean; result: AsyncIterable<Uint8Array> | object }> {
    const requestStr = typeof request === 'string' ? request : new TextDecoder().decode(request);
    const parsedRequest: ChatKitRequest = JSON.parse(requestStr);

    if (isStreamingReq(parsedRequest)) {
      return {
        streaming: true,
        result: this.streamProcessor.encodeStream(this.processStreamingRequest(parsedRequest)),
      };
    } else {
      return { streaming: false, result: await this.processNonStreamingRequest(parsedRequest) };
    }
  }

  private async *processStreamingRequest(request: ChatKitRequest): AsyncIterable<ThreadStreamEvent> {
    switch (request.type) {
      case 'threads.action':
      case 'threads.custom_action': {
        const thread = await this.store.loadThread(request.params.thread_id);
        yield this.createThreadUpdatedEvent(thread);
        yield* this.toolHandler.handleApproval(thread, request.params.action, request.params);
        break;
      }

      case 'threads.create': {
        const thread = await this.createThread();
        yield this.createThreadCreatedEvent(thread);

        if (request.params!.input) {
          const userMessage = this.messageProcessor.buildUserMessageItem(request.params!.input!, thread);
          yield* this.processUserMessage(thread, userMessage);
        }
        break;
      }

      case 'threads.add_user_message': {
        const thread = await this.store.loadThread(request.params!.thread_id!);
        const userMessage = this.messageProcessor.buildUserMessageItem(request.params!.input!, thread);
        yield* this.processUserMessage(thread, userMessage);
        break;
      }

      default:
        throw new Error(`Unknown streaming request type: ${(request as any).type}`);
    }
  }

  private async processNonStreamingRequest(request: ChatKitRequest): Promise<object> {
    switch (request.type) {
      case 'threads.get_by_id':
        return await this.store.loadFullThread(request.params!.thread_id!);

      case 'threads.list': {
        const params = request.params || {};
        const threads = await this.store.loadThreads(
          params.limit || 20,
          params.after || null,
          params.order || 'desc'
        );
        return {
          data: await Promise.all(threads.data.map((t) => this.store.loadFullThread(t.id))),
          has_more: threads.has_more,
          after: threads.after,
        };
      }

      case 'items.list': {
        const params = request.params!;
        return await this.store.loadThreadItems(
          params.thread_id!,
          params.after || null,
          params.limit || 20,
          params.order || 'asc'
        );
      }

      case 'threads.update': {
        const thread = await this.store.loadThread(request.params!.thread_id!);
        thread.title = request.params!.title;
        await this.store.saveThread(thread);
        return await this.store.loadFullThread(request.params!.thread_id!);
      }

      case 'threads.delete':
        await this.store.deleteThread(request.params!.thread_id!);
        return {};

      case 'threads.retry_after_item':
        return {};

      default:
        throw new Error(`Unknown request type: ${(request as any).type}`);
    }
  }

  private async *processUserMessage(thread: ThreadMetadata, userMessage: UserMessageItem): AsyncIterable<ThreadStreamEvent> {
    await this.store.addThreadItem(thread.id, userMessage);

    yield {
      type: 'thread.item.added',
      item: { ...userMessage, created_at: Math.floor(Date.now() / 1000) },
    } as ThreadItemAddedEvent;

    yield {
      type: 'thread.item.done',
      item: { ...userMessage, created_at: Math.floor(Date.now() / 1000) },
    } as ThreadItemDoneEvent;

    yield* this.streamProcessor.processEvents(thread, () => this.respond(thread, userMessage));
  }

  private async *respond(thread: ThreadMetadata, userMessage: UserMessageItem): AsyncIterable<ThreadStreamEvent> {
    const messageText = await this.messageProcessor.extractMessageText(userMessage);
    if (!messageText) return;

    try {
      const messages = await this.messageProcessor.loadConversationHistory(thread.id);
      const agent = await this.agentService.getAgentFactory().createAgent(this.context.agentId, this.context.userId);
      const inputItems = this.messageProcessor.convertToAgentFormat(messages);

      const modelProvider = new OpenAIProvider({
        apiKey: Deno.env.get('OPENAI_API_KEY') || '',
      });

      const runConfig = {
        model: 'gpt-4o-mini',
        modelProvider,
        traceIncludeSensitiveData: true,
        tracingDisabled: false,
        workflowName: `Agent workflow (${Date.now()})`,
        groupId: thread.id,
        metadata: { user_id: this.context.userId },
      };

      const runner = new Runner(runConfig);
      const result = await runner.run(agent, inputItems, {
        context: { threadId: thread.id, userId: this.context.userId },
        stream: true,
      });

      await this.store.saveRunState(thread.id, (result as any).state);

      yield* streamAgentResponse(result as any, thread.id, this.store);
    } catch (error) {
      console.error('[ChatKitService] Error:', error);
      throw error;
    }
  }

  private async createThread(): Promise<Thread> {
    const thread: Thread = {
      id: this.store.generateThreadId(),
      created_at: Math.floor(Date.now() / 1000),
      status: { type: 'active' },
      metadata: {},
      items: { data: [], has_more: false, after: null },
    };
    await this.store.saveThread(thread);
    return thread;
  }

  private createThreadCreatedEvent(thread: Thread): ThreadCreatedEvent {
    return {
      type: 'thread.created',
      thread: {
        id: thread.id,
        created_at: thread.created_at,
        status: thread.status,
        metadata: thread.metadata,
        items: { data: [], has_more: false, after: null },
      },
    };
  }

  private createThreadUpdatedEvent(thread: ThreadMetadata): ThreadUpdatedEvent {
    return {
      type: 'thread.updated',
      thread: {
        id: thread.id,
        created_at: typeof thread.created_at === 'number'
          ? thread.created_at
          : Math.floor(new Date(thread.created_at as any).getTime() / 1000),
        status: { type: 'active' },
        metadata: thread.metadata || {},
        items: { data: [], has_more: false, after: null },
      },
    };
  }
}

// Simplified helper to stream agent response to ChatKit events
export async function* streamAgentResponse(
  result: AsyncIterable<any>,
  threadId: string,
  store: MemoryStore<any>
): AsyncIterable<ThreadStreamEvent> {
  const itemFactory = new ItemFactory(store);

  // Initialize event handlers
  const processedHandoffs = new Set<string>();
  const toolCallOutputHandler = new ToolCallOutputHandler(store, itemFactory);
  const toolCalledHandler = new ToolCalledHandler(store, itemFactory);
  const handoffCallHandler = new HandoffCallHandler(store, itemFactory, processedHandoffs);
  const handoffOutputHandler = new HandoffOutputHandler(store, itemFactory, processedHandoffs);
  const toolApprovalHandler = new ToolApprovalHandler(store, itemFactory);
  const modelStreamHandler = new ModelStreamHandler(itemFactory);

  // Streaming state
  const streamState = {
    itemAdded: false,
    contentPartAdded: false,
    itemId: store.generateItemId('message'),
    createdAt: Math.floor(Date.now() / 1000),
    fullText: '',
  };

  // Stream the events and delegate to appropriate handlers
  for await (const event of result) {
    const eventType = (event as any).data?.type || event?.type;
    const eventName = (event as any).name;

    // Handle tool approval requests → render a widget and pause (matches original logic)
    if (eventType === 'run_item_stream_event' && eventName === 'tool_approval_requested') {
      const item = (event as any).item;
      const tool = item?.rawItem;
      const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
      const toolName = tool?.name || 'tool';
      const argumentsText = tool?.arguments || '';

      // Save the run state so we can resume after approval/rejection
      const runState = (result as any).state;
      if (runState) {
        const serializedState = JSON.stringify(runState);
        await store.saveRunState(threadId, serializedState);
      }

      // Generate approval item ID first
      const approvalItemId = store.generateItemId('widget');

      // Create approval widget
      const widget = WidgetFactory.createToolApprovalWidget(toolName, argumentsText, toolCallId, approvalItemId);

      // Store the toolCallId in the approval store
      const { markApproved } = await import('../../stores/approval_store.ts');
      markApproved(threadId, toolCallId);

      const widgetItem = itemFactory.createWidgetItem(threadId, 'widget', widget);
      widgetItem.id = approvalItemId;

      yield {
        type: 'thread.item.added',
        item: widgetItem,
      } as ThreadItemAddedEvent;

      yield {
        type: 'thread.item.done',
        item: widgetItem,
      } as ThreadItemDoneEvent;

      // Pause further streaming until action arrives
      return;
    }

    // Route events to appropriate handlers
    if (event.type === 'run_item_stream_event') {
      const item = (event as any).item;

      if (item?.type === 'tool_call_output_item') {
        yield* toolCallOutputHandler.handle(event, threadId);
        continue;
      }

      if (item?.type === 'handoff_call_item') {
        yield* handoffCallHandler.handle(event, threadId);
        continue;
      }

      if (item?.type === 'handoff_output_item') {
        yield* handoffOutputHandler.handle(event, threadId);
        continue;
      }

      if (eventName === 'tool_called') {
        yield* toolCalledHandler.handle(event, threadId);
        continue;
      }
    }

    // Handle model streaming events
    if (event.type === 'raw_model_stream_event') {
      yield* modelStreamHandler.handleRawModelStream(event, threadId, streamState);
      continue;
    }

    // Handle direct text deltas
    if ((event.type === 'output_text_delta' || event.type === 'content.delta') &&
        ((event as any).data?.delta || (event as any).delta)) {
      yield* modelStreamHandler.handleDirectTextDelta(event, threadId, streamState);
      continue;
    }
  }

  // Emit final content and done events
  if (streamState.contentPartAdded) {
    yield {
      type: 'thread.item.updated',
      item_id: streamState.itemId,
      update: {
        type: 'assistant_message.content_part.done',
        content_index: 0,
        content: {
          annotations: [],
          text: streamState.fullText,
          type: 'output_text',
        },
      },
    };
  }

  // Send final done event
  const finalItem: any = {
    type: 'assistant_message',
    id: streamState.itemId,
    thread_id: threadId,
    content: [
      {
        annotations: [],
        text: streamState.fullText || '',
        type: 'output_text',
      },
    ],
    created_at: streamState.createdAt,
  };

  // Ensure item.added precedes item.done even if there were no deltas
  if (!streamState.itemAdded) {
    yield {
      type: 'thread.item.added',
      item: finalItem,
    } as ThreadItemAddedEvent;
  }

  yield {
    type: 'thread.item.done',
    item: finalItem,
  } as ThreadItemDoneEvent;

  // Save the final message to the database
  if (streamState.fullText) {
    await store.saveThreadItem(threadId, finalItem);
  }
}
