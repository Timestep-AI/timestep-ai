import type { ThreadStreamEvent, ThreadItemAddedEvent } from '../../../types/chatkit.ts';
import { ItemFactory } from '../factories/item_factory.ts';

export class ModelStreamHandler {
  constructor(private itemFactory: ItemFactory) {}

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
    if (
      innerEvent?.type === 'response.output_text.delta' ||
      innerEvent?.type === 'output_text_delta'
    ) {
      const delta = innerEvent.delta;

      if (delta) {
        // First delta: emit thread.item.added
        if (!state.itemAdded) {
          const assistantMessage = this.itemFactory.createAssistantMessageItem(threadId, state.itemId, state.createdAt);
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
      const assistantMessage = this.itemFactory.createAssistantMessageItem(threadId, state.itemId, state.createdAt);
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
