import { ThreadService } from '../services/thread_service.ts';
import { ThreadMessageService } from '../services/thread_message_service.ts';
import { ThreadRunStateService } from '../services/thread_run_state_service.ts';
import { Agent } from 'https://esm.sh/@openai/agents-core@0.0.1';
import { RunnerFactory } from '../utils/runner_factory.ts';
import {
  type ThreadMetadata,
  type Thread,
  type UserMessageItem,
  type ThreadStreamEvent,
} from '../types/chatkit.ts';

import { ChatKitMessageProcessor } from '../utils/chatkit/processors/chatkit_message_processor.ts';
import { AgentMessageConverter } from '../utils/chatkit/converters/agent_message_converter.ts';
import { ChatKitEventFactory } from '../utils/chatkit/factories/chatkit_event_factory.ts';
import { ToolService } from './chatkit/tool_service.ts';

/**
 * Handles all ChatKit operations
 * Responsible for processing requests, executing agent workflows, and streaming results
 */
export class ChatKitService {
  private messageProcessor: ChatKitMessageProcessor;
  private agentConverter: AgentMessageConverter;
  private eventFactory: ChatKitEventFactory;
  private toolService: ToolService;

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
    this.toolService = new ToolService(
      this.threadMessageService.threadMessageStore,
      this.threadRunStateService,
      this.agent,
      this.context
    );
  }

  /**
   * Get thread by ID (delegates to ThreadService)
   */
  async getThreadById(threadId: string): Promise<object> {
    return await this.threadService.getThreadById(threadId);
  }

  /**
   * List threads with pagination (delegates to ThreadService)
   */
  async listThreads(
    limit: number = 20,
    after: string | null = null,
    order: string = 'desc'
  ): Promise<object> {
    return await this.threadService.listThreads(limit, after, order);
  }

  /**
   * List thread messages (delegates to ThreadMessageService)
   */
  async listThreadMessages(
    threadId: string,
    after: string | null = null,
    limit: number = 20,
    order: string = 'asc'
  ): Promise<object> {
    return await this.threadMessageService.listThreadMessages(threadId, after, limit, order);
  }

  /**
   * Update thread title (delegates to ThreadService)
   */
  async updateThread(threadId: string, title: string): Promise<object> {
    return await this.threadService.updateThread(threadId, title);
  }

  /**
   * Delete thread (delegates to ThreadService)
   */
  async deleteThread(threadId: string): Promise<object> {
    await this.threadService.deleteThread(threadId);
    return {};
  }

  /**
   * Handle thread action or custom action
   */
  async *handleThreadAction(
    threadId: string,
    action: string,
    params: any,
    streamAgentResponse: any
  ): AsyncIterable<ThreadStreamEvent> {
    const thread = await this.threadService.loadThread(threadId);
    yield this.eventFactory.createThreadUpdatedEvent(thread);
    const approvalResult = await this.toolService.handleApproval(thread, action, params);

    if (approvalResult.shouldExecute && approvalResult.runState) {
      // Execute the agent with the modified run state
      const result = await this.threadRunStateService.runAgent(
        approvalResult.runState,
        thread,
        this.agent,
        this.context
      );
      await this.threadRunStateService.clearRunState(thread.id);

      yield* streamAgentResponse(
        result,
        thread.id,
        this.threadMessageService.threadMessageStore,
        this.threadRunStateService,
        this.agent,
        this.context
      );
    }
  }

  /**
   * Create a new thread with optional initial input
   */
  async *createThreadWithInput(
    streamAgentResponse: any,
    input?: string
  ): AsyncIterable<ThreadStreamEvent> {
    const thread = await this.createThread();
    yield this.eventFactory.createThreadCreatedEvent(thread);

    if (input) {
      const threadMetadata = this.threadService.threadToMetadata(thread);
      const userMessage = this.messageProcessor.buildUserMessageItem(input, threadMetadata);
      yield* this.processUserMessage(threadMetadata, userMessage, streamAgentResponse);
    }
  }

  /**
   * Add user message to existing thread
   */
  async *addUserMessage(
    threadId: string,
    input: string,
    streamAgentResponse: any
  ): AsyncIterable<ThreadStreamEvent> {
    const thread = await this.threadService.loadThread(threadId);
    const userMessage = this.messageProcessor.buildUserMessageItem(input, thread);
    yield* this.processUserMessage(thread, userMessage, streamAgentResponse);
  }

  /**
   * Process user messages and coordinate the response
   */
  private async *processUserMessage(
    thread: ThreadMetadata,
    userMessage: UserMessageItem,
    streamAgentResponse: any
  ): AsyncIterable<ThreadStreamEvent> {
    await this.threadMessageService.addThreadMessage(thread.id, userMessage);

    yield this.eventFactory.createItemAddedEvent(userMessage);
    yield this.eventFactory.createItemDoneEvent(userMessage);

    yield* this.processEvents(thread, () => this.respond(thread, userMessage, streamAgentResponse));
  }

  /**
   * Execute agent response to a user message
   */
  async *respond(
    thread: ThreadMetadata,
    userMessage: UserMessageItem,
    streamAgentResponse: any
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
        this.threadRunStateService,
        this.agent,
        this.context
      );
    } catch (error) {
      console.error('[AgentRunner] Error:', error);
      throw error;
    }
  }

  /**
   * Create a new thread (delegates to ThreadService)
   */
  private async createThread(): Promise<Thread> {
    const threadMetadata = await this.threadService.createThread();

    // Return as Thread type for compatibility
    const thread: Thread = {
      id: threadMetadata.id,
      created_at: Math.floor(threadMetadata.created_at.getTime() / 1000),
      status: threadMetadata.status || { type: 'active' },
      metadata: threadMetadata.metadata,
      items: { data: [], has_more: false, after: null },
    };
    return thread;
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
