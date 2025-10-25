import { ThreadMessageStore } from '../../stores/thread_message_store.ts';
import { ThreadRunStateService } from '../thread_run_state_service.ts';
import type {
  ThreadStreamEvent,
  ThreadMessageAddedEvent,
  ThreadMessageDoneEvent,
} from '../../types/chatkit.ts';
import { ChatKitItemFactory } from '../../utils/chatkit/factories/chatkit_item_factory.ts';
import { WidgetFactory } from '../../utils/chatkit/factories/widget_factory.ts';
import { ToolService } from './tool_service.ts';
import { HandoffService } from './handoff_service.ts';
import { ModelStreamHandler } from './model_stream_service.ts';

// Simplified helper to stream agent response to ChatKit events
export async function* streamAgentResponse(
  result: AsyncIterable<any>,
  threadId: string,
  store: ThreadMessageStore,
  runStateService: ThreadRunStateService,
  agent: any,
  context: any
): AsyncIterable<ThreadStreamEvent> {
  const itemFactory = new ChatKitItemFactory(store);

  // Initialize event handlers
  const processedHandoffs = new Set<string>();
  const toolService = new ToolService(store, runStateService, agent, context);
  const handoffService = new HandoffService(store, processedHandoffs);
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
    } as ThreadMessageAddedEvent;
  }

  console.log('✅ Emitting thread.item.done');
  yield {
    type: 'thread.item.done',
    item: finalItem,
  } as ThreadMessageDoneEvent;

  // Save the final message to the database
  if (streamState.fullText) {
    console.log('💾 Saving final message to database');
    await store.saveThreadMessage(threadId, finalItem);
  } else {
    console.log('⚠️ No text content to save');
  }
}
