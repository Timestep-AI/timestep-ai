import { ThreadStore } from '../stores/thread_store.ts';
import type { ThreadMetadata, ThreadItem } from '../types/chatkit.ts';
import type { Page, ThreadMessage } from '../stores/thread_store.ts';

/**
 * Service layer for thread operations
 * Provides business logic and delegates to ThreadStore repository
 */
export class ThreadService {
  private store: ThreadStore;

  // Expose the underlying store for utility classes that need direct access
  get threadStore(): ThreadStore {
    return this.store;
  }

  constructor(
    private supabaseUrl: string,
    private userJwt: string,
    private userId: string
  ) {
    this.store = new ThreadStore(supabaseUrl, userJwt, userId);
  }

  /**
   * Generate a unique thread ID
   */
  generateThreadId(): string {
    return this.store.generateThreadId();
  }

  /**
   * Generate a unique item ID
   */
  generateItemId(): string {
    return this.store.generateItemId();
  }

  /**
   * Load a thread by ID
   */
  async loadThread(threadId: string): Promise<ThreadMetadata> {
    return await this.store.loadThread(threadId);
  }

  /**
   * Save a thread
   */
  async saveThread(thread: ThreadMetadata): Promise<void> {
    return await this.store.saveThread(thread);
  }

  /**
   * Load thread items with pagination
   */
  async loadThreadItems(
    threadId: string,
    after: string | null,
    limit: number,
    order: string
  ): Promise<Page<ThreadItem>> {
    return await this.store.loadThreadItems(threadId, after, limit, order);
  }

  /**
   * Add a new item to a thread
   */
  async addThreadItem(threadId: string, item: ThreadItem): Promise<void> {
    return await this.store.addThreadItem(threadId, item);
  }

  /**
   * Save/update a thread item
   */
  async saveThreadItem(threadId: string, item: ThreadItem): Promise<void> {
    return await this.store.saveThreadItem(threadId, item);
  }

  /**
   * Load a specific item from a thread
   */
  async loadItem(threadId: string, itemId: string): Promise<ThreadItem> {
    return await this.store.loadItem(threadId, itemId);
  }

  /**
   * Load a thread item by ID
   */
  async loadThreadItem(itemId: string, threadId: string): Promise<ThreadItem | null> {
    return await this.store.loadThreadItem(itemId, threadId);
  }

  /**
   * Save run state for a thread
   */
  async saveRunState(threadId: string, state: string): Promise<void> {
    return await this.store.saveRunState(threadId, state);
  }

  /**
   * Load run state for a thread
   */
  async loadRunState(threadId: string): Promise<string | null> {
    return await this.store.loadRunState(threadId);
  }

  /**
   * Clear run state for a thread
   */
  async clearRunState(threadId: string): Promise<void> {
    return await this.store.clearRunState(threadId);
  }

  /**
   * Load all threads with pagination
   */
  async loadThreads(
    limit: number,
    after: string | null,
    order: string
  ): Promise<Page<ThreadMetadata>> {
    return await this.store.loadThreads(limit, after, order);
  }

  /**
   * Load a full thread with all its items
   */
  async loadFullThread(threadId: string): Promise<any> {
    return await this.store.loadFullThread(threadId);
  }

  /**
   * Delete a thread and all its items
   */
  async deleteThread(threadId: string): Promise<void> {
    return await this.store.deleteThread(threadId);
  }

  /**
   * Get conversation context using K+N retrieval pattern
   * This is a higher-level business operation that combines recent and similar messages
   */
  async getConversationContext(
    threadId: string,
    userMessage: string,
    options: {
      recentCount?: number;
      similarCount?: number;
      scoreThreshold?: number;
    } = {}
  ): Promise<{
    recentMessages: ThreadMessage[];
    similarMessages: Array<ThreadMessage & { similarity_score: number }>;
    combinedMessages: ThreadMessage[];
  }> {
    return await this.store.getConversationContext(threadId, userMessage, options);
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
   * Get thread statistics
   */
  async getThreadStats(threadId: string): Promise<{
    messageCount: number;
    lastActivity: Date | null;
  }> {
    const items = await this.loadThreadItems(threadId, null, 1000, 'desc');
    const messageCount = items.data.length;
    const lastActivity = items.data.length > 0 ? new Date(items.data[0].created_at * 1000) : null;

    return {
      messageCount,
      lastActivity,
    };
  }
}
