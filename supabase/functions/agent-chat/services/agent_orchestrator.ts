import { ThreadStore } from '../stores/thread_store.ts';
import { Agent } from '@openai/agents-core';
import {
  isStreamingReq,
  type ChatKitRequest,
  type ThreadMetadata,
  type Thread,
  type UserMessageItem,
  type ThreadStreamEvent,
  type ThreadCreatedEvent,
  type ThreadUpdatedEvent,
} from '../types/chatkit.ts';

import { EventRouter } from './event_router.ts';
import { EventPipeline } from './event_pipeline.ts';
import { AgentRunner } from './agent_runner.ts';

/**
 * Main orchestrator that coordinates between different services
 * Acts as the primary entry point for ChatKit requests
 */
export class AgentOrchestrator {
  private eventRouter: EventRouter;
  private eventPipeline: EventPipeline;
  private agentRunner: AgentRunner;

  constructor(
    private agent: Agent,
    private context: any,
    private store: ThreadStore
  ) {
    this.eventRouter = new EventRouter(store, agent, context);
    this.eventPipeline = new EventPipeline(store);
    this.agentRunner = new AgentRunner(store, agent, context);
  }

  /**
   * Main entry point for processing ChatKit requests
   */
  async processRequest(
    request: string | ArrayBuffer | Uint8Array
  ): Promise<{ streaming: boolean; result: AsyncIterable<Uint8Array> | object }> {
    const requestStr = typeof request === 'string' ? request : new TextDecoder().decode(request);
    const parsedRequest: ChatKitRequest = JSON.parse(requestStr);

    if (isStreamingReq(parsedRequest)) {
      return {
        streaming: true,
        result: this.eventPipeline.encodeStream(this.processStreamingRequest(parsedRequest)),
      };
    } else {
      return { streaming: false, result: await this.processNonStreamingRequest(parsedRequest) };
    }
  }

  /**
   * Process streaming requests by routing to appropriate handlers
   */
  private async *processStreamingRequest(
    request: ChatKitRequest
  ): AsyncIterable<ThreadStreamEvent> {
    switch (request.type) {
      case 'threads.action':
      case 'threads.custom_action': {
        const thread = await this.store.loadThread(request.params.thread_id);
        yield this.createThreadUpdatedEvent(thread);
        yield* this.eventRouter.handleApproval(thread, request.params.action, request.params);
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
   * Process non-streaming requests
   */
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
      this.agentRunner.respond(thread, userMessage)
    );
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
}
