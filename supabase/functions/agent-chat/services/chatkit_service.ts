import type { MemoryStore } from '../stores/memory_store.ts';
import { markApproved, clearApproved } from '../stores/approval_store.ts';
import { Runner, RunState } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';
import { AgentFactory } from '../services/agent_service.ts';
import {
  isStreamingReq,
  type ChatKitRequest,
  type ThreadMetadata,
  type Thread,
  type UserMessageItem,
  type AssistantMessageItem,
  type ThreadStreamEvent,
  type ThreadCreatedEvent,
  type ThreadUpdatedEvent,
  type ThreadItemDoneEvent,
  type ThreadItemAddedEvent,
  type UserMessageInput,
} from '../types/chatkit-types.ts';

export abstract class ChatKitServer<TContext = any> {
  private widgetToolCallMap: Map<string, string> = new Map(); // itemId -> toolCallId

  constructor(protected store: MemoryStore<TContext>, protected agentFactory: AgentFactory, protected context: TContext) {}

  abstract respond(thread: ThreadMetadata, item: UserMessageItem | null, context: TContext): AsyncIterable<ThreadStreamEvent>;

  // Helper method to stream agent responses - implemented as standalone function below

  // Helper to build a full Thread object from ThreadMetadata
  private buildThread(metadata: ThreadMetadata): Thread {
    return {
      id: metadata.id,
      created_at: typeof metadata.created_at === 'number' ? metadata.created_at : Math.floor(new Date(metadata.created_at as unknown as Date).getTime() / 1000),
      status: metadata.status || { type: 'active' },
      metadata: metadata.metadata || {},
      items: { data: [], has_more: false, after: null },
    };
  }

  // Optional: handle actions (approve/reject tool calls)
  async *action(thread: ThreadMetadata, action: any, context: TContext, params?: any): AsyncIterable<ThreadStreamEvent> {
    console.log('[ChatKitServer] Handling action:', { action, threadId: thread.id });

    // Try to get toolCallId from action in multiple ways
    let toolCallId = action?.toolCallId || action?.payload?.tool_call_id || action?.tool_call_id;
    
    // If toolCallId is not in action, load the widget item from database and extract it
    const itemId = action?.item_id || (context as any)?.item_id || params?.item_id;
    if (!toolCallId && itemId) {
      console.log('[ChatKitServer] Looking up toolCallId for item:', itemId);
      
      // Load the widget item from the database
      const widgetItem = await this.store.loadThreadItem(itemId, thread.id);
      console.log('[ChatKitServer] Loaded widget item:', JSON.stringify(widgetItem, null, 2));
      
      if (widgetItem && (widgetItem as any).widget) {
        // Extract toolCallId from the widget's confirm action
        const widget = (widgetItem as any).widget;
        toolCallId = widget?.confirm?.action?.toolCallId || widget?.cancel?.action?.toolCallId;
        if (toolCallId) {
          console.log('[ChatKitServer] Found toolCallId in widget:', toolCallId);
        }
      }
    }
    
    if (!toolCallId) {
      console.warn('[ChatKitServer] No toolCallId found in action or widget item');
      return;
    }

    if (action.type === 'approve_tool_call' || action.type === 'tool.approve') {
      console.log('[ChatKitServer] Approving tool call:', toolCallId);
      markApproved(thread.id, toolCallId);
      
      // Load the saved run state and resume the agent
      const serializedState = await this.store.loadRunState(thread.id);
      if (serializedState) {
        console.log('[ChatKitServer] Resuming agent with approved run state');
        
        // Create a new agent and runner
        const agent = await this.agentFactory.createAgent((this.context as any).agentId, (this.context as any).userId);
        
        // Deserialize the RunState (use fromString as per OpenAI docs)
        const runState = await RunState.fromString(agent, serializedState);
        
        // Get interruptions (approval items)
        const interruptions = runState.getInterruptions();
        console.log('[ChatKitServer] Found', interruptions.length, 'interruptions');
        
        // Approve only the specific tool call that was approved
        for (const approvalItem of interruptions) {
          const itemToolCallId = (approvalItem.rawItem as any)?.callId || (approvalItem.rawItem as any)?.call_id || (approvalItem.rawItem as any)?.id;
          if (itemToolCallId === toolCallId) {
            runState.approve(approvalItem, { alwaysApprove: false });
            console.log('[ChatKitServer] Approved tool call:', (approvalItem.rawItem as any).name);
          } else {
            console.log('[ChatKitServer] Skipping approval for tool call:', (approvalItem.rawItem as any).name, 'ID:', itemToolCallId);
          }
        }
        
        const modelProvider = new OpenAIProvider({
          apiKey: Deno.env.get('OPENAI_API_KEY') || '',
        });

        const runConfig = {
          model: 'gpt-4o-mini',
          modelProvider: modelProvider,
          traceIncludeSensitiveData: true,
          tracingDisabled: false,
          metadata: {
            thread_id: thread.id,
            user_id: (this.context as any).userId,
          },
        };

        const runner = new Runner(runConfig);

        // Resume the agent with the loaded state
        const result = await runner.run(agent, runState, { 
          context: { threadId: thread.id, userId: (this.context as any).userId },
          stream: true 
        });
        
        // Clear the run state after resuming so it doesn't interfere with new messages
        await this.store.clearRunState(thread.id);
        
        // Stream the resumed agent response
        yield* streamAgentResponse(result, thread.id, this.store);
      } else {
        console.log('[ChatKitServer] No run state found, just updating thread status');
        // Just update thread status if no run state
        const updatedThread = this.buildThread(thread);
        updatedThread.status = { type: 'active' };
        yield {
          type: 'thread.updated',
          thread: updatedThread,
        } as ThreadUpdatedEvent;
      }
      return;
    }

    if (action.type === 'reject_tool_call' || action.type === 'tool.deny') {
      console.log('[ChatKitServer] Rejecting tool call:', toolCallId);
      clearApproved(thread.id, toolCallId);
      
      // Load the saved run state and resume the agent
      const serializedState = await this.store.loadRunState(thread.id);
      if (serializedState) {
        console.log('[ChatKitServer] Resuming agent with rejected run state');
        
        // Create a new agent and runner
        const agent = await this.agentFactory.createAgent((this.context as any).agentId, (this.context as any).userId);
        
        // Deserialize the RunState (use fromString as per OpenAI docs)
        const runState = await RunState.fromString(agent, serializedState);
        
        // Get interruptions (approval items)
        const interruptions = runState.getInterruptions();
        console.log('[ChatKitServer] Found', interruptions.length, 'interruptions');
        
        // Reject only the specific tool call that was rejected
        for (const approvalItem of interruptions) {
          const itemToolCallId = (approvalItem.rawItem as any)?.callId || (approvalItem.rawItem as any)?.call_id || (approvalItem.rawItem as any)?.id;
          if (itemToolCallId === toolCallId) {
            runState.reject(approvalItem, { alwaysReject: false });
            console.log('[ChatKitServer] Rejected tool call:', (approvalItem.rawItem as any).name);
          } else {
            console.log('[ChatKitServer] Skipping rejection for tool call:', (approvalItem.rawItem as any).name, 'ID:', itemToolCallId);
          }
        }
        
        const modelProvider = new OpenAIProvider({
          apiKey: Deno.env.get('OPENAI_API_KEY') || '',
        });

        const runConfig = {
          model: 'gpt-4o-mini',
          modelProvider: modelProvider,
          traceIncludeSensitiveData: true,
          tracingDisabled: false,
          metadata: {
            thread_id: thread.id,
            user_id: (this.context as any).userId,
          },
        };

        const runner = new Runner(runConfig);

        // Resume the agent with the loaded state
        const result = await runner.run(agent, runState, { 
          context: { threadId: thread.id, userId: (this.context as any).userId },
          stream: true 
        });
        
        // Clear the run state after resuming so it doesn't interfere with new messages
        await this.store.clearRunState(thread.id);
        
        // Stream the resumed agent response
        yield* streamAgentResponse(result, thread.id, this.store);
      } else {
        console.log('[ChatKitServer] No run state found, just updating thread status');
        // Just update thread status if no run state
        const updatedThread = this.buildThread(thread);
        updatedThread.status = { type: 'active' };
        yield {
          type: 'thread.updated',
          thread: updatedThread,
        } as ThreadUpdatedEvent;
      }
      return;
    }
  }

  async process(request: string | ArrayBuffer | Uint8Array, context: TContext): Promise<{ streaming: boolean; result: AsyncIterable<Uint8Array> | object }> {
    const requestStr = typeof request === 'string' ? request : new TextDecoder().decode(request);
    const parsedRequest: ChatKitRequest = JSON.parse(requestStr);
    console.log('[ChatKitServer] Received request:', parsedRequest.type);
    console.log('[ChatKitServer] Request:', parsedRequest);

    if (isStreamingReq(parsedRequest)) {
      return {
        streaming: true,
        result: this.processStreaming(parsedRequest, context),
      };
    } else {
      const result = await this.processNonStreaming(parsedRequest, context);
      return { streaming: false, result };
    }
  }

  private async processNonStreaming(request: ChatKitRequest, _context: TContext): Promise<object> {
    switch (request.type) {
      case 'threads.get_by_id':
        return await this.store.loadFullThread(request.params!.thread_id!);

      case 'threads.list': {
        const params = request.params || {};
        const threads = await this.store.loadThreads(params.limit || 20, params.after || null, params.order || 'desc');
        return {
          data: await Promise.all(threads.data.map((t) => this.store.loadFullThread(t.id))),
          has_more: threads.has_more,
          after: threads.after,
        };
      }

      case 'items.list': {
        const params = request.params!;
        return await this.store.loadThreadItems(params.thread_id!, params.after || null, params.limit || 20, params.order || 'asc');
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

      case 'threads.action':
      case 'threads.custom_action':
        // These should be handled as streaming requests, not non-streaming
        throw new Error(`Request type ${request.type} should be handled as streaming`);

      case 'threads.retry_after_item':
        // Handle retry requests - for now just return empty response
        return {};

      default:
        throw new Error(`Unknown request type: ${(request as any).type}`);
    }
  }

  private async *processStreaming(request: ChatKitRequest, context: TContext): AsyncIterable<Uint8Array> {
    const encoder = new TextEncoder();

    try {
      for await (const event of this.processStreamingImpl(request, context)) {
        // Validate event structure before emitting
        if (event.type === 'thread.created' || event.type === 'thread.updated') {
          const thread = (event as any).thread;
          if (!thread) {
            console.error('[ChatKitServer] Invalid thread event - missing thread:', event);
            throw new Error(`Invalid ${event.type} event: thread is required`);
          }
          if (!thread.items) {
            console.error('[ChatKitServer] Invalid thread event - missing items field:', JSON.stringify(thread, null, 2));
            throw new Error(`Invalid ${event.type} event: thread.items is required`);
          }
          if (!Array.isArray(thread.items.data)) {
            console.error('[ChatKitServer] Invalid thread event - items.data is not an array:', JSON.stringify(thread.items, null, 2));
            throw new Error(`Invalid ${event.type} event: thread.items.data must be an array`);
          }
          if (!thread.status || !thread.status.type) {
            console.error('[ChatKitServer] Invalid thread event - missing or invalid status:', JSON.stringify(thread.status, null, 2));
            throw new Error(`Invalid ${event.type} event: thread.status.type is required`);
          }
        }
        
        const data = JSON.stringify(event);
        console.log('[ChatKitServer] Emitting SSE', data);
        yield encoder.encode(`data: ${data}\n\n`);
      }
    } catch (error) {
      console.error('[ChatKitServer] Error in streaming:', error);
      const errorEvent: any = {
        type: 'error',
        code: 'STREAM_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        allow_retry: true,
      };
      const data = JSON.stringify(errorEvent);
      yield encoder.encode(`data: ${data}\n\n`);
    }
  }

  private async *processStreamingImpl(request: ChatKitRequest, context: TContext): AsyncIterable<ThreadStreamEvent> {
    switch (request.type) {
      case 'threads.action':
      case 'threads.custom_action': {
        // Handle action requests (approve/reject tool calls)
        const thread = await this.store.loadThread(request.params.thread_id);
        // Unlock thread when action arrives; client can re-lock if needed
        const updatedThread = await this.buildThread(thread);
        updatedThread.status = { type: 'active' };
        yield {
          type: 'thread.updated',
          thread: updatedThread,
        } as ThreadUpdatedEvent;
        yield* this.action(thread, request.params.action, context, request.params);
        break;
      }

      case 'threads.create': {
        const threadId = this.store.generateThreadId();
        const createdAt = Math.floor(Date.now() / 1000);
        const threadObj: Thread = {
          id: threadId,
          created_at: createdAt,
          status: { type: 'active' },
          metadata: {},
          items: { data: [], has_more: false, after: null },
        };
        await this.store.saveThread(threadObj);

        // Debug log for first SSE event
        console.log('[ChatKitServer] Emitting thread.created', threadObj);
        yield {
          type: 'thread.created',
          thread: {
            id: threadObj.id,
            created_at: threadObj.created_at,
            status: threadObj.status,
            metadata: threadObj.metadata,
            items: { data: [], has_more: false, after: null },
          },
        } as ThreadCreatedEvent;

        // Only create user message if input is provided
        if (request.params!.input) {
          const userMessage = await this.buildUserMessageItem(request.params!.input!, threadObj);
          yield* this.processNewThreadItemRespond(threadObj, userMessage, context);
        }
        break;
      }

      case 'threads.add_user_message': {
        const thread = await this.store.loadThread(request.params!.thread_id!);
        const userMessage = await this.buildUserMessageItem(request.params!.input!, thread);

        yield* this.processNewThreadItemRespond(thread, userMessage, context);
        break;
      }

      default:
        throw new Error(`Unknown streaming request type: ${(request as any).type}`);
    }
  }

  private async *processNewThreadItemRespond(thread: ThreadMetadata, item: UserMessageItem, context: TContext): AsyncIterable<ThreadStreamEvent> {
    await this.store.addThreadItem(thread.id, item);

    // Emit user message lifecycle in order expected by ChatKit
    const itemAdded = { ...item, created_at: typeof (item as any).created_at === 'number' ? (item as any).created_at : Math.floor(new Date((item as any).created_at).getTime() / 1000) } as any;
    console.log('[ChatKitServer] Emitting thread.item.added', itemAdded);
    yield {
      type: 'thread.item.added',
      item: itemAdded,
    } as ThreadItemAddedEvent;

    const itemDone = itemAdded;
    console.log('[ChatKitServer] Emitting thread.item.done', itemDone);
    yield {
      type: 'thread.item.done',
      item: itemDone,
    } as ThreadItemDoneEvent;

    // Now process assistant response
    yield* this.processEvents(thread, context, () => this.respond(thread, item, context));
  }

  private async *processEvents(thread: ThreadMetadata, _context: TContext, stream: () => AsyncIterable<ThreadStreamEvent>): AsyncIterable<ThreadStreamEvent> {
    // Allow the response to start streaming
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      for await (const event of stream()) {
        if (event.type === 'thread.item.done') {
          // Don't save widgets to database - they are ephemeral
          if (event.item.type !== 'widget') {
            await this.store.addThreadItem(thread.id, event.item);
          }
        }

        yield event;
      }
    } catch (error) {
      const errorEvent: any = {
        type: 'error',
        code: 'STREAM_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        allow_retry: true,
      };
      yield errorEvent;
    }
  }

  private async buildUserMessageItem(input: UserMessageInput, thread: ThreadMetadata): Promise<UserMessageItem> {
    console.log('[ChatKitServer] buildUserMessageItem - input.content type:', typeof input.content, 'is array:', Array.isArray(input.content));
    
    // Ensure content is always an array
    let content = Array.isArray(input.content) ? input.content : [input.content as any];
    // Coerce invalid/empty content to a minimal valid input_text part
    if (!content || content.length === 0 || !content[0] || typeof (content[0] as any).type !== 'string') {
      content = [{ type: 'input_text', text: '' } as any];
    }
    console.log('[ChatKitServer] buildUserMessageItem - normalized content is array:', Array.isArray(content));
    
    const userMessage: UserMessageItem = {
      type: 'user_message',
      id: this.store.generateItemId('message'),
      content,
      thread_id: thread.id,
      created_at: Math.floor(Date.now() / 1000),
      // Always include attachments as an empty array to prevent undefined errors
      attachments: input.attachments || [],
    };
    
    // Only include optional fields if they have actual values
    if (input.quoted_text) {
      userMessage.quoted_text = input.quoted_text;
    }
    if (input.inference_options && Object.keys(input.inference_options).length > 0) {
      userMessage.inference_options = input.inference_options;
    }
    
    return userMessage;
  }
}

// Helper to stream agent response to ChatKit events
export async function* streamAgentResponse(
  result: AsyncIterable<any>,
  threadId: string,
  store: MemoryStore<any>,
  runner?: any,
  supabaseUrl?: string,
  userJwt?: string,
  inputMessages?: any[]
): AsyncIterable<ThreadStreamEvent> {
  console.log('[streamAgentResponse] Starting with runner:', runner ? 'present' : 'absent');
  let fullText = '';
  let itemAdded = false;
  let contentPartAdded = false;
  const itemId = store.generateItemId('message');
  const createdAt = Math.floor(Date.now() / 1000);
  
  // Track processed handoffs to avoid duplicates
  const processedHandoffs = new Set<string>();

  // Stream the events
  for await (const event of result) {
    console.log('[streamAgentResponse] Received event:', JSON.stringify(event, null, 2));
    
    const data = (event as any).data || event;
    const eventType = data?.type || event?.type;
    const eventName = (event as any).name;
    
    console.log('[streamAgentResponse] Event type:', eventType, 'Name:', eventName, 'Data:', JSON.stringify(data, null, 2));
    
    // Debug: Log all run_item_stream_event details
    if (event.type === 'run_item_stream_event') {
      const item = (event as any).item;
      console.log('[streamAgentResponse] ⚡ Run item stream event detected!');
      console.log('[streamAgentResponse] ⚡ Item type:', item?.type);
      console.log('[streamAgentResponse] ⚡ Full item:', JSON.stringify(item, null, 2));
      
      // Check specifically for the events we're looking for
      if (item?.type === 'tool_call_output_item') {
        console.log('[streamAgentResponse] 🎯 FOUND tool_call_output_item!');
      }
      if (item?.type === 'handoff_call_item') {
        console.log('[streamAgentResponse] 🎯 FOUND handoff_call_item!');
      }
      if (item?.type === 'handoff_output_item') {
        console.log('[streamAgentResponse] 🎯 FOUND handoff_output_item!');
      }
    }

    // Handle tool call output items (tool results) → save as custom_tool_call_output and display as widget
    if (event.type === 'run_item_stream_event' && (event as any).item?.type === 'tool_call_output_item') {
      const item = (event as any).item;
      const tool = item?.rawItem;
      const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
      const toolName = tool?.name || 'tool';
      const output = tool?.output || '';

      // Don't skip handoff tool calls - they should be saved to database
      console.log('[streamAgentResponse] Processing tool call output:', toolName, 'with output:', output);

      console.log('[streamAgentResponse] Tool call output detected:', toolName, 'with output:', output);

      // Save the tool call output as a custom_tool_call_output item to conversation history
      const toolCallOutputItem = {
        type: 'client_tool_call' as const,
        id: store.generateItemId('tool_call_output'),
        thread_id: threadId,
        created_at: Math.floor(Date.now() / 1000),
        name: toolName,
        call_id: toolCallId,
        arguments: '',
        output: output,
        status: 'completed',
        content: {},
      };

      await store.saveThreadItem(threadId, toolCallOutputItem);
      console.log('[streamAgentResponse] Saved tool call output to conversation history:', toolCallOutputItem.id);

      // Create a tool result widget using ChatKit widget format
      // Handle case where output might be an object with .text property
      let outputText = 'Tool executed successfully.';
      if (output) {
        if (typeof output === 'string') {
          outputText = output;
        } else if (output.text) {
          outputText = String(output.text);
        } else {
          outputText = JSON.stringify(output);
        }
      }
      const toolResultWidget = {
        type: 'Card',
        size: 'sm',
        children: [
          {
            type: 'Row',
            align: 'center',
            gap: 3,
            children: [
              {
                type: 'Box',
                background: 'alpha-10',
                radius: 'sm',
                padding: 2,
                children: [
                  {
                    type: 'Icon',
                    name: 'check-circle',
                    size: 'lg',
                  },
                ],
              },
              {
                type: 'Col',
                gap: 0,
                children: [
                  {
                    type: 'Title',
                    value: 'Tool Result',
                    size: 'sm',
                  },
                  {
                    type: 'Caption',
                    value: toolName,
                    color: 'secondary',
                  },
                ],
              },
            ],
          },
          {
            type: 'Divider',
            flush: true,
          },
          {
            type: 'Text',
            value: outputText,
            wrap: true,
          },
        ],
      };

      const toolResultItem = {
        type: 'widget' as const,
        id: store.generateItemId('tool_result'),
        thread_id: threadId,
        created_at: Math.floor(Date.now() / 1000),
        content: {},
        widget: toolResultWidget,
      };

      // Save the tool result widget to conversation history
      // Don't save tool result widgets to database - they are ephemeral
      console.log('[streamAgentResponse] Emitting tool result widget:', toolResultItem.id);

      // Emit the tool result widget
      yield {
        type: 'thread.item.added',
        item: toolResultItem,
      } as ThreadItemAddedEvent;

      continue;
    }

    // Handle completed tool calls → save as custom_tool_call to conversation history
    if (event.type === 'run_item_stream_event' && eventName === 'tool_called') {
      const item = (event as any).item;
      const tool = item?.rawItem;
      const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
      const toolName = tool?.name || 'tool';
      const argumentsText = tool?.arguments || '';

      console.log('[streamAgentResponse] Tool call completed:', toolName, 'with args:', argumentsText);

      // Save the tool call as a custom_tool_call item to conversation history
      const toolCallItem = {
        type: 'client_tool_call' as const,
        id: store.generateItemId('tool_call'),
        thread_id: threadId,
        created_at: Math.floor(Date.now() / 1000),
        name: toolName,
        call_id: toolCallId,
        arguments: argumentsText,
        output: '',
        status: 'completed',
        content: {},
      };

      await store.saveThreadItem(threadId, toolCallItem);
      console.log('[streamAgentResponse] Saved tool call to conversation history:', toolCallItem.id);
      continue;
    }

    // Handle handoff call items (agent transfers) → display as widget without approval
    if (event.type === 'run_item_stream_event' && (event as any).item?.type === 'handoff_call_item') {
      const item = (event as any).item;
      const handoff = item?.rawItem;
      const handoffCallId = handoff?.callId || handoff?.call_id || handoff?.id || 'unknown';
      const handoffName = handoff?.name || 'handoff';
      const argumentsText = handoff?.arguments || '';

      // Check if we've already processed this handoff to avoid duplicates
      // Use a combination of handoff name and thread ID for more robust deduplication
      const handoffKey = `handoff_${handoffName}_${threadId}`;
      if (processedHandoffs.has(handoffKey)) {
        console.log('[streamAgentResponse] Handoff already processed, skipping:', handoffKey);
        continue;
      }
      processedHandoffs.add(handoffKey);

      console.log('[streamAgentResponse] Handoff call detected:', handoffName, 'with args:', argumentsText);

      // Create a handoff widget using ChatKit widget format (no approval needed)
      const handoffWidget = {
        type: 'Card',
        size: 'sm',
        children: [
          {
            type: 'Row',
            align: 'center',
            gap: 3,
            children: [
              {
                type: 'Box',
                background: 'alpha-10',
                radius: 'sm',
                padding: 2,
                children: [
                  {
                    type: 'Icon',
                    name: 'arrow-right-circle',
                    size: 'lg',
                  },
                ],
              },
              {
                type: 'Col',
                gap: 0,
                children: [
                  {
                    type: 'Title',
                    value: 'Agent Transfer',
                    size: 'sm',
                  },
                  {
                    type: 'Caption',
                    value: `Transferring to ${handoffName}`,
                    color: 'secondary',
                  },
                ],
              },
            ],
          },
        ],
      };

      const handoffItem = {
        type: 'widget' as const,
        id: store.generateItemId('handoff'),
        thread_id: threadId,
        created_at: Math.floor(Date.now() / 1000),
        content: {},
        widget: handoffWidget,
      };

      // Save the handoff tool call to conversation history
      const handoffToolCallItem = {
        type: 'assistant_message' as const,
        id: store.generateItemId('assistant_message'),
        thread_id: threadId,
        created_at: Math.floor(Date.now() / 1000),
        content: [],
        tool_calls: [
          {
            id: handoffCallId,
            type: 'function' as const,
            function: {
              name: handoffName,
              arguments: argumentsText,
            },
          },
        ],
      };

      await store.saveThreadItem(threadId, handoffToolCallItem);
      console.log('[streamAgentResponse] Saved handoff tool call to conversation history:', handoffToolCallItem.id);

      // Don't save handoff widgets to database - they are ephemeral
      console.log('[streamAgentResponse] Emitting handoff widget:', handoffItem.id);

      // Emit the handoff widget
      yield {
        type: 'thread.item.added',
        item: handoffItem,
      } as ThreadItemAddedEvent;

      continue;
    }

    // Handle handoff output items (agent transfer results) → display as widget
    if (event.type === 'run_item_stream_event' && (event as any).item?.type === 'handoff_output_item') {
      const item = (event as any).item;
      const handoff = item?.rawItem;
      const handoffCallId = handoff?.callId || handoff?.call_id || handoff?.id || 'unknown';
      const output = handoff?.output || '';

      // Check if we've already processed this handoff output to avoid duplicates
      // Use a combination of handoff name and thread ID for more robust deduplication
      const handoffOutputKey = `handoff_output_${threadId}`;
      if (processedHandoffs.has(handoffOutputKey)) {
        console.log('[streamAgentResponse] Handoff output already processed, skipping:', handoffOutputKey);
        continue;
      }
      processedHandoffs.add(handoffOutputKey);

      console.log('[streamAgentResponse] Handoff output detected:', output);

      // Create a handoff result widget using ChatKit widget format
      // Handle case where output might be an object with .text property
      let handoffOutputText = 'Transfer completed successfully.';
      if (output) {
        if (typeof output === 'string') {
          handoffOutputText = output;
        } else if (output.text) {
          handoffOutputText = String(output.text);
        } else {
          handoffOutputText = JSON.stringify(output);
        }
      }
      const handoffResultWidget = {
        type: 'Card',
        size: 'sm',
        children: [
          {
            type: 'Row',
            align: 'center',
            gap: 3,
            children: [
              {
                type: 'Box',
                background: 'alpha-10',
                radius: 'sm',
                padding: 2,
                children: [
                  {
                    type: 'Icon',
                    name: 'check-circle',
                    size: 'lg',
                  },
                ],
              },
              {
                type: 'Col',
                gap: 0,
                children: [
                  {
                    type: 'Title',
                    value: 'Transfer Complete',
                    size: 'sm',
                  },
                  {
                    type: 'Caption',
                    value: 'Successfully transferred to target agent',
                    color: 'secondary',
                  },
                ],
              },
            ],
          },
          {
            type: 'Divider',
            flush: true,
          },
          {
            type: 'Text',
            value: handoffOutputText,
            wrap: true,
          },
        ],
      };

      const handoffResultItem = {
        type: 'widget' as const,
        id: store.generateItemId('handoff_result'),
        thread_id: threadId,
        created_at: Math.floor(Date.now() / 1000),
        content: {},
        widget: handoffResultWidget,
      };

      // Save the handoff result as a tool call output to conversation history
      const handoffResultToolItem = {
        type: 'tool_message' as const,
        id: store.generateItemId('tool_message'),
        thread_id: threadId,
        created_at: Math.floor(Date.now() / 1000),
        content: handoffOutputText,
        tool_call_id: handoffCallId,
      };

      await store.saveThreadItem(threadId, handoffResultToolItem);
      console.log('[streamAgentResponse] Saved handoff result to conversation history:', handoffResultToolItem.id);

      // Don't save handoff result widgets to database - they are ephemeral
      console.log('[streamAgentResponse] Emitting handoff result widget:', handoffResultItem.id);

      // Emit the handoff result widget
      yield {
        type: 'thread.item.added',
        item: handoffResultItem,
      } as ThreadItemAddedEvent;

      continue;
    }

    // Handle tool approval requests → render a widget and pause
    if (eventType === 'run_item_stream_event' && eventName === 'tool_approval_requested') {
      const item = (event as any).item;
      const tool = item?.rawItem;
      const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
      const toolName = tool?.name || 'tool';
      const argumentsText = tool?.arguments || '';

      // Save the run state so we can resume after approval/rejection
      // Get the run state from the result stream (same as OpenAI Agents SDK approach)
      const runState = (result as any).state;
      if (runState) {
        console.log('[streamAgentResponse] Saving run state for approval:', threadId);
        const serializedState = JSON.stringify(runState);
        console.log('[streamAgentResponse] Serialized state length:', serializedState.length);
        await store.saveRunState(threadId, serializedState);
      } else {
        console.warn('[streamAgentResponse] No run state available in result stream');
      }

      // Generate approval item ID first
      const approvalItemId = store.generateItemId('widget');
      
      // Create a proper Card widget with confirm/cancel actions
      const widget = {
        type: 'Card',
        size: 'sm',
        confirm: {
          label: 'Approve',
          action: {
            type: 'approve_tool_call',
            toolCallId: toolCallId,
            item_id: approvalItemId,
            payload: {
              tool_call_id: toolCallId,
            },
          },
        },
        cancel: {
          label: 'Deny',
          action: {
            type: 'reject_tool_call',
            toolCallId: toolCallId,
            item_id: approvalItemId,
            payload: {
              tool_call_id: toolCallId,
            },
          },
        },
        children: [
          {
            type: 'Row',
            align: 'center',
            gap: 3,
            children: [
              {
                type: 'Box',
                background: 'alpha-10',
                radius: 'sm',
                padding: 2,
                children: [
                  {
                    type: 'Icon',
                    name: 'square-code',
                    size: 'lg',
                  },
                ],
              },
              {
                type: 'Col',
                gap: 0,
                children: [
                  {
                    type: 'Title',
                    value: 'Tool approval required',
                    size: 'sm',
                  },
                  {
                    type: 'Caption',
                    value: toolName,
                    color: 'secondary',
                  },
                ],
              },
            ],
          },
          {
            type: 'Divider',
            flush: true,
          },
          {
            type: 'Col',
            gap: 2,
            children: [
              {
                type: 'Caption',
                value: 'Arguments',
                color: 'secondary',
              },
              ...Object.entries(JSON.parse(argumentsText || '{}')).map(([key, value]) => ({
                type: 'Row',
                gap: 2,
                children: [
                  {
                    type: 'Badge',
                    label: key,
                  },
                  {
                    type: 'Text',
                    value: String(value),
                    size: 'sm',
                  },
                ],
              })),
              {
                type: 'Text',
                value: `May send ${toolName} request to external service.`,
                size: 'xs',
                color: 'tertiary',
              },
            ],
          },
        ],
      };

      // Store the toolCallId in the approval store
      markApproved(threadId, toolCallId);
      
    const widgetItem = {
      type: 'widget' as const,
      id: approvalItemId,
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      content: {},  // Widget items have empty content object
      widget: widget,  // Use 'widget' field for the actual widget
    };
      console.log('[ChatKitServer] Emitting widget item:', JSON.stringify(widgetItem, null, 2));
      
      // Don't save widget items to database - they are ephemeral
      
      yield {
        type: 'thread.item.added',
        item: widgetItem,
      } as ThreadItemAddedEvent;

      // Emit thread.item.done for the widget
      yield {
        type: 'thread.item.done',
        item: widgetItem,
      } as ThreadItemDoneEvent;

      // Set thread status to locked - don't emit thread.updated with empty items
      // The widget item was already added, so the thread is already updated

      // Pause further streaming until action arrives
      return;
    }

    // Handle raw model stream events (wrapped events from OpenAI)
    if (eventType === 'raw_model_stream_event') {
      const innerEvent = data?.event || (event as any).data?.event;
      if (innerEvent?.type === 'response.output_text.delta' || innerEvent?.type === 'output_text_delta') {
        const delta = innerEvent.delta;
        console.log('[streamAgentResponse] Processing text delta from raw_model_stream_event:', delta);
        
        if (delta) {
          // First delta: emit thread.item.added
          if (!itemAdded) {
            yield {
              type: 'thread.item.added',
              item: {
                type: 'assistant_message',
                id: itemId,
                thread_id: threadId,
                content: [
                  {
                    annotations: [],
                    text: '',
                    type: 'output_text',
                  },
                ],
                created_at: createdAt,
              },
            } as ThreadItemAddedEvent;
            itemAdded = true;
          }

          // Second: emit content_part.added
          if (!contentPartAdded) {
            yield {
              type: 'thread.item.updated',
              item_id: itemId,
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
            contentPartAdded = true;
          }

          // Emit delta
          fullText += delta;
          yield {
            type: 'thread.item.updated',
            item_id: itemId,
            update: {
              type: 'assistant_message.content_part.text_delta',
              content_index: 0,
              delta: delta,
            },
          };
        }
      }
      continue;
    }

    // Handle model events with response.completed to save response data for trace enrichment
    if (eventType === 'model') {
      const innerEvent = data?.event || (event as any).data?.event;
      if (innerEvent?.type === 'response.completed' && innerEvent?.response) {
        const response = innerEvent.response;
        console.log('[streamAgentResponse] 📊 Saving response data for trace enrichment:', response.id);

        // Use the OpenAI-compatible responses API to store the response
        if (supabaseUrl && userJwt) {
          try {
            const responsesEndpoint = `${supabaseUrl}/functions/v1/openai-polyfill/responses`;
            console.log('[streamAgentResponse] POST to responses API:', responsesEndpoint);

            const saveResponse = await fetch(responsesEndpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${userJwt}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: response.id,
                thread_id: threadId,
                model: response.model,
                instructions: response.instructions,
                usage: response.usage,
                tools: response.tools,
                messages: inputMessages || null, // Input messages passed from the caller
                output: response.output,
                output_type: response.text?.format?.type || 'text',
                metadata: response.metadata || {},
              }),
            });

            if (!saveResponse.ok) {
              const errorText = await saveResponse.text();
              console.error('[streamAgentResponse] Failed to save response:', saveResponse.status, errorText);
            } else {
              console.log('[streamAgentResponse] ✅ Response data saved successfully via API');
            }
          } catch (error) {
            console.error('[streamAgentResponse] ❌ Error calling responses API:', error);
          }
        } else {
          console.warn('[streamAgentResponse] ⚠️ Missing supabaseUrl or userJwt, cannot save response');
        }
      }
    }

    // Handle direct text deltas (if not wrapped)
    if ((eventType === 'output_text_delta' || eventType === 'content.delta') && (data?.delta || event?.delta)) {
      const delta = data?.delta || event?.delta;
      console.log('[streamAgentResponse] Processing text delta (direct):', delta);
      
      // First delta: emit thread.item.added
      if (!itemAdded) {
        yield {
          type: 'thread.item.added',
          item: {
            type: 'assistant_message',
            id: itemId,
            thread_id: threadId,
            content: [
              {
                annotations: [],
                text: '',
                type: 'output_text',
              },
            ],
            created_at: createdAt,
          },
        } as ThreadItemAddedEvent;
        itemAdded = true;
      }

      // Second: emit content_part.added
      if (!contentPartAdded) {
        yield {
          type: 'thread.item.updated',
          item_id: itemId,
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
        contentPartAdded = true;
      }

      // Emit delta
      fullText += delta;
      yield {
        type: 'thread.item.updated',
        item_id: itemId,
        update: {
          type: 'assistant_message.content_part.text_delta',
          content_index: 0,
          delta: delta,
        },
      };
    }
  }

  // Emit content_part.done
  if (contentPartAdded) {
    yield {
      type: 'thread.item.updated',
      item_id: itemId,
      update: {
        type: 'assistant_message.content_part.done',
        content_index: 0,
        content: {
          annotations: [],
          text: fullText,
          type: 'output_text',
        },
      },
    };
  }

  // Send final done event
  const finalItem: AssistantMessageItem = {
    type: 'assistant_message',
    id: itemId,
    thread_id: threadId,
    content: [
      {
        annotations: [],
        text: fullText || '',
        type: 'output_text',
      },
    ],
    created_at: createdAt,
  };

  // Ensure item.added precedes item.done even if there were no deltas
  if (!itemAdded) {
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
  if (fullText) {
    console.log('[streamAgentResponse] Saving assistant message to database:', itemId);
    await store.saveThreadItem(threadId, finalItem);
  }
}
