import { ThreadService } from '../services/thread_service.ts';
import { ThreadMessageService } from '../services/thread_message_service.ts';
import { ThreadRunStateService } from '../services/thread_run_state_service.ts';
import { Agent } from 'https://esm.sh/@openai/agents-core@0.0.1';
import { RunState } from '@openai/agents-core';
import { RunnerFactory } from '../utils/runner_factory.ts';
import {
  type ThreadMetadata,
  type Thread,
  type UserMessageItem,
  type ThreadStreamEvent,
} from '../types/chatkit.ts';

import { ChatKitEventFactory } from '../utils/chatkit/factories/chatkit_event_factory.ts';

/**
 * Handles all ChatKit operations
 * Responsible for processing requests, executing agent workflows, and streaming results
 */
export class ChatKitService {
  private eventFactory: ChatKitEventFactory;

  constructor(
    private threadService: ThreadService,
    private threadMessageService: ThreadMessageService,
    private threadRunStateService: ThreadRunStateService,
    private agent: Agent,
    private context: any
  ) {
    // Initialize specialized services
    this.eventFactory = new ChatKitEventFactory();
  }

  /**
   * Extracts plain text content from a ChatKit user message item (from ChatKitMessageProcessor)
   */
  private async extractMessageText(item: UserMessageItem): Promise<string> {
    if (typeof item.content === 'string') {
      return item.content.trim();
    } else if (Array.isArray(item.content)) {
      return item.content
        .filter((part) => part.type === 'input_text')
        .map((part) => (part as any).text)
        .join(' ')
        .trim();
    }
    return '';
  }

  /**
   * Loads and formats ChatKit conversation history (from ChatKitMessageProcessor)
   */
  private async loadConversationHistory(
    threadId: string
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const threadItems = await this.threadMessageService.threadMessageStore.loadThreadMessages(threadId, null, 100, 'asc');
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const threadItem of threadItems.data) {
      if ((threadItem as any).type === 'user_message') {
        const text = await this.extractMessageText(threadItem as UserMessageItem);
        if (text) {
          messages.push({ role: 'user', content: text });
        }
      } else if ((threadItem as any).type === 'assistant_message') {
        const assistantItem = threadItem as any;
        let text = '';

        if (typeof assistantItem.content === 'string') {
          text = assistantItem.content.trim();
        } else if (Array.isArray(assistantItem.content)) {
          text = assistantItem.content
            .filter((part: any) => part.type === 'output_text')
            .map((part: any) => part.text)
            .join(' ')
            .trim();
        }

        if (text) {
          messages.push({ role: 'assistant', content: text });
        }
      } else if ((threadItem as any).type === 'client_tool_call') {
        const toolCallItem = threadItem as any;
        const toolCallText = `[Tool call: ${toolCallItem.name}(${toolCallItem.arguments}) -> ${toolCallItem.output || 'pending'}]`;
        messages.push({ role: 'assistant', content: toolCallText });
      }
    }

    return messages;
  }

  /**
   * Builds a properly formatted ChatKit UserMessageItem (from ChatKitMessageProcessor)
   */
  private buildUserMessageItem(input: any, thread: any): UserMessageItem {
    let content = Array.isArray(input.content) ? input.content : [input.content as any];
    if (
      !content ||
      content.length === 0 ||
      !content[0] ||
      typeof (content[0] as any).type !== 'string'
    ) {
      content = [{ type: 'input_text', text: '' } as any];
    }

    const userMessage: UserMessageItem = {
      type: 'user_message',
      id: this.threadMessageService.threadMessageStore.generateItemId('message'),
      content,
      thread_id: thread.id,
      created_at: Math.floor(Date.now() / 1000),
      attachments: input.attachments || [],
    };

    if (input.quoted_text) {
      userMessage.quoted_text = input.quoted_text;
    }
    if (input.inference_options && Object.keys(input.inference_options).length > 0) {
      userMessage.inference_options = input.inference_options;
    }

    return userMessage;
  }

  /**
   * Converts ChatKit messages to Agent format (from AgentMessageConverter)
   */
  private convertToAgentFormat(messages: Array<{ role: 'user' | 'assistant'; content: string }>): any[] {
    return messages.map((msg) => {
      if (msg.role === 'user') {
        return {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: msg.content,
            },
          ],
        };
      } else {
        return {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text: msg.content,
            },
          ],
        };
      }
    });
  }

  /**
   * Handle tool approval/rejection actions (from ToolService.handleApproval)
   */
  private async handleApproval(
    thread: ThreadMetadata,
    action: any,
    params?: any
  ): Promise<{ runState: any; shouldExecute: boolean }> {
    const toolCallId = this.extractToolCallId(action, params);

    if (action.type === 'approve_tool_call' || action.type === 'tool.approve') {
      return await this.approveToolCall(thread, toolCallId);
    }

    if (action.type === 'reject_tool_call' || action.type === 'tool.deny') {
      return await this.rejectToolCall(thread, toolCallId);
    }

    return { runState: null, shouldExecute: false };
  }

  private extractToolCallId(action: any, params?: any): string {
    const toolCallId = action?.toolCallId || action?.payload?.tool_call_id || action?.tool_call_id;

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

  private async approveToolCall(
    thread: ThreadMetadata,
    toolCallId: string
  ): Promise<{ runState: any; shouldExecute: boolean }> {
    const serializedState = await this.threadRunStateService.loadRunState(thread.id);
    if (!serializedState) {
      return { runState: null, shouldExecute: false };
    }

    const agent = this.agent;
    const runState = await RunState.fromString(agent, serializedState);

    // Approve the specific tool call
    const interruptions = runState.getInterruptions();
    for (const approvalItem of interruptions) {
      const itemToolCallId =
        (approvalItem.rawItem as any)?.callId ||
        (approvalItem.rawItem as any)?.call_id ||
        (approvalItem.rawItem as any)?.id;
      if (itemToolCallId === toolCallId) {
        runState.approve(approvalItem, { alwaysApprove: false });
      }
    }

    return { runState, shouldExecute: true };
  }

  private async rejectToolCall(
    thread: ThreadMetadata,
    toolCallId: string
  ): Promise<{ runState: any; shouldExecute: boolean }> {
    const serializedState = await this.threadRunStateService.loadRunState(thread.id);
    if (!serializedState) {
      return { runState: null, shouldExecute: false };
    }

    const agent = this.agent;
    const runState = await RunState.fromString(agent, serializedState);

    // Reject the specific tool call
    const interruptions = runState.getInterruptions();
    for (const approvalItem of interruptions) {
      const itemToolCallId =
        (approvalItem.rawItem as any)?.callId ||
        (approvalItem.rawItem as any)?.call_id ||
        (approvalItem.rawItem as any)?.id;
      if (itemToolCallId === toolCallId) {
        runState.reject(approvalItem, { alwaysReject: false });
      }
    }

    return { runState, shouldExecute: true };
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
    const approvalResult = await this.handleApproval(thread, action, params);

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
      const userMessage = this.buildUserMessageItem(input, threadMetadata);
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
    const userMessage = this.buildUserMessageItem(input, thread);
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
    const messageText = await this.extractMessageText(userMessage);
    if (!messageText) return;

    try {
      const messages = await this.loadConversationHistory(thread.id);
      const agent = this.agent;
      const inputItems = this.convertToAgentFormat(messages);

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
   * Handle tool called events
   */
  private async handleToolCalledEvent(event: any, threadId: string, itemFactory: any): Promise<void> {
    const item = event.item;
    const tool = item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
    const toolName = tool?.name || 'tool';
    const argumentsText = tool?.arguments || '';

    // Save the tool call to conversation history
    const toolCallItem = itemFactory.createToolCallItem(
      threadId,
      toolName,
      toolCallId,
      argumentsText
    );
    await this.threadMessageService.threadMessageStore.saveThreadMessage(threadId, toolCallItem);
  }

  /**
   * Handle tool approval requests
   */
  private async *handleToolApprovalEvent(
    event: any,
    threadId: string,
    itemFactory: any,
    runState?: any
  ): AsyncIterable<ThreadStreamEvent> {
    const { WidgetFactory } = await import('../utils/chatkit/factories/widget_factory.ts');
    const item = event.item;
    const tool = item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
    const toolName = tool?.name || 'tool';
    const argumentsText = tool?.arguments || '';

    // Save the run state so we can resume after approval/rejection
    if (runState) {
      const serializedState = JSON.stringify(runState);
      await this.threadRunStateService.saveRunState(threadId, serializedState);
    }

    // Create approval widget
    const approvalItemId = itemFactory.createWidgetItem(threadId, 'widget', {}).id;
    const widget = WidgetFactory.createToolApprovalWidget(
      toolName,
      argumentsText,
      toolCallId,
      approvalItemId
    );

    const widgetItem = itemFactory.createWidgetItem(threadId, 'widget', widget);
    widgetItem.id = approvalItemId; // Override with the specific ID

    yield {
      type: 'thread.item.added',
      item: widgetItem,
    } as any;

    yield {
      type: 'thread.item.done',
      item: widgetItem,
    } as any;

    // Pause further streaming until action arrives
    return;
  }

  /**
   * Handle tool call output events
   */
  private async *handleToolCallOutputEvent(event: any, threadId: string, itemFactory: any): AsyncIterable<ThreadStreamEvent> {
    const { WidgetFactory } = await import('../utils/chatkit/factories/widget_factory.ts');
    const item = event.item;
    const tool = item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
    const toolName = tool?.name || 'tool';
    const output = tool?.output || '';

    // Save the tool call output to conversation history
    const toolCallOutputItem = itemFactory.createToolCallOutputItem(
      threadId,
      toolName,
      toolCallId,
      output
    );
    await this.threadMessageService.threadMessageStore.saveThreadMessage(threadId, toolCallOutputItem);

    // Create and emit tool result widget
    const toolResultWidget = WidgetFactory.createToolResultWidget(toolName, output);
    const toolResultItem = itemFactory.createWidgetItem(
      threadId,
      'tool_result',
      toolResultWidget
    );

    yield this.eventFactory.createItemAddedEvent(toolResultItem);
  }

  /**
   * Handle handoff call events
   */
  private async *handleHandoffCall(
    event: any,
    threadId: string,
    itemFactory: any,
    processedHandoffs: Set<string>
  ): AsyncIterable<ThreadStreamEvent> {
    const { WidgetFactory } = await import('../utils/chatkit/factories/widget_factory.ts');
    const item = event.item;
    const handoff = item?.rawItem;
    const handoffCallId = handoff?.callId || handoff?.call_id || handoff?.id || 'unknown';
    const handoffName = handoff?.name || 'handoff';
    const argumentsText = handoff?.arguments || '';

    // Check if we've already processed this handoff to avoid duplicates
    const handoffKey = `handoff_${handoffName}_${threadId}`;
    if (processedHandoffs.has(handoffKey)) {
      return;
    }
    processedHandoffs.add(handoffKey);

    // Create and emit handoff widget
    const handoffWidget = WidgetFactory.createHandoffWidget(handoffName);
    const handoffItem = itemFactory.createWidgetItem(threadId, 'handoff', handoffWidget);

    // Save the handoff tool call to conversation history
    const handoffToolCallItem = itemFactory.createHandoffToolCallItem(
      threadId,
      handoffName,
      handoffCallId,
      argumentsText
    );
    await this.threadMessageService.threadMessageStore.saveThreadMessage(threadId, handoffToolCallItem);

    yield this.eventFactory.createItemAddedEvent(handoffItem);
  }

  /**
   * Handle handoff output events
   */
  private async *handleHandoffOutput(
    event: any,
    threadId: string,
    itemFactory: any,
    processedHandoffs: Set<string>
  ): AsyncIterable<ThreadStreamEvent> {
    const { WidgetFactory } = await import('../utils/chatkit/factories/widget_factory.ts');
    const item = event.item;
    const handoff = item?.rawItem;
    const handoffCallId = handoff?.callId || handoff?.call_id || handoff?.id || 'unknown';
    const output = handoff?.output || '';

    // Check if we've already processed this handoff output to avoid duplicates
    const handoffOutputKey = `handoff_output_${threadId}`;
    if (processedHandoffs.has(handoffOutputKey)) {
      return;
    }
    processedHandoffs.add(handoffOutputKey);

    // Create and emit handoff result widget
    const handoffResultWidget = WidgetFactory.createHandoffResultWidget(output);
    const handoffResultItem = itemFactory.createWidgetItem(
      threadId,
      'handoff_result',
      handoffResultWidget
    );

    // Save the handoff result to conversation history
    const handoffResultToolItem = itemFactory.createHandoffResultToolItem(
      threadId,
      handoffCallId,
      output
    );
    await this.threadMessageService.threadMessageStore.saveThreadMessage(threadId, handoffResultToolItem);

    yield {
      type: 'thread.item.added',
      item: handoffResultItem,
    } as any;
  }

  /**
   * Handle raw model stream events
   */
  private async *handleRawModelStream(
    event: any,
    threadId: string,
    itemFactory: any,
    state: {
      itemAdded: boolean;
      contentPartAdded: boolean;
      itemId: string;
      createdAt: number;
      fullText: string;
    }
  ): AsyncIterable<ThreadStreamEvent> {
    const innerEvent = event.data?.event || (event as any).data?.event;
    const eventData = event.data;

    // Handle different event formats
    let delta = null;

    // Format 1: direct delta in event.data
    if (eventData?.type === 'output_text_delta' && eventData?.delta) {
      delta = eventData.delta;
    }
    // Format 2: delta in innerEvent
    else if (
      innerEvent?.type === 'response.output_text.delta' ||
      innerEvent?.type === 'output_text_delta'
    ) {
      delta = innerEvent.delta;
    }
    // Format 3: delta in choices array (OpenAI format)
    else if (innerEvent?.type === 'model' && innerEvent?.choices?.[0]?.delta?.content) {
      delta = innerEvent.choices[0].delta.content;
    }

    if (delta) {
      console.log('📝 ModelStreamHandler processing delta:', delta);
      // First delta: emit thread.item.added
      if (!state.itemAdded) {
        const assistantMessage = itemFactory.createAssistantMessageItem(
          threadId,
          state.itemId,
          state.createdAt
        );
        yield {
          type: 'thread.item.added',
          item: assistantMessage,
        } as any;
        state.itemAdded = true;
      }

      // Second: emit content_part.added
      if (!state.contentPartAdded) {
        yield {
          type: 'thread.item.updated',
          item_id: state.itemId,
          update: {
            type: 'assistant_message.content_part.added',
            content_index: 0,
            content: {
              annotations: [],
              text: '',
              type: 'output_text',
            },
          },
        };
        state.contentPartAdded = true;
      }

      // Emit delta
      state.fullText += delta;
      yield {
        type: 'thread.item.updated',
        item_id: state.itemId,
        update: {
          type: 'assistant_message.content_part.text_delta',
          content_index: 0,
          delta: delta,
        },
      };
    } else {
      console.log('⚠️ ModelStreamHandler: No delta found in event');
      console.log('Event data:', eventData);
      console.log('Inner event:', innerEvent);
    }
  }

  /**
   * Handle direct text delta events
   */
  private async *handleDirectTextDelta(
    event: any,
    threadId: string,
    itemFactory: any,
    state: {
      itemAdded: boolean;
      contentPartAdded: boolean;
      itemId: string;
      createdAt: number;
      fullText: string;
    }
  ): AsyncIterable<ThreadStreamEvent> {
    const delta = event.data?.delta || event?.delta;

    // First delta: emit thread.item.added
    if (!state.itemAdded) {
      const assistantMessage = itemFactory.createAssistantMessageItem(
        threadId,
        state.itemId,
        state.createdAt
      );
      yield {
        type: 'thread.item.added',
        item: assistantMessage,
      } as any;
      state.itemAdded = true;
    }

    // Second: emit content_part.added
    if (!state.contentPartAdded) {
      yield {
        type: 'thread.item.updated',
        item_id: state.itemId,
        update: {
          type: 'assistant_message.content_part.added',
          content_index: 0,
          content: {
            annotations: [],
            text: '',
            type: 'output_text',
          },
        },
      };
      state.contentPartAdded = true;
    }

    // Emit delta
    state.fullText += delta;
    yield {
      type: 'thread.item.updated',
      item_id: state.itemId,
      update: {
        type: 'assistant_message.content_part.text_delta',
        content_index: 0,
        delta: delta,
      },
    };
  }

  /**
   * Stream agent response to ChatKit events (moved from agent_response_service.ts)
   */
  async *streamAgentResponseInternal(
    result: AsyncIterable<any>,
    threadId: string
  ): AsyncIterable<ThreadStreamEvent> {
    const { ChatKitItemFactory } = await import('../utils/chatkit/factories/chatkit_item_factory.ts');

    const itemFactory = new ChatKitItemFactory(this.threadMessageService.threadMessageStore);

    // Initialize event handlers
    const processedHandoffs = new Set<string>();

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
        yield* this.handleToolApprovalEvent(event, threadId, itemFactory, runState);
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
          yield* this.handleToolCallOutputEvent(event, threadId, itemFactory);
          continue;
        }

        if (item?.type === 'handoff_call_item') {
          console.log('🤝 Handling handoff_call_item');
          yield* this.handleHandoffCall(event, threadId, itemFactory, processedHandoffs);
          continue;
        }

        if (item?.type === 'handoff_output_item') {
          console.log('📤 Handling handoff_output_item');
          yield* this.handleHandoffOutput(event, threadId, itemFactory, processedHandoffs);
          continue;
        }

        if (eventName === 'tool_called') {
          console.log('🔧 Handling tool_called event');
          await this.handleToolCalledEvent(event, threadId, itemFactory);
          continue;
        }

        console.log('⚠️ Unhandled run_item_stream_event:', item?.type, eventName);
      }

      // Handle model streaming events
      if (event.type === 'raw_model_stream_event') {
        console.log('🤖 Handling raw_model_stream_event');
        yield* this.handleRawModelStream(event, threadId, itemFactory, streamState);
        continue;
      }

      // Handle direct text deltas
      if (
        (event.type === 'output_text_delta' || event.type === 'content.delta') &&
        ((event as any).data?.delta || (event as any).delta)
      ) {
        console.log('📝 Handling direct text delta:', event.type);
        yield* this.handleDirectTextDelta(event, threadId, itemFactory, streamState);
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
