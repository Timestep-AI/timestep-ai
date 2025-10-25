import { ThreadService } from '../services/thread_service.ts';
import { ThreadMessageService } from '../services/thread_message_service.ts';
import { ThreadRunStateService } from '../services/thread_run_state_service.ts';
import { Agent, RunState } from 'https://esm.sh/@openai/agents-core@0.0.1';
import { RunnerFactory } from '../utils/runner_factory.ts';
import {
  type ChatKitRequest,
  type ThreadMetadata,
  type Thread,
  type UserMessageItem,
  type ThreadStreamEvent,
} from '../types/chatkit.ts';

import { ChatKitMessageProcessor } from '../utils/chatkit/processors/chatkit_message_processor.ts';
import { AgentMessageConverter } from '../utils/chatkit/converters/agent_message_converter.ts';
import { ChatKitEventFactory } from '../utils/chatkit/factories/chatkit_event_factory.ts';
import { streamAgentResponse } from './chatkit/agent_response_service.ts';
import { ToolHandler } from './chatkit/tool_service.ts';

/**
 * Handles all ChatKit operations
 * Responsible for processing requests, executing agent workflows, and streaming results
 */
export class ChatKitService {
  private messageProcessor: ChatKitMessageProcessor;
  private agentConverter: AgentMessageConverter;
  private eventFactory: ChatKitEventFactory;
  private toolHandler: ToolHandler;

  constructor(
    private threadService: ThreadService,
    private threadMessageService: ThreadMessageService,
    private threadRunStateService: ThreadRunStateService,
    private agent: Agent,
    private context: any
  ) {
    // Initialize specialized services
    this.eventFactory = new ChatKitEventFactory();
    this.messageProcessor = new ChatKitMessageProcessor(
      this.threadMessageService.threadMessageStore
    );
    this.agentConverter = new AgentMessageConverter();
    this.toolHandler = new ToolHandler(
      this.threadMessageService.threadMessageStore,
      this.threadRunStateService,
      this.agent,
      this.context
    );
  }

  /**
   * Process non-streaming requests
   */
  async processNonStreamingRequest(request: ChatKitRequest): Promise<object> {
    switch (request.type) {
      case 'threads.get_by_id':
        return await this.threadService.loadThread(request.params!.thread_id!);

      case 'threads.list': {
        const params = request.params || {};
        const threads = await this.threadService.loadThreads(
          params.limit || 20,
          params.after || null,
          params.order || 'desc'
        );
        return {
          data: await Promise.all(threads.data.map((t) => this.threadService.loadThread(t.id))),
          has_more: threads.has_more,
          after: threads.after,
        };
      }

      case 'items.list': {
        const params = request.params!;
        return await this.threadMessageService.loadThreadMessages(
          params.thread_id!,
          params.after || null,
          params.limit || 20,
          params.order || 'asc'
        );
      }

      case 'threads.update': {
        const thread = await this.threadService.loadThread(request.params!.thread_id!);
        thread.title = request.params!.title;
        await this.threadService.saveThread(thread);
        return await this.threadService.loadThread(request.params!.thread_id!);
      }

      case 'threads.delete':
        await this.threadService.deleteThread(request.params!.thread_id!);
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
        const thread = await this.threadService.loadThread(request.params.thread_id);
        yield this.eventFactory.createThreadUpdatedEvent(thread);
        const approvalResult = await this.toolHandler.handleApproval(thread, request.params.action, request.params);
        
        if (approvalResult.shouldExecute && approvalResult.runState) {
          // Execute the agent with the modified run state
          const result = await this.runAgent(approvalResult.runState, thread);
          await this.threadRunStateService.clearRunState(thread.id);
          
          yield* streamAgentResponse(
            result,
            thread.id,
            this.threadMessageService.threadMessageStore,
            this.threadRunStateService
          );
        }
        break;
      }

      case 'threads.create': {
        const thread = await this.createThread();
        yield this.eventFactory.createThreadCreatedEvent(thread);

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
        const thread = await this.threadService.loadThread(request.params!.thread_id!);
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
    await this.threadMessageService.addThreadMessage(thread.id, userMessage);

    yield this.eventFactory.createItemAddedEvent(userMessage);
    yield this.eventFactory.createItemDoneEvent(userMessage);

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
      const inputItems = this.agentConverter.convertToAgentFormat(messages);

      const runner = await RunnerFactory.createRunner({
        threadId: thread.id,
        userId: this.context.userId,
        workflowName: `Agent workflow (${Date.now()})`,
      });

      const result = await runner.run(agent, inputItems, {
        context: { threadId: thread.id, userId: this.context.userId },
        stream: true,
      });

      await this.threadRunStateService.saveRunState(thread.id, (result as any).state);

      yield* streamAgentResponse(
        result as any,
        thread.id,
        this.threadMessageService.threadMessageStore,
        this.threadRunStateService
      );
    } catch (error) {
      console.error('[AgentRunner] Error:', error);
      throw error;
    }
  }

  /**
   * Create a new thread
   */
  private async createThread(): Promise<Thread> {
    const threadId = this.threadService.generateThreadId();
    const threadMetadata: ThreadMetadata = {
      id: threadId,
      created_at: new Date(),
      status: { type: 'active' },
      metadata: {},
    };
    await this.threadService.saveThread(threadMetadata);

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
   * Execute agent with a run state
   */
  private async runAgent(runState: any, thread: ThreadMetadata) {
    const runner = await RunnerFactory.createRunner({
      threadId: thread.id,
      userId: this.context.userId,
    });
    return await runner.run(this.agent, runState, {
      context: { threadId: thread.id, userId: this.context.userId },
      stream: true,
    });
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
          await this.threadMessageService.addThreadMessage(thread.id, event.item);
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
