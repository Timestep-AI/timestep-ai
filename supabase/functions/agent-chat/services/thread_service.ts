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
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    return await this._threadStore.deleteThread(threadId);
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
}
