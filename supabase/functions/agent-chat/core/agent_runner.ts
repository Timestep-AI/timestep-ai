import { ThreadService } from '../services/thread_service.ts';
import { Agent } from '@openai/agents-core';
import { RunnerFactory } from '../utils/runner_factory.ts';
import {
  type ChatKitRequest,
  type ThreadMetadata,
  type Thread,
  type UserMessageItem,
  type ThreadStreamEvent,
  type ThreadCreatedEvent,
  type ThreadUpdatedEvent,
} from '../types/chatkit.ts';

import { MessageProcessor } from '../utils/chatkit/processors/message_processor.ts';
import { ItemFactory } from '../utils/chatkit/factories/item_factory.ts';
import { streamAgentResponse } from '../utils/chatkit/streaming/agent_response_streamer.ts';
import { EventPipeline } from './event_pipeline.ts';

/**
 * Handles running agents and processing their responses
 * Responsible for executing agent workflows and streaming results
 */
export class AgentRunner {
  private messageProcessor: MessageProcessor;
  private itemFactory: ItemFactory;
  private eventPipeline: EventPipeline;

  constructor(
    private store: ThreadService,
    private agent: Agent,
    private context: any
  ) {
    // Use the underlying ThreadStore for utility classes
    this.itemFactory = new ItemFactory(this.store.threadStore);
    this.messageProcessor = new MessageProcessor(this.store.threadStore, this.itemFactory);
    this.eventPipeline = new EventPipeline(store, agent, context);
  }

  /**
   * Process streaming requests and coordinate agent execution
   */
  async *processStreamingRequest(request: ChatKitRequest): AsyncIterable<ThreadStreamEvent> {
    switch (request.type) {
      case 'threads.action':
      case 'threads.custom_action': {
        const thread = await this.store.loadThread(request.params.thread_id);
        yield this.createThreadUpdatedEvent(thread);
        yield* this.eventPipeline.handleApproval(thread, request.params.action, request.params);
        break;
      }

      case 'threads.create': {
        const thread = await this.createThread();
        yield this.createThreadCreatedEvent(thread);

        if (request.params!.input) {
          const threadMetadata = this.threadToMetadata(thread);
          const userMessage = this.eventPipeline.buildUserMessageItem(
            request.params!.input!,
            threadMetadata
          );
          yield* this.processUserMessage(threadMetadata, userMessage);
        }
        break;
      }

      case 'threads.add_user_message': {
        const thread = await this.store.loadThread(request.params!.thread_id!);
        const userMessage = this.eventPipeline.buildUserMessageItem(request.params!.input!, thread);
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

    yield* this.eventPipeline.processEvents(thread, () =>
      this.respond(thread, userMessage)
    );
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
   * Create thread created event
   */
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

  /**
   * Create thread updated event
   */
  private createThreadUpdatedEvent(thread: ThreadMetadata): ThreadUpdatedEvent {
    return {
      type: 'thread.updated',
      thread: {
        id: thread.id,
        created_at: Math.floor(thread.created_at.getTime() / 1000),
        status: { type: 'active' },
        metadata: thread.metadata || {},
        items: { data: [], has_more: false, after: null },
      },
    };
  }

  /**
   * Encode stream for transmission
   */
  encodeStream(stream: AsyncIterable<ThreadStreamEvent>): AsyncIterable<Uint8Array> {
    return this.eventPipeline.encodeStream(stream);
  }
}
