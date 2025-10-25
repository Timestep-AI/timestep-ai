import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ThreadMessage } from '../types/chatkit.ts';
import { createOpenAIClient } from '../utils/openai_client.ts';

export interface Page<T> {
  data: T[];
  has_more: boolean;
  after: string | null;
}

// Clean message formats for database operations
export interface ThreadMessage {
  id: string;
  thread_id: string;
  user_id: string;
  message_index: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  created_at: number; // Unix timestamp
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Repository for thread message operations
 * Handles all database interactions related to thread_messages table
 */
export class ThreadMessageStore {
  private supabase: any;
  private openai: any;

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
   * Generate a unique item ID
   */
  generateItemId(prefix: string = 'item'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Load thread messages with pagination
   */
  async loadThreadMessages(
    threadId: string,
    after: string | null,
    limit: number,
    order: string
  ): Promise<Page<ThreadMessage>> {
    let query = this.supabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: order === 'asc' })
      .limit(limit + 1); // Get one extra to check if there are more

    if (after) {
      const afterItem = await this.supabase
        .from('thread_messages')
        .select('created_at')
        .eq('id', after)
        .single();

      if (afterItem.data) {
        query = query.lt('created_at', afterItem.data.created_at);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading thread items:', error);
      throw new Error(`Failed to load thread items: ${error.message}`);
    }

    const hasMore = data && data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data || [];
    const lastItem = items.length > 0 ? items[items.length - 1] : null;

    return {
      data: items.map(this.mapToThreadMessage),
      has_more: hasMore,
      after: lastItem ? lastItem.id : null,
    };
  }

  /**
   * Add a new message to a thread
   */
  async addThreadMessage(threadId: string, message: ThreadMessage): Promise<void> {
    // Get the next message index for this thread
    const { data: nextIndex, error: indexError } = await this.supabase.rpc(
      'get_next_message_index',
      { p_thread_id: threadId }
    );

    if (indexError) {
      console.error('Error getting next message index:', indexError);
      throw new Error(`Failed to get next message index: ${indexError.message}`);
    }

    const messageData = this.mapFromThreadMessage(threadId, message, nextIndex);

    const { error } = await this.supabase.from('thread_messages').insert(messageData);

    if (error) {
      console.error('Error adding thread item:', error);
      throw new Error(`Failed to add thread item: ${error.message}`);
    }
  }

  /**
   * Save/update a thread message
   */
  async saveThreadMessage(threadId: string, message: ThreadMessage): Promise<void> {
    // For updates, we need to get the existing message index or create a new one
    let messageIndex = 0;

    try {
      const existing = await this.loadThreadMessage(message.id, threadId);
      if (existing) {
        // For updates, we'll use the existing message index
        // We need to get it from the database since ThreadMessage doesn't include it
        const { data: existingData } = await this.supabase
          .from('thread_messages')
          .select('message_index')
          .eq('id', item.id)
          .eq('thread_id', threadId)
          .single();

        messageIndex = existingData?.message_index || 0;
      } else {
        // For new items, get the next message index
        const { data: nextIndex, error: indexError } = await this.supabase.rpc(
          'get_next_message_index',
          { p_thread_id: threadId }
        );

        if (indexError) {
          console.error('Error getting next message index:', indexError);
          throw new Error(`Failed to get next message index: ${indexError.message}`);
        }

        messageIndex = nextIndex;
      }
    } catch (error) {
      // If we can't get the existing index, get a new one
      const { data: nextIndex, error: indexError } = await this.supabase.rpc(
        'get_next_message_index',
        { p_thread_id: threadId }
      );

      if (indexError) {
        console.error('Error getting next message index:', indexError);
        throw new Error(`Failed to get next message index: ${indexError.message}`);
      }

      messageIndex = nextIndex;
    }

    const messageData = this.mapFromThreadMessage(threadId, message, messageIndex);

    const { error } = await this.supabase
      .from('thread_messages')
      .upsert(messageData, { onConflict: 'id' });

    if (error) {
      console.error('Error saving thread item:', error);
      throw new Error(`Failed to save thread item: ${error.message}`);
    }
  }

  /**
   * Load a specific message from a thread
   */
  async loadMessage(threadId: string, messageId: string): Promise<ThreadMessage> {
    const { data, error } = await this.supabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq('id', messageId)
      .single();

    if (error) {
      console.error('Error loading item:', error);
      throw new Error(`Failed to load item: ${error.message}`);
    }

    return this.mapToThreadMessage(data);
  }

  /**
   * Load a thread message by ID
   */
  async loadThreadMessage(messageId: string, threadId: string): Promise<ThreadMessage | null> {
    const { data, error } = await this.supabase
      .from('thread_messages')
      .select('*')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error loading thread item:', error);
      throw new Error(`Failed to load thread item: ${error.message}`);
    }

    return this.mapToThreadMessage(data);
  }

  /**
   * Get conversation context using K+N retrieval pattern
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
    const { recentCount = 10, similarCount = 5, scoreThreshold = 0.7 } = options;

    // Get recent messages
    const recentResult = await this.supabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(recentCount);

    if (recentResult.error) {
      console.error('Error loading recent messages:', recentResult.error);
      throw new Error(`Failed to load recent messages: ${recentResult.error.message}`);
    }

    const recentMessages = recentResult.data || [];

    // Get similar messages using vector similarity
    let similarMessages: Array<ThreadMessage & { similarity_score: number }> = [];

    try {
      // Create embedding for the user message
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: userMessage,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Query for similar messages using vector similarity
      const similarResult = await this.supabase.rpc('match_messages', {
        query_embedding: embedding,
        match_thread_id: threadId,
        match_threshold: scoreThreshold,
        match_count: similarCount,
      });

      if (similarResult.data) {
        similarMessages = similarResult.data;
      }
    } catch (error) {
      console.warn('Vector similarity search failed, using recent messages only:', error);
    }

    // Combine and deduplicate messages
    const allMessages = [...recentMessages, ...similarMessages];
    const uniqueMessages = allMessages.filter(
      (message, index, self) => index === self.findIndex((m) => m.id === message.id)
    );

    // Sort by creation time
    uniqueMessages.sort((a, b) => a.created_at - b.created_at);

    return {
      recentMessages,
      similarMessages,
      combinedMessages: uniqueMessages,
    };
  }

  /**
   * Delete all messages for a thread
   */
  async deleteThreadMessages(threadId: string): Promise<void> {
    const { error } = await this.supabase
      .from('thread_messages')
      .delete()
      .eq('thread_id', threadId);

    if (error) {
      console.error('Error deleting thread messages:', error);
      throw new Error(`Failed to delete thread messages: ${error.message}`);
    }
  }

  /**
   * Map database record to ThreadMessage
   */
  private mapToThreadMessage(data: any): ThreadMessage {
    // Parse content back from JSON string to object/array
    let content = data.content;
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch (e) {
        // If parsing fails, keep as string
        content = content;
      }
    }

    return {
      id: data.id,
      thread_id: data.thread_id,
      created_at: Math.floor(new Date(data.created_at).getTime() / 1000), // Convert to Unix timestamp
      type:
        data.role === 'user'
          ? 'user_message'
          : data.role === 'assistant'
            ? 'assistant_message'
            : data.role === 'tool'
              ? 'tool_message'
              : 'unknown',
      content: content,
      ...(data.name && { name: data.name }),
      ...(data.tool_call_id && { tool_call_id: data.tool_call_id }),
    };
  }

  /**
   * Map ThreadMessage to database record
   */
  private mapFromThreadMessage(
    threadId: string,
    message: ThreadMessage,
    messageIndex?: number
  ): any {
    const role =
      message.type === 'user_message'
        ? 'user'
        : message.type === 'assistant_message'
          ? 'assistant'
          : message.type === 'tool_message'
            ? 'tool'
            : 'system';

    return {
      id: message.id,
      thread_id: threadId,
      user_id: this.userId,
      message_index: messageIndex || 0,
      role,
      content:
        typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
      ...(message.name && { name: message.name }),
      ...(message.tool_call_id && { tool_call_id: message.tool_call_id }),
      created_at: new Date(message.created_at * 1000).toISOString(),
    };
  }
}
