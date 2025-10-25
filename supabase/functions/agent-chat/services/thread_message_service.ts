import { ThreadMessageStore } from '../stores/thread_message_store.ts';
import type { ThreadItem } from '../types/chatkit.ts';
import type { Page, ThreadMessage } from '../stores/thread_message_store.ts';

/**
 * Service layer for thread message operations
 * Provides business logic and delegates to ThreadMessageStore repository
 */
export class ThreadMessageService {
  private store: ThreadMessageStore;

  // Expose the underlying store for utility classes that need direct access
  get threadMessageStore(): ThreadMessageStore {
    return this.store;
  }

  constructor(
    private supabaseUrl: string,
    private userJwt: string,
    private userId: string
  ) {
    this.store = new ThreadMessageStore(supabaseUrl, userJwt, userId);
  }

  /**
   * Generate a unique item ID
   */
  generateItemId(prefix: string = 'item'): string {
    return this.store.generateItemId(prefix);
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
   * Delete all messages for a thread
   */
  async deleteThreadMessages(threadId: string): Promise<void> {
    return await this.store.deleteThreadMessages(threadId);
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

  /**
   * Search messages in a thread
   */
  async searchMessages(
    threadId: string,
    query: string,
    limit: number = 20
  ): Promise<ThreadItem[]> {
    // This could be enhanced with full-text search or vector similarity
    const items = await this.loadThreadItems(threadId, null, 1000, 'desc');
    
    return items.data.filter(item => {
      if (typeof item.content === 'string') {
        return item.content.toLowerCase().includes(query.toLowerCase());
      }
      return false;
    }).slice(0, limit);
  }

  /**
   * Get message count for a thread
   */
  async getMessageCount(threadId: string): Promise<number> {
    const stats = await this.getThreadStats(threadId);
    return stats.messageCount;
  }

  /**
   * Get last activity for a thread
   */
  async getLastActivity(threadId: string): Promise<Date | null> {
    const stats = await this.getThreadStats(threadId);
    return stats.lastActivity;
  }
}
