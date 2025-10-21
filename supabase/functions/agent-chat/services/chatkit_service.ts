import { ThreadsStore } from '../stores/threads_store.ts';
import { Runner, RunState, Agent } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';
import { RunnerFactory } from '../utils/runner_factory.ts';
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
} from '../types/chatkit.ts';

// Import from organized modules
import { ItemFactory } from '../utils/chatkit/factories/item_factory.ts';
import { WidgetFactory } from '../utils/chatkit/factories/widget_factory.ts';
import { MessageProcessor } from '../utils/chatkit/processors/message_processor.ts';
import { StreamProcessor } from '../utils/chatkit/processors/stream_processor.ts';
import { ToolHandler } from '../utils/chatkit/handlers/tool_handler.ts';
import { ToolCallOutputHandler } from '../utils/chatkit/handlers/tool_call_output_handler.ts';
import { ToolCalledHandler } from '../utils/chatkit/handlers/tool_called_handler.ts';
import { HandoffCallHandler } from '../utils/chatkit/handlers/handoff_call_handler.ts';
import { HandoffOutputHandler } from '../utils/chatkit/handlers/handoff_output_handler.ts';
import { ToolApprovalHandler } from '../utils/chatkit/handlers/tool_approval_handler.ts';
import { ModelStreamHandler } from '../utils/chatkit/handlers/model_stream_handler.ts';
import { streamAgentResponse } from '../utils/chatkit/streaming/agent_response_streamer.ts';

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
    private agent: Agent,
    private context: any,
    private store: ThreadsStore
  ) {
    this.itemFactory = new ItemFactory(store);
    this.messageProcessor = new MessageProcessor(store, this.itemFactory);
    this.streamProcessor = new StreamProcessor(store);
    this.toolHandler = new ToolHandler(store, agent, context);

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

  private async *processStreamingRequest(
    request: ChatKitRequest
  ): AsyncIterable<ThreadStreamEvent> {
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
          const userMessage = this.messageProcessor.buildUserMessageItem(
            request.params!.input!,
            thread
          );
          yield* this.processUserMessage(thread, userMessage);
        }
        break;
      }

      case 'threads.add_user_message': {
        const thread = await this.store.loadThread(request.params!.thread_id!);
        const userMessage = this.messageProcessor.buildUserMessageItem(
          request.params!.input!,
          thread
        );
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

  private async *processUserMessage(
    thread: ThreadMetadata,
    userMessage: UserMessageItem
  ): AsyncIterable<ThreadStreamEvent> {
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

  private async *respond(
    thread: ThreadMetadata,
    userMessage: UserMessageItem
  ): AsyncIterable<ThreadStreamEvent> {
    const messageText = await this.messageProcessor.extractMessageText(userMessage);
    if (!messageText) return;

    try {
      const messages = await this.messageProcessor.loadConversationHistory(thread.id);
      const agent = this.agent;
      const inputItems = this.messageProcessor.convertToAgentFormat(messages);

      const runner = await RunnerFactory.createRunner({
        threadId: thread.id,
        userId: this.context.userId,
        workflowName: `Agent workflow (${Date.now()})`,
      });
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
        created_at:
          typeof thread.created_at === 'number'
            ? thread.created_at
            : Math.floor(new Date(thread.created_at as any).getTime() / 1000),
        status: { type: 'active' },
        metadata: thread.metadata || {},
        items: { data: [], has_more: false, after: null },
      },
    };
  }
}
