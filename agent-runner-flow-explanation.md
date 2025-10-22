# AgentRunner → EventPipeline → EventRouter → EventHandlers Flow

## Current vs Proposed Architecture

### Current Flow (Complex)
```
Agent.run() → Stream Events → Manual Event Routing → Individual Handlers → ChatKit Events
```

### Proposed Flow (Simplified)
```
AgentRunner → EventPipeline → EventRouter → EventHandlers → ChatKit Events
```

## Detailed Flow Explanation

### 1. AgentRunner (Entry Point)

The `AgentRunner` is responsible for executing the agent and producing a stream of raw events from the Agents SDK.

```typescript
class AgentRunner {
  constructor(
    private agentFactory: AgentFactory,
    private eventPipeline: EventPipeline
  ) {}

  async *run(agentId: string, input: any, context: any): AsyncIterable<ChatKitEvent> {
    // 1. Create agent instance
    const agent = await this.agentFactory.create(agentId);
    
    // 2. Execute agent with streaming
    const runner = await RunnerFactory.createRunner(context);
    const result = await runner.run(agent, input, { stream: true });
    
    // 3. Process events through pipeline
    yield* this.eventPipeline.process(result);
  }
}
```

**Key Responsibilities:**
- Agent instantiation and configuration
- Runner creation with proper context
- Delegating event processing to EventPipeline
- Error handling and cleanup

### 2. EventPipeline (Processing Coordinator)

The `EventPipeline` is the central coordinator that processes the raw agent events and transforms them into ChatKit events.

```typescript
class EventPipeline {
  constructor(
    private eventRouter: EventRouter,
    private stateManager: StreamingStateManager,
    private threadId: string
  ) {}

  async *process(agentEvents: AsyncIterable<AgentEvent>): AsyncIterable<ChatKitEvent> {
    // Initialize streaming state
    const state = this.stateManager.createState(this.threadId);
    
    try {
      for await (const agentEvent of agentEvents) {
        // Route event to appropriate handlers
        const chatKitEvents = this.eventRouter.route(agentEvent, state);
        
        // Process each ChatKit event
        for await (const chatKitEvent of chatKitEvents) {
          // Update state based on event
          this.stateManager.updateState(state, chatKitEvent);
          
          // Yield the event to the client
          yield chatKitEvent;
        }
      }
    } finally {
      // Cleanup and finalize state
      yield* this.stateManager.finalizeState(state);
    }
  }
}
```

**Key Responsibilities:**
- Coordinating the entire event processing flow
- Managing streaming state across events
- Error handling and recovery
- State cleanup and finalization

### 3. EventRouter (Event Dispatcher)

The `EventRouter` determines which handlers should process each incoming agent event.

```typescript
class EventRouter {
  constructor(
    private handlers: Map<string, EventHandler[]>,
    private fallbackHandler: EventHandler
  ) {}

  async *route(agentEvent: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    // Determine event type and find appropriate handlers
    const eventType = this.extractEventType(agentEvent);
    const handlers = this.handlers.get(eventType) || [this.fallbackHandler];
    
    // Process event through all applicable handlers
    for (const handler of handlers) {
      if (handler.canHandle(agentEvent, state)) {
        yield* handler.handle(agentEvent, state);
      }
    }
  }

  private extractEventType(event: AgentEvent): string {
    // Extract event type from various possible structures
    return event.data?.type || event.type || 'unknown';
  }
}
```

**Key Responsibilities:**
- Event type detection and classification
- Handler selection based on event type
- Ensuring all applicable handlers are called
- Fallback handling for unknown events

### 4. EventHandlers (Specialized Processors)

Each handler is responsible for a specific type of event and converts it to appropriate ChatKit events.

```typescript
interface EventHandler {
  canHandle(event: AgentEvent, state: StreamingState): boolean;
  handle(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent>;
}

class TextStreamHandler implements EventHandler {
  constructor(
    private itemFactory: ItemFactory,
    private stateManager: StreamingStateManager
  ) {}

  canHandle(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'raw_model_stream_event' || 
           event.type === 'output_text_delta';
  }

  async *handle(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    const delta = this.extractTextDelta(event);
    if (!delta) return;

    // First delta: create assistant message item
    if (!state.assistantMessageCreated) {
      const assistantMessage = this.itemFactory.createAssistantMessageItem(
        state.threadId,
        state.itemId,
        state.createdAt
      );
      
      yield {
        type: 'thread.item.added',
        item: assistantMessage
      };
      
      state.assistantMessageCreated = true;
    }

    // Add content part if not already added
    if (!state.contentPartAdded) {
      yield {
        type: 'thread.item.updated',
        item_id: state.itemId,
        update: {
          type: 'assistant_message.content_part.added',
          content_index: 0,
          content: {
            type: 'output_text',
            text: '',
            annotations: []
          }
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
    // Extract text delta from various event formats
    return event.data?.delta || 
           event.data?.event?.delta || 
           event.delta || 
           null;
  }
}

class ToolCallHandler implements EventHandler {
  constructor(
    private itemFactory: ItemFactory,
    private store: ThreadsStore
  ) {}

  canHandle(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'run_item_stream_event' && 
           event.name === 'tool_called';
  }

  async *handle(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    const tool = event.item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id;
    const toolName = tool?.name;
    const argumentsText = tool?.arguments;

    // Create and save tool call item
    const toolCallItem = this.itemFactory.createToolCallItem(
      state.threadId,
      toolName,
      toolCallId,
      argumentsText
    );
    
    await this.store.saveThreadItem(state.threadId, toolCallItem);
    
    // No immediate ChatKit event needed for tool calls
    // The tool result will be handled by ToolCallOutputHandler
  }
}

class ToolApprovalHandler implements EventHandler {
  constructor(
    private itemFactory: ItemFactory,
    private widgetFactory: WidgetFactory,
    private store: ThreadsStore
  ) {}

  canHandle(event: AgentEvent, state: StreamingState): boolean {
    return event.type === 'run_item_stream_event' && 
           event.name === 'tool_approval_requested';
  }

  async *handle(event: AgentEvent, state: StreamingState): AsyncIterable<ChatKitEvent> {
    const tool = event.item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id;
    const toolName = tool?.name;
    const argumentsText = tool?.arguments;

    // Save run state for resumption after approval
    if (event.state) {
      await this.store.saveRunState(state.threadId, JSON.stringify(event.state));
    }

    // Create approval widget
    const approvalItemId = this.itemFactory.generateId();
    const widget = this.widgetFactory.createToolApprovalWidget(
      toolName,
      argumentsText,
      toolCallId,
      approvalItemId
    );

    const widgetItem = this.itemFactory.createWidgetItem(
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

## Complete Flow Example

Here's how a typical conversation would flow through the system:

```typescript
// 1. User sends message
const userMessage = {
  type: 'threads.add_user_message',
  params: { thread_id: 'thread_123', input: { content: 'Hello!' } }
};

// 2. AgentRunner processes the request
const agentRunner = new AgentRunner(agentFactory, eventPipeline);
const chatKitEvents = agentRunner.run('agent_456', userMessage, context);

// 3. EventPipeline coordinates processing
for await (const chatKitEvent of chatKitEvents) {
  // Events flow through:
  // Agent.run() → EventPipeline → EventRouter → EventHandlers → ChatKit Events
  
  console.log('ChatKit Event:', chatKitEvent);
  // Example events:
  // { type: 'thread.item.added', item: { type: 'user_message', ... } }
  // { type: 'thread.item.added', item: { type: 'assistant_message', ... } }
  // { type: 'thread.item.updated', item_id: '...', update: { type: 'assistant_message.content_part.text_delta', delta: 'Hello' } }
  // { type: 'thread.item.updated', item_id: '...', update: { type: 'assistant_message.content_part.text_delta', delta: '!' } }
  // { type: 'thread.item.done', item: { type: 'assistant_message', ... } }
}
```

## Benefits of This Architecture

### 1. **Separation of Concerns**
- **AgentRunner**: Focuses only on agent execution
- **EventPipeline**: Manages overall flow and state
- **EventRouter**: Handles event routing logic
- **EventHandlers**: Process specific event types

### 2. **Extensibility**
```typescript
// Easy to add new handlers
const newHandler = new CustomEventHandler();
eventRouter.registerHandler('custom_event', newHandler);

// Easy to add new event types
eventRouter.registerHandler('new_event_type', [handler1, handler2]);
```

### 3. **Testability**
```typescript
// Each component can be tested in isolation
const mockHandler = new MockEventHandler();
const eventRouter = new EventRouter(new Map([['test_event', [mockHandler]]]));
const result = await eventRouter.route(testEvent, mockState);
```

### 4. **Maintainability**
- Clear data flow
- Single responsibility per component
- Easy to debug and modify
- Reduced coupling between components

### 5. **Performance**
- Parallel processing of events
- Efficient state management
- Reduced memory allocation
- Better error recovery

This architecture transforms the current complex, tightly-coupled system into a clean, modular, and maintainable event processing pipeline.