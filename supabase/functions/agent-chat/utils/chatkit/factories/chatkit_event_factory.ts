import type { ThreadMetadata, ThreadUpdatedEvent, Thread, ThreadCreatedEvent } from '../../../types/chatkit.ts';

/**
 * Creates ChatKit events for frontend streaming.
 * 
 * This factory is responsible for creating all types of ChatKit events that get
 * streamed to the frontend. These are transient notification objects, not persistent data.
 * 
 * ChatKit events include:
 * - Thread lifecycle events (created, updated)
 * - Item lifecycle events (added, done)
 * - Error events
 */
export class ChatKitEventFactory {
  /**
   * Creates a thread created event for frontend streaming.
   * Notifies the frontend that a new thread has been created.
   */
  createThreadCreatedEvent(thread: Thread): ThreadCreatedEvent {
    return {
      type: 'thread.created',
      thread: {
        id: thread.id,
        created_at: thread.created_at,
        status: thread.status,
        metadata: thread.metadata,
        items: { data: [], has_more: false, after: null },
      },
    };
  }

  /**
   * Creates a thread updated event for frontend streaming.
   * Notifies the frontend that a thread has been updated.
   */
  createThreadUpdatedEvent(thread: ThreadMetadata): ThreadUpdatedEvent {
    return {
      type: 'thread.updated',
      thread: {
        id: thread.id,
        created_at:
          typeof thread.created_at === 'number'
            ? thread.created_at
            : Math.floor(new Date(thread.created_at as any).getTime() / 1000),
        status: { type: 'active' },
        metadata: thread.metadata || {},
        items: { data: [], has_more: false, after: null },
      },
    };
  }

  /**
   * Creates a thread item added event for frontend streaming.
   * Notifies the frontend that a new item has been added to a thread.
   */
  createItemAddedEvent(item: any) {
    return {
      type: 'thread.item.added',
      item: { ...item, created_at: Math.floor(Date.now() / 1000) },
    };
  }

  /**
   * Creates a thread item done event for frontend streaming.
   * Notifies the frontend that an item has been completed.
   */
  createItemDoneEvent(item: any) {
    return {
      type: 'thread.item.done',
      item: { ...item, created_at: Math.floor(Date.now() / 1000) },
    };
  }

  /**
   * Creates an error event for frontend streaming.
   * Notifies the frontend of an error that occurred.
   */
  createErrorEvent(code: string, message: string, allowRetry: boolean = true) {
    return {
      type: 'error',
      code,
      message,
      allow_retry: allowRetry,
    } as any;
  }
}
