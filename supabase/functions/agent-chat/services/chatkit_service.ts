import { ThreadService } from '../services/thread_service.ts';
import { Agent } from '@openai/agents-core';
import { RunnerFactory } from '../utils/runner_factory.ts';
import {
  type ChatKitRequest,
  type ThreadMetadata,
  type Thread,
  type UserMessageItem,
  type ThreadStreamEvent,
} from '../types/chatkit.ts';

import { MessageProcessor } from '../utils/chatkit/processors/message_processor.ts';
import { ToolHandler } from '../utils/chatkit/handlers/tool_handler.ts';
import { ItemFactory } from '../utils/chatkit/factories/item_factory.ts';
import { streamAgentResponse } from '../utils/chatkit/streaming/agent_response_streamer.ts';

/**
 * Handles all ChatKit operations
 * Responsible for processing requests, executing agent workflows, and streaming results
 */
export class ChatKitService {
  private messageProcessor: MessageProcessor;
  private toolHandler: ToolHandler;
  private itemFactory: ItemFactory;

  constructor(
    private store: ThreadService,
    private agent: Agent,
    private context: any
  ) {
    // Initialize utility classes directly
    this.itemFactory = new ItemFactory(this.store.threadStore);
    this.messageProcessor = new MessageProcessor(this.store.threadStore, this.itemFactory);
    this.toolHandler = new ToolHandler(this.store.threadStore, agent, context);
  }

  /**
   * Process non-streaming requests
   */
  async processNonStreamingRequest(request: ChatKitRequest): Promise<object> {
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

  /**
   * Process streaming requests and coordinate agent execution
   */
  async *processStreamingRequest(request: ChatKitRequest): AsyncIterable<ThreadStreamEvent> {
    switch (request.type) {
      case 'threads.action':
      case 'threads.custom_action': {
        const thread = await this.store.loadThread(request.params.thread_id);
        yield this.itemFactory.createThreadUpdatedEvent(thread);
        yield* this.toolHandler.handleApproval(thread, request.params.action, request.params);
        break;
      }

      case 'threads.create': {
        const thread = await this.createThread();
        yield this.itemFactory.createThreadCreatedEvent(thread);

        if (request.params!.input) {
          const threadMetadata = this.threadToMetadata(thread);
          const userMessage = this.messageProcessor.buildUserMessageItem(
            request.params!.input!,
            threadMetadata
          );
          yield* this.processUserMessage(threadMetadata, userMessage);
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

  /**
   * Process user messages and coordinate the response
   */
  private async *processUserMessage(
    thread: ThreadMetadata,
    userMessage: UserMessageItem
  ): AsyncIterable<ThreadStreamEvent> {
    await this.store.addThreadItem(thread.id, userMessage);

    yield {
      type: 'thread.item.added',
      item: { ...userMessage, created_at: Math.floor(Date.now() / 1000) },
    };

    yield {
      type: 'thread.item.done',
      item: { ...userMessage, created_at: Math.floor(Date.now() / 1000) },
    };

    yield* this.processEvents(thread, () => this.respond(thread, userMessage));
  }

  /**
   * Execute agent response to a user message
   */
  async *respond(
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

      yield* streamAgentResponse(result as any, thread.id, this.store.threadStore);
    } catch (error) {
      console.error('[AgentRunner] Error:', error);
      throw error;
    }
  }

  /**
   * Create a new thread
   */
  private async createThread(): Promise<Thread> {
    const threadId = this.store.generateThreadId();
    const threadMetadata: ThreadMetadata = {
      id: threadId,
      created_at: new Date(),
      status: { type: 'active' },
      metadata: {},
    };
    await this.store.saveThread(threadMetadata);

    // Return as Thread type for compatibility
    const thread: Thread = {
      id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      status: { type: 'active' },
      metadata: {},
      items: { data: [], has_more: false, after: null },
    };
    return thread;
  }

  /**
   * Convert Thread to ThreadMetadata
   */
  private threadToMetadata(thread: Thread): ThreadMetadata {
    return {
      id: thread.id,
      created_at: new Date(thread.created_at * 1000),
      status: thread.status,
      metadata: thread.metadata,
    };
  }

  /**
   * Process events and handle thread item persistence
   */
  private async *processEvents(
    thread: ThreadMetadata,
    stream: () => AsyncIterable<ThreadStreamEvent>
  ): AsyncIterable<ThreadStreamEvent> {
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      for await (const event of stream()) {
        if (event.type === 'thread.item.done' && event.item.type !== 'widget') {
          await this.store.threadStore.addThreadItem(thread.id, event.item);
        }
        yield event;
      }
    } catch (error) {
      yield {
        type: 'error',
        code: 'STREAM_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        allow_retry: true,
      } as any;
    }
  }

  /**
   * Encode stream for transmission
   */
  encodeStream(stream: AsyncIterable<ThreadStreamEvent>): AsyncIterable<Uint8Array> {
    const encoder = new TextEncoder();

    return (async function* () {
      try {
        for await (const event of stream) {
          ChatKitService.validateEvent(event);
          const data = JSON.stringify(event);
          yield encoder.encode(`data: ${data}\n\n`);
        }
      } catch (error) {
        console.error('[ChatKitService] Error in streaming:', error);
        const errorEvent: any = {
          type: 'error',
          code: 'STREAM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          allow_retry: true,
        };
        const data = JSON.stringify(errorEvent);
        yield encoder.encode(`data: ${data}\n\n`);
      }
    })();
  }

  /**
   * Validate event structure
   */
  private static validateEvent(event: ThreadStreamEvent): void {
    if (event.type === 'thread.created' || event.type === 'thread.updated') {
      const thread = (event as any).thread;
      if (!thread) {
        throw new Error(`Invalid ${event.type} event: thread is required`);
      }
      if (!thread.items) {
        throw new Error(`Invalid ${event.type} event: thread.items is required`);
      }
      if (!Array.isArray(thread.items.data)) {
        throw new Error(`Invalid ${event.type} event: thread.items.data must be an array`);
      }
      if (!thread.status || !thread.status.type) {
        throw new Error(`Invalid ${event.type} event: thread.status.type is required`);
      }
    }
  }
}
