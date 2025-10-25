import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ThreadMetadata } from '../types/chatkit.ts';
import { createOpenAIClient } from '../utils/openai_client.ts';

export interface Page<T> {
  data: T[];
  has_more: boolean;
  after: string | null;
}

/**
 * Repository for thread metadata operations
 * Handles all database interactions related to threads table only
 */
export class ThreadStore {
  private supabase: ReturnType<typeof createClient>;
  private openai: ReturnType<typeof createOpenAIClient>;

  constructor(
    private supabaseUrl: string,
    private userJwt: string,
    private userId: string
  ) {
    // Create Supabase client for database access with user's JWT
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    this.supabase = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userJwt}`,
        },
      },
    });

    // Create OpenAI client pointing to our polyfill for vector stores, files, etc.
    this.openai = createOpenAIClient(supabaseUrl, userJwt);
  }

  /**
   * Generate a unique thread ID
   */
  generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load a thread by ID
   */
  async loadThread(threadId: string): Promise<ThreadMetadata> {
    const { data, error } = await this.supabase
      .from('threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', this.userId)
      .single();

    if (error || !data) {
      console.error('[ThreadStore] Error loading thread:', error);
      throw new Error(`Thread not found: ${threadId}`);
    }

    // Ensure thread has a vector store
    if (!data.vector_store_id) {
      console.log(`[ThreadStore] Thread ${threadId} missing vector store, creating one`);
      try {
        const vectorStore = await this.openai.vectorStores.create({
          name: `Thread ${threadId}`,
          metadata: {
            thread_id: threadId,
            user_id: this.userId,
          },
        });

        // Update thread with vector store ID
        const { error: updateError } = await this.supabase
          .from('threads')
          .update({ vector_store_id: vectorStore.id })
          .eq('id', threadId)
          .eq('user_id', this.userId);

        if (updateError) {
          console.error('[ThreadStore] Error updating thread with vector store:', updateError);
          throw updateError;
        }

        console.log(
          `[ThreadStore] Created vector store ${vectorStore.id} for existing thread ${threadId}`
        );
      } catch (error) {
        console.error(`[ThreadStore] Failed to create vector store for thread ${threadId}:`, error);
        throw error;
      }
    }

    const thread: ThreadMetadata = {
      id: data.id,
      title: data.metadata?.title || 'New Chat',
      created_at: new Date(data.created_at * 1000), // Convert Unix timestamp to Date
      status: { type: 'active' },
      metadata: data.metadata || {},
    };
    return thread;
  }

  /**
   * Save a thread
   */
  async saveThread(thread: ThreadMetadata): Promise<void> {
    // Handle both Date objects and Unix timestamps
    const createdAt =
      thread.created_at instanceof Date
        ? Math.floor(thread.created_at.getTime() / 1000)
        : thread.created_at;

    const threadData = {
      id: thread.id,
      user_id: this.userId,
      created_at: createdAt,
      metadata: {
        ...thread.metadata,
        title: thread.title,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from('threads')
      .upsert(threadData, { onConflict: 'id' });

    if (error) {
      console.error('[ThreadStore] Error saving thread:', error);
      throw new Error(`Failed to save thread: ${error.message}`);
    }
  }

  /**
   * Load all threads with pagination
   */
  async loadThreads(
    limit: number,
    after: string | null,
    order: string
  ): Promise<Page<ThreadMetadata>> {
    let query = this.supabase
      .from('threads')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: order === 'asc' })
      .limit(limit + 1); // Get one extra to check if there are more

    if (after) {
      const afterThread = await this.supabase
        .from('threads')
        .select('created_at')
        .eq('id', after)
        .eq('user_id', this.userId)
        .single();

      if (afterThread.data) {
        query = query.lt('created_at', afterThread.data.created_at);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ThreadStore] Error loading threads:', error);
      throw new Error(`Failed to load threads: ${error.message}`);
    }

    const hasMore = data && data.length > limit;
    const threads = hasMore ? data.slice(0, limit) : data || [];
    const lastThread = threads.length > 0 ? threads[threads.length - 1] : null;

    return {
      data: threads.map(this.mapToThreadMetadata),
      has_more: hasMore,
      after: lastThread ? lastThread.id : null,
    };
  }

  /**
   * Load a full thread with all its items
   */
  async loadFullThread(threadId: string): Promise<any> {
    const thread = await this.loadThread(threadId);
    
    // Return thread in the format expected by ChatKit
    return {
      id: thread.id,
      created_at: Math.floor(thread.created_at.getTime() / 1000),
      status: thread.status,
      metadata: thread.metadata,
      items: { data: [], has_more: false, after: null }, // Items will be loaded separately
    };
  }

  /**
   * Delete a thread and all its items
   */
  async deleteThread(threadId: string): Promise<void> {
    // First, get the thread to find its vector store
    const thread = await this.loadThread(threadId);
    
    // Delete the vector store if it exists
    if (thread.metadata?.vector_store_id) {
      try {
        await this.openai.vectorStores.del(thread.metadata.vector_store_id);
        console.log(`[ThreadStore] Deleted vector store ${thread.metadata.vector_store_id} for thread ${threadId}`);
      } catch (error) {
        console.warn(`[ThreadStore] Failed to delete vector store for thread ${threadId}:`, error);
      }
    }

    // Delete the thread (messages will be deleted by cascade or separately)
    const { error } = await this.supabase
      .from('threads')
      .delete()
      .eq('id', threadId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('[ThreadStore] Error deleting thread:', error);
      throw new Error(`Failed to delete thread: ${error.message}`);
    }
  }

  /**
   * Update thread metadata
   */
  async updateThreadMetadata(threadId: string, metadata: Record<string, any>): Promise<void> {
    const { error } = await this.supabase
      .from('threads')
      .update({
        metadata: metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('[ThreadStore] Error updating thread metadata:', error);
      throw new Error(`Failed to update thread metadata: ${error.message}`);
    }
  }

  /**
   * Get thread count for user
   */
  async getThreadCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('threads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this.userId);

    if (error) {
      console.error('[ThreadStore] Error getting thread count:', error);
      throw new Error(`Failed to get thread count: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Map database record to ThreadMetadata
   */
  private mapToThreadMetadata(data: any): ThreadMetadata {
    return {
      id: data.id,
      title: data.metadata?.title || 'New Chat',
      created_at: new Date(data.created_at * 1000),
      status: { type: 'active' },
      metadata: data.metadata || {},
    };
  }
}
