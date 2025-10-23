import { ThreadsStore } from '../../../stores/threads_store.ts';
import type {
  ThreadStreamEvent,
  ThreadItemAddedEvent,
  ThreadItemDoneEvent,
} from '../../../types/chatkit.ts';
import { ItemFactory } from '../factories/item_factory.ts';
import { WidgetFactory } from '../factories/widget_factory.ts';
import { ToolCallOutputHandler } from '../handlers/tool_call_output_handler.ts';
import { ToolCalledHandler } from '../handlers/tool_called_handler.ts';
import { HandoffCallHandler } from '../handlers/handoff_call_handler.ts';
import { HandoffOutputHandler } from '../handlers/handoff_output_handler.ts';
import { ToolApprovalHandler } from '../handlers/tool_approval_handler.ts';
import { ModelStreamHandler } from '../handlers/model_stream_handler.ts';

// Simplified helper to stream agent response to ChatKit events
export async function* streamAgentResponse(
  result: AsyncIterable<any>,
  threadId: string,
  store: ThreadsStore
): AsyncIterable<ThreadStreamEvent> {
  const itemFactory = new ItemFactory(store);

  // Initialize event handlers
  const processedHandoffs = new Set<string>();
  const toolCallOutputHandler = new ToolCallOutputHandler(store, itemFactory);
  const toolCalledHandler = new ToolCalledHandler(store, itemFactory);
  const handoffCallHandler = new HandoffCallHandler(store, itemFactory, processedHandoffs);
  const handoffOutputHandler = new HandoffOutputHandler(store, itemFactory, processedHandoffs);
  const toolApprovalHandler = new ToolApprovalHandler(store, itemFactory);
  const modelStreamHandler = new ModelStreamHandler(itemFactory);

  // Streaming state
  const streamState = {
    itemAdded: false,
    contentPartAdded: false,
    itemId: store.generateItemId(),
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
      const item = (event as any).item;
      const tool = item?.rawItem;
      const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
      const toolName = tool?.name || 'tool';
      const argumentsText = tool?.arguments || '';

      // Save the run state so we can resume after approval/rejection
      const runState = (result as any).state;
      if (runState) {
        const serializedState = JSON.stringify(runState);
        await store.saveRunState(threadId, serializedState);
      }

      // Generate approval item ID first
      const approvalItemId = store.generateItemId();

      // Create approval widget
      const widget = WidgetFactory.createToolApprovalWidget(
        toolName,
        argumentsText,
        toolCallId,
        approvalItemId
      );

      const widgetItem = itemFactory.createWidgetItem(threadId, 'widget', widget);
      widgetItem.id = approvalItemId;

      yield {
        type: 'thread.item.added',
        item: widgetItem,
      } as ThreadItemAddedEvent;

      yield {
        type: 'thread.item.done',
        item: widgetItem,
      } as ThreadItemDoneEvent;

      // Pause further streaming until action arrives
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
        yield* toolCallOutputHandler.handle(event, threadId);
        continue;
      }

      if (item?.type === 'handoff_call_item') {
        console.log('🤝 Handling handoff_call_item');
        yield* handoffCallHandler.handle(event, threadId);
        continue;
      }

      if (item?.type === 'handoff_output_item') {
        console.log('📤 Handling handoff_output_item');
        yield* handoffOutputHandler.handle(event, threadId);
        continue;
      }

      if (eventName === 'tool_called') {
        console.log('🔧 Handling tool_called event');
        await toolCalledHandler.handle(event, threadId);
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
    } as ThreadItemAddedEvent;
  }

  console.log('✅ Emitting thread.item.done');
  yield {
    type: 'thread.item.done',
    item: finalItem,
  } as ThreadItemDoneEvent;

  // Save the final message to the database
  if (streamState.fullText) {
    console.log('💾 Saving final message to database');
    await store.saveThreadItem(threadId, finalItem);
  } else {
    console.log('⚠️ No text content to save');
  }
}
