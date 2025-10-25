import { ThreadStore } from '../stores/thread_store.ts';
import {
  type ThreadMetadata,
  type UserMessageItem,
  type ThreadStreamEvent,
  type UserMessageInput,
} from '../types/chatkit.ts';

import { MessageProcessor } from '../utils/chatkit/processors/message_processor.ts';
import { StreamProcessor } from '../utils/chatkit/processors/stream_processor.ts';
import { ItemFactory } from '../utils/chatkit/factories/item_factory.ts';

/**
 * Handles event processing and message pipeline operations
 * Responsible for building user messages and processing event streams
 */
export class EventPipeline {
  private messageProcessor: MessageProcessor;
  private streamProcessor: StreamProcessor;
  private itemFactory: ItemFactory;

  constructor(private store: ThreadStore) {
    this.itemFactory = new ItemFactory(store);
    this.messageProcessor = new MessageProcessor(store, this.itemFactory);
    this.streamProcessor = new StreamProcessor(store);
  }

  /**
   * Build a user message item from input
   */
  buildUserMessageItem(input: UserMessageInput, thread: ThreadMetadata): UserMessageItem {
    return this.messageProcessor.buildUserMessageItem(input, thread);
  }

  /**
   * Process events through the stream processor
   */
  async *processEvents(
    thread: ThreadMetadata,
    eventGenerator: () => AsyncIterable<ThreadStreamEvent>
  ): AsyncIterable<ThreadStreamEvent> {
    yield* this.streamProcessor.processEvents(thread, eventGenerator);
  }

  /**
   * Encode stream for transmission
   */
  encodeStream(stream: AsyncIterable<ThreadStreamEvent>): AsyncIterable<Uint8Array> {
    return this.streamProcessor.encodeStream(stream);
  }
}
