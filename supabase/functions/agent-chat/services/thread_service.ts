import { ThreadStore } from '../stores/thread_store.ts';
import type { ThreadMetadata } from '../types/chatkit.ts';
import type { Page } from '../stores/thread_message_store.ts';

/**
 * Service layer for thread metadata operations
 * Handles thread lifecycle, metadata, and basic thread management
 */
export class ThreadService {
  private _threadStore: ThreadStore;

  // Expose the underlying store for utility classes that need direct access
  get threadStore(): ThreadStore {
    return this._threadStore;
  }

  constructor(
    private supabaseUrl: string,
    private userJwt: string,
    private userId: string
  ) {
    this._threadStore = new ThreadStore(supabaseUrl, userJwt, userId);
  }

  /**
   * Generate a unique thread ID
   */
  generateThreadId(): string {
    return this._threadStore.generateThreadId();
  }

  /**
   * Load a thread by ID
   */
  async loadThread(threadId: string): Promise<ThreadMetadata> {
    return await this._threadStore.loadThread(threadId);
  }

  /**
   * Save a thread
   */
  async saveThread(thread: ThreadMetadata): Promise<void> {
    return await this._threadStore.saveThread(thread);
  }

  /**
   * Load all threads with pagination
   */
  async loadThreads(
    limit: number,
    after: string | null,
    order: string
  ): Promise<Page<ThreadMetadata>> {
    return await this._threadStore.loadThreads(limit, after, order);
  }

  /**
   * Create a new thread with proper initialization
   * This is a business operation that combines multiple repository calls
   */
  async createThread(title?: string): Promise<ThreadMetadata> {
    const threadId = this.generateThreadId();
    const thread: ThreadMetadata = {
      id: threadId,
      title: title || 'New Chat',
      created_at: new Date(),
      status: { type: 'active' },
      metadata: {},
    };

    await this.saveThread(thread);
    return thread;
  }

  /**
   * Update thread title
   */
  async updateThreadTitle(threadId: string, title: string): Promise<ThreadMetadata> {
    const thread = await this.loadThread(threadId);
    thread.title = title;
    await this.saveThread(thread);
    return thread;
  }

  /**
   * Get thread count for user
   */
  async getThreadCount(): Promise<number> {
    return await this._threadStore.getThreadCount();
  }

  /**
   * Update thread metadata
   */
  async updateThreadMetadata(threadId: string, metadata: Record<string, any>): Promise<void> {
    return await this._threadStore.updateThreadMetadata(threadId, metadata);
  }

  /**
   * Get thread by ID (moved from ChatKitService)
   */
  async getThreadById(threadId: string): Promise<object> {
    return await this.loadThread(threadId);
  }

  /**
   * List threads with pagination (moved from ChatKitService)
   */
  async listThreads(
    limit: number = 20,
    after: string | null = null,
    order: string = 'desc'
  ): Promise<object> {
    const threads = await this.loadThreads(limit, after, order);
    return {
      data: await Promise.all(threads.data.map((t) => this.loadThread(t.id))),
      has_more: threads.has_more,
      after: threads.after,
    };
  }

  /**
   * Update thread title (moved from ChatKitService)
   */
  async updateThread(threadId: string, title: string): Promise<object> {
    const thread = await this.loadThread(threadId);
    thread.title = title;
    await this.saveThread(thread);
    return await this.loadThread(threadId);
  }

  /**
   * Delete thread (moved from ChatKitService)
   */
  async deleteThread(threadId: string): Promise<object> {
    await this._threadStore.deleteThread(threadId);
    return {};
  }

  /**
   * Convert Thread to ThreadMetadata (moved from ChatKitService)
   */
  threadToMetadata(thread: any): ThreadMetadata {
    return {
      id: thread.id,
      created_at: new Date(thread.created_at * 1000),
      status: thread.status,
      metadata: thread.metadata,
    };
  }
}
