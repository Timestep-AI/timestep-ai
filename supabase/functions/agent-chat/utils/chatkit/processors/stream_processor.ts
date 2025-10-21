import { ThreadsStore } from '../../../stores/threads_store.ts';
import type { ThreadMetadata, ThreadStreamEvent } from '../../../types/chatkit.ts';

export class StreamProcessor {
  constructor(private store: ThreadsStore) {}

  async *processEvents(
    thread: ThreadMetadata,
    stream: () => AsyncIterable<ThreadStreamEvent>
  ): AsyncIterable<ThreadStreamEvent> {
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      for await (const event of stream()) {
        if (event.type === 'thread.item.done' && event.item.type !== 'widget') {
          await this.store.addThreadItem(thread.id, event.item);
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

  async *encodeStream(events: AsyncIterable<ThreadStreamEvent>): AsyncIterable<Uint8Array> {
    const encoder = new TextEncoder();

    try {
      for await (const event of events) {
        this.validateEvent(event);
        const data = JSON.stringify(event);
        yield encoder.encode(`data: ${data}\n\n`);
      }
    } catch (error) {
      console.error('[StreamProcessor] Error in streaming:', error);
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

  private validateEvent(event: ThreadStreamEvent): void {
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
}
