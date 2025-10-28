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
   * Handle thread action or custom action
   */
  async *handleThreadAction(
    threadId: string,
    action: string,
    params: any
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

      yield* this.streamAgentResponseInternal(result, thread.id);
    }
  }

  /**
   * Create a new thread with optional initial input
   */
  async *createThreadWithInput(
    input?: string
  ): AsyncIterable<ThreadStreamEvent> {
    const thread = await this.createThread();
    yield this.eventFactory.createThreadCreatedEvent(thread);

    if (input) {
      const threadMetadata = this.threadService.threadToMetadata(thread);
      const userMessage = this.messageProcessor.buildUserMessageItem(input, threadMetadata);
      yield* this.processUserMessage(threadMetadata, userMessage);
    }
  }

  /**
   * Add user message to existing thread
   */
  async *addUserMessage(
    threadId: string,
    input: string
  ): AsyncIterable<ThreadStreamEvent> {
    const thread = await this.threadService.loadThread(threadId);
    const userMessage = this.messageProcessor.buildUserMessageItem(input, thread);
    yield* this.processUserMessage(thread, userMessage);
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

      yield* this.streamAgentResponseInternal(result as any, thread.id);
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

  /**
   * Stream agent response to ChatKit events (moved from agent_response_service.ts)
   */
  async *streamAgentResponseInternal(
    result: AsyncIterable<any>,
    threadId: string
  ): AsyncIterable<ThreadStreamEvent> {
    const { ChatKitItemFactory } = await import('../utils/chatkit/factories/chatkit_item_factory.ts');
    const { HandoffService } = await import('./chatkit/handoff_service.ts');
    const { ModelStreamHandler } = await import('./chatkit/model_stream_service.ts');

    const itemFactory = new ChatKitItemFactory(this.threadMessageService.threadMessageStore);

    // Initialize event handlers
    const processedHandoffs = new Set<string>();
    const toolService = this.toolService;
    const handoffService = new HandoffService(this.threadMessageService.threadMessageStore, processedHandoffs);
    const modelStreamHandler = new ModelStreamHandler(itemFactory);

    // Streaming state
    const streamState = {
      itemAdded: false,
      contentPartAdded: false,
      itemId: this.threadMessageService.threadMessageStore.generateItemId(),
      createdAt: Math.floor(Date.now() / 1000),
      fullText: '',
    };

    // Stream the events and delegate to appropriate handlers
    for await (const event of result) {
      // Comprehensive logging to debug event structure
      console.log('=== INCOMING EVENT ===');
      console.log('Full event:', JSON.stringify(event, null, 2));
      console.log('Event type:', event?.type);
      console.log('Event name:', (event as any).name);
      console.log('Event data:', (event as any).data);
      console.log('Event item:', (event as any).item);
      console.log('========================');

      const eventType = (event as any).data?.type || event?.type;
      const eventName = (event as any).name;

      // Handle tool approval requests → render a widget and pause (matches original logic)
      if (eventType === 'run_item_stream_event' && eventName === 'tool_approval_requested') {
        console.log('🔧 Processing tool approval request');
        const runState = (result as any).state;
        yield* toolService.handleToolApproval(event, threadId, runState);
        return;
      }

      // Route events to appropriate handlers
      if (event.type === 'run_item_stream_event') {
        console.log('📦 Processing run_item_stream_event');
        const item = (event as any).item;
        console.log('Item type:', item?.type);
        console.log('Event name:', eventName);

        if (item?.type === 'tool_call_output_item') {
          console.log('🔧 Handling tool_call_output_item');
          yield* toolService.handleToolCallOutput(event, threadId);
          continue;
        }

        if (item?.type === 'handoff_call_item') {
          console.log('🤝 Handling handoff_call_item');
          yield* handoffService.handleHandoffCall(event, threadId);
          continue;
        }

        if (item?.type === 'handoff_output_item') {
          console.log('📤 Handling handoff_output_item');
          yield* handoffService.handleHandoffOutput(event, threadId);
          continue;
        }

        if (eventName === 'tool_called') {
          console.log('🔧 Handling tool_called event');
          await toolService.handleToolCalled(event, threadId);
          continue;
        }

        console.log('⚠️ Unhandled run_item_stream_event:', item?.type, eventName);
      }

      // Handle model streaming events
      if (event.type === 'raw_model_stream_event') {
        console.log('🤖 Handling raw_model_stream_event');
        yield* modelStreamHandler.handleRawModelStream(event, threadId, streamState);
        continue;
      }

      // Handle direct text deltas
      if (
        (event.type === 'output_text_delta' || event.type === 'content.delta') &&
        ((event as any).data?.delta || (event as any).delta)
      ) {
        console.log('📝 Handling direct text delta:', event.type);
        yield* modelStreamHandler.handleDirectTextDelta(event, threadId, streamState);
        continue;
      }

      // Log any unhandled events
      console.log('❌ UNHANDLED EVENT TYPE:', event.type);
      console.log('Event details:', {
        type: event.type,
        name: (event as any).name,
        data: (event as any).data,
        item: (event as any).item,
      });
    }

    console.log('🏁 Stream completed, processing final events');
    console.log('Stream state:', {
      itemAdded: streamState.itemAdded,
      contentPartAdded: streamState.contentPartAdded,
      itemId: streamState.itemId,
      fullTextLength: streamState.fullText.length,
    });

    // Emit final content and done events
    if (streamState.contentPartAdded) {
      console.log('📝 Emitting final content update');
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
      console.log('➕ Emitting thread.item.added (no deltas received)');
      yield {
        type: 'thread.item.added',
        item: finalItem,
      } as any;
    }

    console.log('✅ Emitting thread.item.done');
    yield {
      type: 'thread.item.done',
      item: finalItem,
    } as any;

    // Save the final message to the database
    if (streamState.fullText) {
      console.log('💾 Saving final message to database');
      await this.threadMessageService.threadMessageStore.saveThreadMessage(threadId, finalItem);
    } else {
      console.log('⚠️ No text content to save');
    }
  }
}
