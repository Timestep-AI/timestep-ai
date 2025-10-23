# Agent-ChatKit Migration Plan

## Overview

This document outlines the complete migration plan for refactoring the Agent-Chat edge function from its current complex architecture to a clean, maintainable structure that follows the execution flow from top to bottom.

## Current State Analysis

### Current Architecture Issues
- **ChatKitService**: 260+ lines with mixed responsibilities
- **7 Event Handlers**: Complex routing logic scattered across multiple files
- **Tight Coupling**: Services directly manage handlers and processors
- **Complex State Management**: Streaming state tracked across multiple components
- **Hard to Test**: Tightly coupled components difficult to unit test

### Current File Structure
```
supabase/functions/agent-chat/
├── apis/
│   ├── agent_api.ts
│   └── chatkit_api.ts
├── services/
│   ├── agent_service.ts
│   ├── chatkit_service.ts          # TO BE REMOVED
│   └── mcp_server_service.ts       # KEEP
├── stores/
│   ├── agent_store.ts              # KEEP
│   ├── mcp_server_store.ts         # KEEP
│   └── threads_store.ts            # TO BE REFACTORED
├── utils/
│   ├── chatkit/
│   │   ├── handlers/               # TO BE REMOVED
│   │   │   ├── tool_called_handler.ts
│   │   │   ├── tool_call_output_handler.ts
│   │   │   ├── tool_approval_handler.ts
│   │   │   ├── handoff_call_handler.ts
│   │   │   ├── handoff_output_handler.ts
│   │   │   └── model_stream_handler.ts
│   │   ├── processors/             # TO BE REMOVED
│   │   │   ├── message_processor.ts
│   │   │   └── stream_processor.ts
│   │   ├── factories/              # TO BE REMOVED
│   │   │   ├── item_factory.ts
│   │   │   └── widget_factory.ts
│   │   └── streaming/
│   │       └── agent_response_streamer.ts  # TO BE REFACTORED
│   ├── multi_provider.ts           # KEEP
│   ├── ollama_model_provider.ts    # KEEP
│   ├── ollama_model.ts             # KEEP
│   ├── openai_client.ts            # KEEP
│   └── runner_factory.ts           # KEEP
└── types/
    └── chatkit.ts                  # TO BE REFACTORED
```

## Target Architecture

### New File Structure
```
supabase/functions/agent-chat/
├── apis/
│   ├── agent_api.ts             # 1a. Agent API endpoints
│   └── chatkit_api.ts           # 1b. ChatKit API endpoints
├── core/
│   ├── agent_orchestrator.ts    # 2. Main entry point
│   ├── agent_runner.ts          # 3. Runs agents
│   ├── event_pipeline.ts        # 4. Processes events
│   └── event_router.ts          # 5. Routes events
├── processors/
│   ├── base_event_processor.ts  # 6a. Interface definition
│   ├── completion_processor.ts  # 6b. Completion
│   ├── handoff_call_processor.ts # 6c. Handoff calls
│   ├── handoff_output_processor.ts # 6d. Handoff results
│   ├── text_stream_processor.ts # 6e. Text processing
│   ├── tool_approval_processor.ts # 6f. Tool approvals
│   ├── tool_call_processor.ts   # 6g. Tool calls
│   └── tool_output_processor.ts # 6h. Tool results
├── services/
│   ├── agent_service.ts         # 7a. Creates and manages agents
│   ├── mcp_server_service.ts    # 7b. MCP servers (KEEP)
│   └── thread_service.ts        # 7c. Manages threads
├── stores/                      # 8. Data access
│   ├── agent_store.ts           # 8a. Agent data (KEEP)
│   ├── mcp_server_store.ts      # 8b. MCP server data (KEEP)
│   ├── message_store.ts         # 8c. Message data
│   ├── thread_store.ts          # 8d. Thread data
│   └── vector_store.ts          # 8e. Vector data
├── utils/                       # 9. Utilities (KEEP)
│   ├── multi_provider.ts
│   ├── ollama_model_provider.ts
│   ├── ollama_model.ts
│   ├── openai_client.ts
│   ├── runner_factory.ts
│   └── factory.ts               # 9a. Consolidated factories
└── types/
    └── index.ts                 # 10. All type definitions
```

## Migration Phases

### Phase 1: Create New Structure (No Breaking Changes)

#### 1.1 Create New Directories
```bash
mkdir -p supabase/functions/agent-chat/{core,processors,stores,types}
```

#### 1.2 Create Consolidated Type Definitions
```typescript
// types/index.ts
// Event Types
export interface AgentEvent {
  type: string;
  name?: string;
  data?: any;
  item?: any;
  state?: any;
}

export interface ChatKitEvent {
  type: string;
  [key: string]: any;
}

export interface ThreadStreamEvent extends ChatKitEvent {
  type: 'thread.created' | 'thread.updated' | 'thread.item.added' | 'thread.item.done' | 'thread.item.updated';
}

// Processor Interface
export interface EventProcessor {
  readonly name: string;
  canProcess(event: AgentEvent, state: StreamingState): boolean;
  process(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent>;
}

// Streaming State
export interface StreamingState {
  threadId: string;
  itemId: string;
  createdAt: number;
  fullText: string;
  itemAdded: boolean;
  contentPartAdded: boolean;
  paused: boolean;
}

// Base Store Configuration
export interface StoreConfig {
  supabaseUrl: string;
  userJwt: string;
  userId: string;
}

// Base Processor Dependencies
export interface ProcessorDependencies {
  factory: Factory;
  messageStore: MessageStore;
  threadStore: ThreadStore;
}
```

#### 1.3 Create Base Processor Interface
```typescript
// processors/base_event_processor.ts
import { EventProcessor } from '../types/index.ts';

// Re-export the interface for convenience
export { EventProcessor };

// Base abstract class with common functionality
export abstract class BaseEventProcessor implements EventProcessor {
  abstract readonly name: string;
  
  constructor(protected deps: ProcessorDependencies) {}
  
  abstract canProcess(event: AgentEvent, state: StreamingState): boolean;
  abstract process(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent>;
  
  protected generateId(prefix: string = 'item'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  protected async saveMessage(threadId: string, message: any): Promise<void> {
    await this.deps.messageStore.add(threadId, message);
  }
}
```

### Phase 2: Extract Core Components

#### 2.1 Create Agent Orchestrator
```typescript
// core/agent_orchestrator.ts
import { AgentService } from '../services/agent_service.ts';
import { ThreadService } from '../services/thread_service.ts';
import { EventPipeline } from './event_pipeline.ts';
import { AgentRunner } from './agent_runner.ts';

export class AgentOrchestrator {
  constructor(
    private agentsService: AgentsService,
    private threadsService: ThreadsService,
    private eventPipeline: EventPipeline,
    private agentRunner: AgentRunner
  ) {}

  async processRequest(request: ChatKitRequest): Promise<{ streaming: boolean; result: any }> {
    // Move logic from current ChatKitService.processRequest()
    if (isStreamingReq(request)) {
      return {
        streaming: true,
        result: this.eventPipeline.encodeStream(this.processStreamingRequest(request))
      };
    } else {
      return { 
        streaming: false, 
        result: await this.processNonStreamingRequest(request) 
      };
    }
  }

  private async *processStreamingRequest(request: ChatKitRequest): AsyncIterable<ThreadStreamEvent> {
    // Move logic from current ChatKitService.processStreamingRequest()
  }

  private async processNonStreamingRequest(request: ChatKitRequest): Promise<object> {
    // Move logic from current ChatKitService.processNonStreamingRequest()
  }
}
```

#### 2.2 Create Agent Runner
```typescript
// core/agent_runner.ts
import { EventPipeline } from './event_pipeline.ts';
import { RunnerFactory } from '../utils/runner_factory.ts';

export class AgentRunner {
  constructor(
    private eventPipeline: EventPipeline
  ) {}

  async *run(agent: Agent, input: any, context: any): AsyncIterable<ChatKitEvent> {
    // Move logic from current ChatKitService.respond()
    const runner = await RunnerFactory.createRunner({
      threadId: context.threadId,
      userId: context.userId,
      workflowName: `Agent workflow (${Date.now()})`
    });

    const result = await runner.run(agent, input, {
      context: { threadId: context.threadId, userId: context.userId },
      stream: true
    });

    yield* this.eventPipeline.process(result);
  }
}
```

#### 2.3 Create Event Pipeline
```typescript
// core/event_pipeline.ts
import { EventRouter } from './event_router.ts';
import { StreamingStateManager } from './streaming_state_manager.ts';

export class EventPipeline {
  constructor(
    private eventRouter: EventRouter,
    private stateManager: StreamingStateManager
  ) {}

  async *process(agentEvents: AsyncIterable<AgentEvent>): AsyncIterable<ChatKitEvent> {
    // Move logic from current streamAgentResponse()
    const state = this.stateManager.createState();
    
    for await (const agentEvent of agentEvents) {
      yield* this.eventRouter.route(agentEvent, state);
    }
    
    yield* this.stateManager.finalizeState(state);
  }

  async *encodeStream(events: AsyncIterable<ThreadStreamEvent>): AsyncIterable<Uint8Array> {
    // Move logic from current StreamProcessor.encodeStream()
  }
}
```

#### 2.4 Create Event Router
```typescript
// core/event_router.ts
import { EventProcessor } from '../processors/base_event_processor.ts';

export class EventRouter {
  constructor(
    private processors: Map<string, EventProcessor[]>
  ) {}

  async *route(agentEvent: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    // Move logic from current event routing in streamAgentResponse()
    const eventType = this.extractEventType(agentEvent);
    const handlers = this.processors.get(eventType) || [];
    
    for (const handler of handlers) {
      if (handler.canProcess(agentEvent, state)) {
        yield* handler.process(agentEvent, state);
      }
    }
  }

  private extractEventType(event: AgentEvent): string {
    return event.data?.type || event.type || 'unknown';
  }
}
```

#### 2.5 Create Streaming State Manager
```typescript
// core/streaming_state_manager.ts
import { StreamingState } from '../types/index.ts';

export class StreamingStateManager {
  createState(): StreamingState {
    return {
      threadId: '',
      itemId: this.generateId('item'),
      createdAt: Math.floor(Date.now() / 1000),
      fullText: '',
      itemAdded: false,
      contentPartAdded: false,
      paused: false
    };
  }

  async *finalizeState(state: StreamingState): AsyncIterable<ChatKitEvent> {
    // Handle any final cleanup or completion events
    if (state.paused) {
      // Handle paused state if needed
    }
  }

  private generateId(prefix: string = 'item'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Phase 3: Extract Processors

#### 3.1 Create Text Stream Processor
```typescript
// processors/text_stream_processor.ts
import { BaseEventProcessor } from './base_event_processor.ts';
import { AgentEvent, StreamingState, ChatKitEvent } from '../types/index.ts';

export class TextStreamProcessor extends BaseEventProcessor {
  readonly name = 'text_stream';

  canProcess(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'raw_model_stream_event' || 
           event.type === 'output_text_delta';
  }

  async *process(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    const delta = this.extractTextDelta(event);
    if (!delta) return;

    // First delta: create assistant message item
    if (!state.itemAdded) {
      const assistantMessage = this.deps.factory.createAssistantMessageItem(
        state.threadId,
        state.itemId,
        state.createdAt
      );
      
      yield { type: 'thread.item.added', item: assistantMessage };
      state.itemAdded = true;
    }

    // Add content part if not already added
    if (!state.contentPartAdded) {
      yield {
        type: 'thread.item.updated',
        item_id: state.itemId,
        update: {
          type: 'assistant_message.content_part.added',
          content_index: 0,
          content: { type: 'output_text', text: '', annotations: [] }
        }
      };
      state.contentPartAdded = true;
    }

    // Emit text delta
    state.fullText += delta;
    yield {
      type: 'thread.item.updated',
      item_id: state.itemId,
      update: {
        type: 'assistant_message.content_part.text_delta',
        content_index: 0,
        delta: delta
      }
    };
  }

  private extractTextDelta(event: AgentEvent): string | null {
    return event.data?.delta || event.data?.event?.delta || event.delta || null;
  }
}
```

#### 3.2 Create Tool Call Processor
```typescript
// processors/tool_call_processor.ts
import { BaseEventProcessor } from './base_event_processor.ts';
import { AgentEvent, StreamingState, ChatKitEvent } from '../types/index.ts';

export class ToolCallProcessor extends BaseEventProcessor {
  readonly name = 'tool_call';

  canProcess(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'run_item_stream_event' && 
           event.name === 'tool_called';
  }

  async *process(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    const tool = event.item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id;
    const toolName = tool?.name;
    const argumentsText = tool?.arguments;

    // Create and save tool call item
    const toolCallItem = this.deps.factory.createToolCallItem(
      state.threadId,
      toolName,
      toolCallId,
      argumentsText
    );
    
    await this.saveMessage(state.threadId, toolCallItem);
    // No immediate ChatKit event needed for tool calls
  }
}
```

#### 3.3 Create Tool Output Processor
```typescript
// processors/tool_output_processor.ts
import { BaseEventProcessor } from './base_event_processor.ts';
import { AgentEvent, StreamingState, ChatKitEvent } from '../types/index.ts';

export class ToolOutputProcessor extends BaseEventProcessor {
  readonly name = 'tool_output';

  canProcess(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'run_item_stream_event' && 
           event.item?.type === 'tool_call_output_item';
  }

  async *process(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    const tool = event.item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id;
    const toolName = tool?.name;
    const output = tool?.output;

    // Save tool call output
    const toolCallOutputItem = this.deps.factory.createToolCallOutputItem(
      state.threadId,
      toolName,
      toolCallId,
      output
    );
    await this.saveMessage(state.threadId, toolCallOutputItem);

    // Create and emit tool result widget
    const toolResultWidget = this.deps.factory.createToolResultWidget(toolName, output);
    const toolResultItem = this.deps.factory.createWidgetItem(
      state.threadId,
      'tool_result',
      toolResultWidget
    );

    yield {
      type: 'thread.item.added',
      item: toolResultItem
    };
  }
}
```

#### 3.4 Create Tool Approval Processor
```typescript
// processors/tool_approval_processor.ts
import { BaseEventProcessor } from './base_event_processor.ts';
import { AgentEvent, StreamingState, ChatKitEvent } from '../types/index.ts';

export class ToolApprovalProcessor extends BaseEventProcessor {
  readonly name = 'tool_approval';

  canProcess(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'run_item_stream_event' && 
           event.name === 'tool_approval_requested';
  }

  async *process(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    const tool = event.item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id;
    const toolName = tool?.name;
    const argumentsText = tool?.arguments;

    // Save run state for resumption after approval
    if (event.state) {
      await this.deps.threadStore.saveRunState(state.threadId, JSON.stringify(event.state));
    }

    // Create approval widget
    const approvalItemId = this.generateId();
    const widget = this.deps.factory.createToolApprovalWidget(
      toolName,
      argumentsText,
      toolCallId,
      approvalItemId
    );

    const widgetItem = this.deps.factory.createWidgetItem(
      state.threadId,
      'widget',
      widget
    );
    widgetItem.id = approvalItemId;

    // Emit approval widget
    yield {
      type: 'thread.item.added',
      item: widgetItem
    };

    yield {
      type: 'thread.item.done',
      item: widgetItem
    };

    // Pause streaming until approval action
    state.paused = true;
  }
}
```

#### 3.5 Create Handoff Processors
```typescript
// processors/handoff_call_processor.ts
import { BaseEventProcessor } from './base_event_processor.ts';
import { AgentEvent, StreamingState, ChatKitEvent } from '../types/index.ts';

export class HandoffCallProcessor extends BaseEventProcessor {
  readonly name = 'handoff_call';

  canProcess(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'run_item_stream_event' && 
           event.item?.type === 'handoff_call_item';
  }

  async *process(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    const handoff = event.item?.rawItem;
    const handoffCallId = handoff?.callId || handoff?.call_id || handoff?.id;
    const handoffName = handoff?.name;
    const argumentsText = handoff?.arguments;

    // Create handoff tool call item
    const handoffToolCallItem = this.deps.factory.createHandoffToolCallItem(
      state.threadId,
      handoffName,
      handoffCallId,
      argumentsText
    );
    await this.saveMessage(state.threadId, handoffToolCallItem);

    // Create handoff widget
    const handoffWidget = this.deps.factory.createHandoffWidget(handoffName);
    const handoffItem = this.deps.factory.createWidgetItem(
      state.threadId,
      'handoff',
      handoffWidget
    );

    yield {
      type: 'thread.item.added',
      item: handoffItem
    };
  }
}

// processors/handoff_output_processor.ts
import { BaseEventProcessor } from './base_event_processor.ts';
import { AgentEvent, StreamingState, ChatKitEvent } from '../types/index.ts';

export class HandoffOutputProcessor extends BaseEventProcessor {
  readonly name = 'handoff_output';

  canProcess(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'run_item_stream_event' && 
           event.item?.type === 'handoff_output_item';
  }

  async *process(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    const handoff = event.item?.rawItem;
    const handoffCallId = handoff?.callId || handoff?.call_id || handoff?.id;
    const output = handoff?.output;

    // Create handoff result item
    const handoffResultItem = this.deps.factory.createHandoffResultToolItem(
      state.threadId,
      handoffCallId,
      output
    );
    await this.saveMessage(state.threadId, handoffResultItem);

    // Create handoff result widget
    const handoffResultWidget = this.deps.factory.createHandoffResultWidget(output);
    const handoffResultItem = this.deps.factory.createWidgetItem(
      state.threadId,
      'handoff_result',
      handoffResultWidget
    );

    yield {
      type: 'thread.item.added',
      item: handoffResultItem
    };
  }
}
```

#### 3.6 Create Completion Processor
```typescript
// processors/completion_processor.ts
import { BaseEventProcessor } from './base_event_processor.ts';
import { AgentEvent, StreamingState, ChatKitEvent } from '../types/index.ts';

export class CompletionProcessor extends BaseEventProcessor {
  readonly name = 'completion';

  canProcess(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'stream_complete' || 
           event.type === 'run_complete';
  }

  async *process(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    if (state.fullText) {
      const finalItem = {
        type: 'assistant_message',
        id: state.itemId,
        thread_id: state.threadId,
        content: [
          {
            annotations: [],
            text: state.fullText,
            type: 'output_text'
          }
        ],
        created_at: state.createdAt
      };

      // Ensure item.added precedes item.done
      if (!state.itemAdded) {
        yield {
          type: 'thread.item.added',
          item: finalItem
        };
      }

      yield {
        type: 'thread.item.done',
        item: finalItem
      };

      // Save final message
      await this.saveMessage(state.threadId, finalItem);
    }
  }
}
```

### Phase 4: Extract Services

#### 4.1 Create Thread Service
```typescript
// services/thread_service.ts
import { ThreadStore } from '../stores/thread_store.ts';
import { MessageStore } from '../stores/message_store.ts';
import { VectorStore } from '../stores/vector_store.ts';

export class ThreadService {
  constructor(
    private threadStore: ThreadStore,
    private messageStore: MessageStore,
    private vectorStore: VectorStore
  ) {}

  async createThread(): Promise<Thread> {
    // Move logic from current ThreadsStore.createThread()
    const thread: Thread = {
      id: this.generateThreadId(),
      created_at: Math.floor(Date.now() / 1000),
      status: { type: 'active' },
      metadata: {},
      items: { data: [], has_more: false, after: null }
    };
    
    await this.threadStore.create(thread);
    return thread;
  }

  async getThread(id: string): Promise<Thread> {
    // Move logic from current ThreadsStore.loadThread()
    return await this.threadStore.getById(id);
  }

  async updateThread(thread: Thread): Promise<void> {
    // Move logic from current ThreadsStore.saveThread()
    await this.threadStore.update(thread);
  }

  async deleteThread(id: string): Promise<void> {
    // Move logic from current ThreadsStore.deleteThread()
    await this.threadStore.delete(id);
  }

  async addMessage(threadId: string, message: Message): Promise<void> {
    // Move logic from current ThreadsStore.addThreadItem()
    await this.messageStore.add(threadId, message);
  }

  async getMessages(threadId: string): Promise<Message[]> {
    // Move logic from current ThreadsStore.loadThreadItems()
    return await this.messageStore.getByThread(threadId);
  }

  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Phase 5: Extract Stores

#### 5.1 Create Base Store Class
```typescript
// stores/base_store.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { StoreConfig } from '../types/index.ts';

export abstract class BaseStore {
  protected supabase: ReturnType<typeof createClient>;

  constructor(protected config: StoreConfig) {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    this.supabase = createClient(config.supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${config.userJwt}`
        }
      }
    });
  }
}
```

#### 5.2 Create Thread Store
```typescript
// stores/thread_store.ts
import { BaseStore } from './base_store.ts';
import { VectorStore } from './vector_store.ts';
import { StoreConfig } from '../types/index.ts';

export class ThreadStore extends BaseStore {
  constructor(
    config: StoreConfig,
    private vectorStore: VectorStore
  ) {
    super(config);
  }

  async create(thread: Thread): Promise<Thread> {
    // Move logic from current ThreadsStore.saveThread()
    const vectorStoreId = await this.vectorStore.createForThread(thread.id);
    
    const { error } = await this.supabase.from('threads').upsert({
      id: thread.id,
      user_id: this.userId,
      created_at: thread.created_at,
      vector_store_id: vectorStoreId,
      metadata: thread.metadata,
      object: 'thread',
      updated_at: new Date().toISOString()
    });

    if (error) throw error;
    return thread;
  }

  async getById(id: string): Promise<Thread> {
    // Move logic from current ThreadsStore.loadThread()
    const { data, error } = await this.supabase
      .from('threads')
      .select('*')
      .eq('id', id)
      .eq('user_id', this.userId)
      .single();

    if (error || !data) throw new Error(`Thread not found: ${id}`);
    return this.convertToThread(data);
  }

  async update(thread: Thread): Promise<void> {
    // Move logic from current ThreadsStore.saveThread()
    const { error } = await this.supabase
      .from('threads')
      .update({
        metadata: thread.metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', thread.id)
      .eq('user_id', this.userId);

    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    // Move logic from current ThreadsStore.deleteThread()
    const { error: itemsError } = await this.supabase
      .from('thread_messages')
      .delete()
      .eq('thread_id', id)
      .eq('user_id', this.userId);

    if (itemsError) throw itemsError;

    const { error: threadError } = await this.supabase
      .from('threads')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (threadError) throw threadError;
  }

  async saveRunState(threadId: string, state: string): Promise<void> {
    // Move logic from current ThreadsStore.saveRunState()
    const { error } = await this.supabase
      .from('thread_run_states')
      .upsert({
        thread_id: threadId,
        user_id: this.userId,
        state_data: state,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  private convertToThread(data: any): Thread {
    return {
      id: data.id,
      created_at: data.created_at,
      status: { type: 'active' },
      metadata: data.metadata || {},
      items: { data: [], has_more: false, after: null }
    };
  }
}
```

#### 5.3 Create Message Store
```typescript
// stores/message_store.ts
import { BaseStore } from './base_store.ts';
import { VectorStore } from './vector_store.ts';
import { StoreConfig } from '../types/index.ts';

export class MessageStore extends BaseStore {
  constructor(
    config: StoreConfig,
    private vectorStore: VectorStore
  ) {
    super(config);
  }

  async add(threadId: string, message: Message): Promise<void> {
    // Move logic from current ThreadsStore.addThreadItem()
    const threadMessage = this.convertToThreadMessage(message, threadId);
    await this.saveThreadMessage(threadMessage);
  }

  async getByThread(threadId: string): Promise<Message[]> {
    // Move logic from current ThreadsStore.loadThreadItems()
    const { data: messagesData, error } = await this.supabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq('user_id', this.userId)
      .order('message_index', { ascending: true });

    if (error) throw error;

    return (messagesData || []).map((message: any) =>
      this.convertFromThreadMessage(message, threadId)
    );
  }

  private async saveThreadMessage(message: any): Promise<void> {
    // Move logic from current ThreadsStore.saveThreadMessage()
    // Check if message already exists
    const { data: existingMessage } = await this.supabase
      .from('thread_messages')
      .select('id')
      .eq('id', message.id)
      .eq('thread_id', message.thread_id)
      .eq('user_id', this.userId)
      .maybeSingle();

    if (existingMessage) return;

    // Get thread's vector store ID
    const { data: thread } = await this.supabase
      .from('threads')
      .select('vector_store_id')
      .eq('id', message.thread_id)
      .eq('user_id', this.userId)
      .single();

    if (!thread?.vector_store_id) {
      throw new Error(`Thread ${message.thread_id} does not have a vector store`);
    }

    // Store message as file in vector store
    if (message.content) {
      await this.vectorStore.addMessage(thread.vector_store_id, message);
    }

    // Insert message with atomic index calculation
    const { data: nextIndex, error: indexError } = await this.supabase.rpc(
      'get_next_message_index',
      { p_thread_id: message.thread_id }
    );

    if (indexError || nextIndex === null) {
      throw new Error(`Failed to get next message index: ${indexError?.message}`);
    }

    const { error } = await this.supabase
      .from('thread_messages')
      .insert({
        id: message.id,
        thread_id: message.thread_id,
        user_id: this.userId,
        message_index: nextIndex,
        role: message.role,
        content: message.content,
        name: message.role === 'tool' ? null : message.name,
        tool_calls: message.role === 'assistant' ? message.toolCalls : null,
        tool_call_id: message.role === 'tool' ? message.toolCallId : null,
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  private convertToThreadMessage(item: any, threadId: string): any {
    // Move logic from current ThreadsStore.convertChatKitToThreadMessage()
    const baseMessage = {
      id: item.id,
      thread_id: threadId,
      user_id: this.userId,
      message_index: 0
    };

    if (item.type === 'user_message') {
      const textContent = item.content
        ?.filter((part: any) => part.type === 'input_text')
        ?.map((part: any) => part.text)
        ?.join(' ') || '';

      return {
        ...baseMessage,
        role: 'user',
        content: textContent,
        name: undefined
      };
    } else if (item.type === 'assistant_message') {
      const textContent = item.content
        ?.filter((part: any) => part.type === 'output_text')
        ?.map((part: any) => part.text)
        ?.join(' ') || '';

      return {
        ...baseMessage,
        role: 'assistant',
        content: textContent,
        name: undefined,
        toolCalls: item.tool_calls || undefined
      };
    } else if (item.type === 'tool_message') {
      return {
        ...baseMessage,
        role: 'tool',
        content: item.content,
        toolCallId: item.tool_call_id
      };
    }

    return {
      ...baseMessage,
      role: 'assistant',
      content: JSON.stringify(item),
      name: undefined
    };
  }

  private convertFromThreadMessage(message: any, threadId: string): any {
    // Move logic from current ThreadsStore.convertThreadMessageToChatKit()
    const createdAt = Math.floor(new Date(message.created_at).getTime() / 1000);

    if (message.role === 'user') {
      let content;
      try {
        content = typeof message.content === 'string' 
          ? JSON.parse(message.content) 
          : message.content;
        if (!Array.isArray(content)) {
          content = [{ type: 'input_text', text: String(message.content || '') }];
        }
      } catch (e) {
        content = [{ type: 'input_text', text: String(message.content || '') }];
      }

      return {
        type: 'user_message',
        id: message.id,
        thread_id: threadId,
        content: content,
        created_at: createdAt,
        attachments: []
      };
    } else if (message.role === 'assistant') {
      let content;
      try {
        content = typeof message.content === 'string' 
          ? JSON.parse(message.content) 
          : message.content;
        if (!Array.isArray(content)) {
          content = [{ type: 'output_text', text: String(message.content || ''), annotations: [] }];
        }
      } catch (e) {
        content = [{ type: 'output_text', text: String(message.content || ''), annotations: [] }];
      }

      return {
        type: 'assistant_message',
        id: message.id,
        thread_id: threadId,
        content: content,
        created_at: createdAt
      };
    } else if (message.role === 'tool') {
      return {
        type: 'tool_message',
        id: message.id,
        thread_id: threadId,
        content: message.content,
        created_at: createdAt,
        tool_call_id: message.tool_call_id,
        arguments: '',
        output: message.content?.text || '',
        status: 'completed'
      };
    }

    return {
      type: 'assistant_message',
      id: message.id,
      thread_id: threadId,
      content: [{ type: 'output_text', text: JSON.stringify(message), annotations: [] }],
      created_at: createdAt
    };
  }
}
```

#### 5.4 Create Vector Store
```typescript
// stores/vector_store.ts
import { createOpenAIClient } from '../utils/openai_client.ts';
import { StoreConfig } from '../types/index.ts';

export class VectorStore {
  private openai: ReturnType<typeof createOpenAIClient>;

  constructor(
    private config: StoreConfig
  ) {
    this.openai = createOpenAIClient(config.supabaseUrl, config.userJwt);
  }

  async createForThread(threadId: string): Promise<string> {
    // Move logic from current ThreadsStore vector store creation
    const vectorStore = await this.openai.vectorStores.create({
      name: `Thread ${threadId}`,
      metadata: {
        thread_id: threadId
      }
    });

    return vectorStore.id;
  }

  async addMessage(vectorStoreId: string, message: any): Promise<void> {
    // Move logic from current ThreadsStore message storage
    const messageJson = JSON.stringify({
      id: message.id,
      thread_id: message.thread_id,
      role: message.role,
      content: message.content,
      ...(message.name ? { name: message.name } : {}),
      ...(message.toolCalls ? { tool_calls: message.toolCalls } : {}),
      ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {})
    });

    const blob = new Blob([messageJson], { type: 'application/jsonl' });
    const file = new File([blob], `message_${message.id}.jsonl`, {
      type: 'application/jsonl'
    });

    const uploadedFile = await this.openai.files.create({
      file: file,
      purpose: 'assistants'
    });

    await this.openai.vectorStores.files.create(vectorStoreId, {
      file_id: uploadedFile.id
    });
  }

  async search(vectorStoreId: string, query: string, options: any): Promise<any[]> {
    // Move logic from current ThreadsStore.getConversationContext()
    const searchResponse = await fetch(
      `${this.supabaseUrl}/functions/v1/openai-polyfill/vector_stores/${vectorStoreId}/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.userJwt}`
        },
        body: JSON.stringify({
          query: query,
          max_num_results: options.similarCount || 5,
          ranking_options: {
            score_threshold: options.scoreThreshold || 0.7
          }
        })
      }
    );

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Vector store search failed: ${error}`);
    }

    return await searchResponse.json();
  }
}
```

### Phase 6: Create Consolidated Factory

#### 6.1 Create Unified Factory
```typescript
// utils/factory.ts
export class Factory {
  generateId(prefix: string = 'item'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Item Creation Methods
  createUserMessageItem(input: any, thread: Thread): UserMessageItem {
    let content = Array.isArray(input.content) ? input.content : [input.content];
    if (!content || content.length === 0 || !content[0] || typeof content[0].type !== 'string') {
      content = [{ type: 'input_text', text: '' }];
    }

    const userMessage: UserMessageItem = {
      type: 'user_message',
      id: this.generateId('message'),
      content,
      thread_id: thread.id,
      created_at: Math.floor(Date.now() / 1000),
      attachments: input.attachments || []
    };

    if (input.quoted_text) userMessage.quoted_text = input.quoted_text;
    if (input.inference_options && Object.keys(input.inference_options).length > 0) {
      userMessage.inference_options = input.inference_options;
    }

    return userMessage;
  }

  createAssistantMessageItem(threadId: string, itemId: string, createdAt: number): AssistantMessageItem {
    return {
      type: 'assistant_message',
      id: itemId,
      thread_id: threadId,
      content: [{ annotations: [], text: '', type: 'output_text' }],
      created_at: createdAt
    };
  }

  createToolCallItem(threadId: string, toolName: string, toolCallId: string, argumentsText: string): any {
    return {
      type: 'client_tool_call',
      id: this.generateId('tool_call'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      name: toolName,
      call_id: toolCallId,
      arguments: argumentsText,
      output: '',
      status: 'completed',
      content: {}
    };
  }

  createToolCallOutputItem(threadId: string, toolName: string, toolCallId: string, output: any): any {
    return {
      type: 'client_tool_call',
      id: this.generateId('tool_call_output'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      name: toolName,
      call_id: toolCallId,
      arguments: '',
      output: output,
      status: 'completed',
      content: {}
    };
  }

  createHandoffToolCallItem(threadId: string, handoffName: string, handoffCallId: string, argumentsText: string): any {
    return {
      type: 'assistant_message',
      id: this.generateId('assistant_message'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      content: [],
      tool_calls: [{
        id: handoffCallId,
        type: 'function',
        function: { name: handoffName, arguments: argumentsText }
      }]
    };
  }

  createHandoffResultToolItem(threadId: string, handoffCallId: string, output: any): any {
    return {
      type: 'tool_message',
      id: this.generateId('tool_message'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      content: output,
      tool_call_id: handoffCallId
    };
  }

  createWidgetItem(threadId: string, widgetType: string, widget: any): any {
    return {
      type: 'widget',
      id: this.generateId('widget'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      content: {},
      widget: widget
    };
  }

  // Widget Creation Methods
  createToolResultWidget(toolName: string, output: any): any {
    const outputText = this.extractText(output) || 'Tool executed successfully.';
    return this.createCardWidget('Tool Result', toolName, 'check-circle', outputText);
  }

  createToolApprovalWidget(toolName: string, argumentsText: string, toolCallId: string, approvalItemId: string): any {
    const args = JSON.parse(argumentsText || '{}');
    return {
      type: 'Card',
      size: 'sm',
      confirm: {
        label: 'Approve',
        action: { type: 'approve_tool_call', toolCallId, item_id: approvalItemId, payload: { tool_call_id: toolCallId } }
      },
      cancel: {
        label: 'Deny',
        action: { type: 'reject_tool_call', toolCallId, item_id: approvalItemId, payload: { tool_call_id: toolCallId } }
      },
      children: [
        this.createHeaderRow('Tool approval required', toolName, 'square-code'),
        { type: 'Divider', flush: true },
        {
          type: 'Col',
          gap: 2,
          children: [
            { type: 'Caption', value: 'Arguments', color: 'secondary' },
            ...Object.entries(args).map(([key, value]) => ({
              type: 'Row',
              gap: 2,
              children: [
                { type: 'Badge', label: key },
                { type: 'Text', value: String(value), size: 'sm' }
              ]
            })),
            { type: 'Text', value: `May send ${toolName} request to external service.`, size: 'xs', color: 'tertiary' }
          ]
        }
      ]
    };
  }

  createHandoffWidget(handoffName: string): any {
    return this.createCardWidget('Agent Transfer', `Transferring to ${handoffName}`, 'arrow-right-circle');
  }

  createHandoffResultWidget(output: any): any {
    const outputText = this.extractText(output) || 'Transfer completed successfully.';
    return this.createCardWidget('Transfer Complete', 'Successfully transferred to target agent', 'check-circle', outputText);
  }

  // Helper Methods
  private extractText(output: any): string | null {
    if (typeof output === 'string') return output;
    if (output?.text) return String(output.text);
    if (output) return JSON.stringify(output);
    return null;
  }

  private createCardWidget(title: string, subtitle: string, icon: string, content?: string): any {
    const children = [
      this.createHeaderRow(title, subtitle, icon),
      { type: 'Divider', flush: true }
    ];
    
    if (content) {
      children.push({ type: 'Text', value: content, wrap: true });
    }
    
    return { type: 'Card', size: 'sm', children };
  }

  private createHeaderRow(title: string, subtitle: string, icon: string): any {
    return {
      type: 'Row',
      align: 'center',
      gap: 3,
      children: [
        {
          type: 'Box',
          background: 'alpha-10',
          radius: 'sm',
          padding: 2,
          children: [{ type: 'Icon', name: icon, size: 'lg' }]
        },
        {
          type: 'Col',
          gap: 0,
          children: [
            { type: 'Title', value: title, size: 'sm' },
            { type: 'Caption', value: subtitle, color: 'secondary' }
          ]
        }
      ]
    };
  }
}
```

### Phase 7: Update Main Entry Point

#### 7.1 Update Index File
```typescript
// index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { setDefaultOpenAIKey, setDefaultOpenAITracingExporter } from '@openai/agents-openai';
import { handleGetAgentsRequest } from './apis/agent_api.ts';
import { handlePostChatKitRequest, handlePostChatKitUploadRequest } from './apis/chatkit_api.ts';

// Configure OpenAI API key and tracing exporter
const DEFAULT_OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
if (DEFAULT_OPENAI_API_KEY) {
  setDefaultOpenAIKey(DEFAULT_OPENAI_API_KEY);
}

setDefaultOpenAITracingExporter();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');

    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    // Get the session or user object
    const {
      data: { user }
    } = await supabaseClient.auth.getUser();

    // Require authentication (including anonymous users)
    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = user.id;
    const url = new URL(req.url);
    const path = url.pathname;

    // Handle different path patterns (Supabase strips /functions/v1 prefix)
    if (path === '/agent-chat' || path === '/') {
      return new Response(
        JSON.stringify({ message: 'Welcome to the Timestep AI ChatKit Server!' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Agent API endpoints
    if (path === '/agent-chat/agents' && req.method === 'GET') {
      return await handleGetAgentsRequest(userId, req.headers.get('Authorization') ?? '');
    }

    // Agent-specific ChatKit upload endpoints
    if (path.startsWith('/agent-chat/agents/') && path.endsWith('/chatkit/upload')) {
      const pathParts = path.split('/');
      const agentIndex = pathParts.indexOf('agents');
      const agentId = pathParts[agentIndex + 1];

      if (!agentId) {
        return new Response(JSON.stringify({ error: 'Agent ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return await handlePostChatKitUploadRequest(req, userId, agentId, path);
    }

    // Agent-specific ChatKit API endpoints
    if (path.startsWith('/agent-chat/agents/') && path.includes('/chatkit')) {
      const pathParts = path.split('/');
      const agentIndex = pathParts.indexOf('agents');
      const agentId = pathParts[agentIndex + 1];

      if (!agentId) {
        return new Response(JSON.stringify({ error: 'Agent ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return await handlePostChatKitRequest(req, userId, agentId, path);
    }

    return new Response(JSON.stringify({ error: 'Not found', path: path }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

#### 7.2 Update ChatKit API
```typescript
// apis/chatkit_api.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AgentOrchestrator } from '../core/agent_orchestrator.ts';
import { AgentService } from '../services/agent_service.ts';
import { ThreadService } from '../services/thread_service.ts';
import { EventPipeline } from '../core/event_pipeline.ts';
import { EventRouter } from '../core/event_router.ts';
import { AgentRunner } from '../core/agent_runner.ts';
import { StreamingStateManager } from '../core/streaming_state_manager.ts';
import { ThreadStore } from '../stores/thread_store.ts';
import { MessageStore } from '../stores/message_store.ts';
import { VectorStore } from '../stores/vector_store.ts';
import { Factory } from '../utils/factory.ts';
import { TextStreamProcessor } from '../processors/text_stream_processor.ts';
import { ToolCallProcessor } from '../processors/tool_call_processor.ts';
import { ToolOutputProcessor } from '../processors/tool_output_processor.ts';
import { ToolApprovalProcessor } from '../processors/tool_approval_processor.ts';
import { HandoffCallProcessor } from '../processors/handoff_call_processor.ts';
import { HandoffOutputProcessor } from '../processors/handoff_output_processor.ts';
import { CompletionProcessor } from '../processors/completion_processor.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Handle ChatKit API requests
export async function handlePostChatKitRequest(
  req: Request,
  userId: string,
  agentId: string,
  path: string
): Promise<Response> {
  try {
    // Handle main ChatKit API requests
    if (path.endsWith('/chatkit') || path.endsWith('/chatkit/')) {
      if (req.method === 'POST') {
        const body = await req.json();

        // Extract user ID from thread if available
        let currentUserId = userId;
        if (body.params?.thread_id) {
          try {
            const supabaseClient = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_ANON_KEY') ?? ''
            );

            const { data: threadData } = await supabaseClient
              .from('threads')
              .select('user_id')
              .eq('id', body.params.thread_id)
              .single();

            if (threadData?.user_id) {
              currentUserId = threadData.user_id;
            }
          } catch (_e) {
            // Use provided userId if thread lookup fails
          }
        }

        // Create services and stores
        const authHeader = req.headers.get('Authorization') ?? '';
        const userJwt = authHeader.replace('Bearer ', '');

        const vectorStore = new VectorStore(
          { supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '', userJwt, userId: currentUserId }
        );

        const threadStore = new ThreadStore(
          { supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '', userJwt, userId: currentUserId },
          vectorStore
        );

        const messageStore = new MessageStore(
          { supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '', userJwt, userId: currentUserId },
          vectorStore
        );

        const threadService = new ThreadService(threadStore, messageStore, vectorStore);
        const agentService = new AgentService(threadStore, /* mcpServerService */);

        // Create event pipeline and router
        const factory = new Factory();
        const stateManager = new StreamingStateManager();
        
        // Create processors
        const processorDeps = { factory, messageStore, threadStore };
        const processors = new Map([
          ['text_stream', [new TextStreamProcessor(processorDeps)]],
          ['tool_call', [new ToolCallProcessor(processorDeps)]],
          ['tool_output', [new ToolOutputProcessor(processorDeps)]],
          ['tool_approval', [new ToolApprovalProcessor(processorDeps)]],
          ['handoff_call', [new HandoffCallProcessor(processorDeps)]],
          ['handoff_output', [new HandoffOutputProcessor(processorDeps)]],
          ['completion', [new CompletionProcessor(processorDeps)]]
        ]);
        
        const eventRouter = new EventRouter(processors);
        const eventPipeline = new EventPipeline(eventRouter, stateManager);
        const agentRunner = new AgentRunner(eventPipeline);

        // Create orchestrator
        const orchestrator = new AgentOrchestrator(
          agentService,
          threadService,
          eventPipeline,
          agentRunner
        );

        // Process the request
        const result = await orchestrator.processRequest(JSON.stringify(body));

        if (result.streaming) {
          // Return streaming response
          return new Response(result.result as ReadableStream, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive'
            }
          });
        } else {
          // Return non-streaming response
          return new Response(JSON.stringify(result.result), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error handling ChatKit request:', error);
    return new Response(JSON.stringify({ error: 'ChatKit request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle ChatKit upload requests
export function handlePostChatKitUploadRequest(
  _req: Request,
  _userId: string,
  _agentId: string,
  _path: string
): Response {
  try {
    // Handle ChatKit upload
    if (_path.endsWith('/chatkit/upload') && _req.method === 'POST') {
      throw new Error('ChatKit upload not implemented - requires real file storage integration');
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error handling ChatKit upload request:', error);
    return new Response(JSON.stringify({ error: 'ChatKit upload request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
```

### Phase 8: Clean Up (Remove Old Files)

#### 8.1 Remove Old Handlers
```bash
rm -rf supabase/functions/agent-chat/utils/chatkit/handlers/
rm -rf supabase/functions/agent-chat/utils/chatkit/processors/
rm -rf supabase/functions/agent-chat/utils/chatkit/factories/
rm -rf supabase/functions/agent-chat/utils/chatkit/streaming/
```

#### 8.2 Remove Old Services
```bash
rm supabase/functions/agent-chat/services/chatkit_service.ts
```

#### 8.3 Update Imports
Update all import statements to reference the new file locations.

### Phase 9: Testing & Validation

#### 9.1 Unit Tests
- Test each processor individually
- Test service layer integration
- Test store layer operations

#### 9.2 Integration Tests
- Test complete request flow
- Test streaming functionality
- Test error handling

#### 9.3 Performance Tests
- Compare performance with old architecture
- Monitor memory usage
- Test concurrent requests

## DRY Improvements

### Eliminated Redundancies
1. **Consolidated Types**: All types in single `types/index.ts` file instead of scattered across multiple files
2. **Unified Factory**: Combined `ItemFactory` and `WidgetFactory` into single `Factory` class with shared helper methods
3. **Base Store Class**: Common Supabase client setup moved to `BaseStore` abstract class
4. **Base Processor Class**: Common functionality moved to `BaseEventProcessor` abstract class
5. **Shared Dependencies**: `ProcessorDependencies` interface eliminates repetitive constructor parameters
6. **Helper Methods**: Common widget creation logic consolidated into reusable methods
7. **Consistent Naming**: All files use singular naming (`agent_api.ts`, `agent_service.ts`, `agent_store.ts`, `mcp_server_service.ts`, `mcp_server_store.ts`, `thread_service.ts`) for consistency

### Before vs After
- **Before**: 3 separate type files (`events.ts`, `processors.ts`, `streaming.ts`)
- **After**: 1 consolidated type file (`types/index.ts`)

- **Before**: 2 separate factory classes with duplicate helper methods
- **After**: 1 unified factory with shared helper methods

- **Before**: Each store class duplicated Supabase client setup (15+ lines each)
- **After**: Base store class handles common setup (1 line per store)

- **Before**: Each processor class duplicated dependency injection and helper methods
- **After**: Base processor class provides common functionality

- **Before**: Inconsistent naming (`agents_api.ts`, `agents_service.ts`, `agents_store.ts`, `mcp_servers_service.ts`, `mcp_servers_store.ts`, `threads_service.ts`)
- **After**: Consistent singular naming (`agent_api.ts`, `agent_service.ts`, `agent_store.ts`, `mcp_server_service.ts`, `mcp_server_store.ts`, `thread_service.ts`)

## Implementation Checklist

### Required Dependencies
- [ ] All imports updated to use new file structure
- [ ] `StreamingStateManager` class implemented
- [ ] All processor classes extend `BaseEventProcessor`
- [ ] `Factory` class consolidates all factory methods
- [ ] `BaseStore` class provides common Supabase setup
- [ ] All stores extend `BaseStore`
- [ ] Processor dependencies injected via `ProcessorDependencies` interface

### File Creation Order
1. Create `types/index.ts` with all type definitions
2. Create `utils/factory.ts` with consolidated factory methods
3. Create `stores/base_store.ts` and individual store classes
4. Create `processors/base_event_processor.ts` and all processor classes
5. Create `core/` classes (orchestrator, runner, pipeline, router, state manager)
6. Create `services/` classes (agent, thread)
7. Update `apis/` classes to use new architecture
8. Update main `index.ts` entry point

### Testing Requirements
- [ ] Unit tests for each processor
- [ ] Integration tests for complete request flow
- [ ] Performance tests comparing old vs new architecture
- [ ] Error handling tests for all components

## Migration Benefits

1. **Clear Flow**: Files read from top to bottom follow execution path
2. **Single Responsibility**: Each component has one clear purpose
3. **Easy Testing**: Components can be tested in isolation
4. **Better Maintainability**: Clear separation of concerns
5. **Extensible**: Easy to add new event types and processors
6. **Reduced Complexity**: 260+ line service broken into focused components
7. **DRY Compliance**: Eliminated code duplication and consolidated common functionality
8. **Reduced File Count**: Fewer files to maintain and understand

## Rollback Plan

If issues arise during migration:
1. Keep old files until migration is complete
2. Use feature flags to switch between old/new implementations
3. Maintain backward compatibility during transition
4. Have comprehensive test coverage before removing old code

This migration plan provides a smooth transition from the current complex architecture to a clean, maintainable structure that follows the execution flow from top to bottom.