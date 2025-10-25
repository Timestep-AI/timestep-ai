import type { ThreadStreamEvent, ThreadItemAddedEvent } from '../../../types/chatkit.ts';
import { ChatKitItemFactory } from '../factories/chatkit_item_factory.ts';

export class ModelStreamHandler {
  constructor(private itemFactory: ChatKitItemFactory) {}

  async *handleRawModelStream(
    event: any,
    threadId: string,
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
        const assistantMessage = this.itemFactory.createAssistantMessageItem(
          threadId,
          state.itemId,
          state.createdAt
        );
        yield {
          type: 'thread.item.added',
          item: assistantMessage,
        } as ThreadItemAddedEvent;
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

  async *handleDirectTextDelta(
    event: any,
    threadId: string,
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
      const assistantMessage = this.itemFactory.createAssistantMessageItem(
        threadId,
        state.itemId,
        state.createdAt
      );
      yield {
        type: 'thread.item.added',
        item: assistantMessage,
      } as ThreadItemAddedEvent;
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
}
