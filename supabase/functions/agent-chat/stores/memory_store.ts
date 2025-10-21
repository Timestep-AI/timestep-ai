// Memory Store - Implements the Store interface for ChatKit data
// Uses clean thread/message format as canonical storage and converts to ChatKit format as needed
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ThreadMetadata, ThreadItem, Attachment } from '../types/chatkit.ts';
import { createOpenAIClient } from '../utils/openai_client.ts';

export interface Page<T> {
  data: T[];
  has_more: boolean;
  after: string | null;
}

// Clean thread and message formats
export interface Thread {
  id: string;
  user_id: string;
  created_at: number; // Unix timestamp
  metadata: Record<string, string>;
  object: 'thread';
  updated_at: string;
}

export interface UserMessage {
  id: string;
  role: 'user';
  content: string; // Text input from the user
  name?: string; // Optional user identifier
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  content?: string; // Text response from the assistant (optional if using tool calls)
  name?: string; // Optional assistant identifier
  toolCalls?: ToolCall[]; // Optional tool calls made by the assistant
}

export interface ToolMessage {
  id: string;
  role: 'tool';
  content: string; // Result from the tool execution
  toolCallId: string; // ID of the tool call this message responds to
}

export interface ToolCall {
  id: string; // Unique ID for this tool call
  type: 'function'; // Type of tool call
  function: {
    name: string; // Name of the function to call
    arguments: string; // JSON-encoded string of arguments
  };
}

export type ThreadMessage = UserMessage | AssistantMessage | ToolMessage;

export class MemoryStore<TContext = any> {
  private supabase: ReturnType<typeof createClient>;
  private attachments: Map<string, Attachment> = new Map();
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

  generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async loadThread(threadId: string): Promise<ThreadMetadata> {
    const { data, error } = await this.supabase
      .from('threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', this.userId)
      .single();

    if (error || !data) {
      console.error('[MemoryStore] Error loading thread:', error);
      throw new Error(`Thread not found: ${threadId}`);
    }

    // Ensure thread has a vector store
    if (!data.vector_store_id) {
      console.log(`[MemoryStore] Thread ${threadId} missing vector store, creating one`);
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
          console.error('[MemoryStore] Error updating thread with vector store:', updateError);
          throw updateError;
        }

        console.log(
          `[MemoryStore] Created vector store ${vectorStore.id} for existing thread ${threadId}`
        );
      } catch (error) {
        console.error(`[MemoryStore] Failed to create vector store for thread ${threadId}:`, error);
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

  async saveThread(thread: ThreadMetadata): Promise<void> {
    // Handle both Date objects and Unix timestamps
    const createdAt =
      thread.created_at instanceof Date
        ? Math.floor(thread.created_at.getTime() / 1000)
        : Math.floor(thread.created_at / 1000);

    // Check if thread already exists to get vector_store_id
    const { data: existingThread } = await this.supabase
      .from('threads')
      .select('vector_store_id')
      .eq('id', thread.id)
      .eq('user_id', this.userId)
      .maybeSingle();

    let vectorStoreId = existingThread?.vector_store_id;

    // Create vector store if this is a new thread
    if (!vectorStoreId) {
      console.log(`[MemoryStore] Creating vector store for thread ${thread.id}`);
      try {
        const vectorStore = await this.openai.vectorStores.create({
          name: `Thread ${thread.id}`,
          metadata: {
            thread_id: thread.id,
            user_id: this.userId,
          },
        });
        vectorStoreId = vectorStore.id;
        console.log(`[MemoryStore] Created vector store ${vectorStoreId} for thread ${thread.id}`);
      } catch (error) {
        console.error(
          `[MemoryStore] Failed to create vector store for thread ${thread.id}:`,
          error
        );
        throw error;
      }
    }

    const { error } = await this.supabase.from('threads').upsert({
      id: thread.id,
      user_id: this.userId,
      created_at: createdAt,
      vector_store_id: vectorStoreId,
      metadata: {
        ...thread.metadata,
        title: (thread as any).title || null,
      },
      object: 'thread',
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[MemoryStore] Error saving thread:', error);
      throw error;
    }
  }

  async loadThreadItems(
    threadId: string,
    after: string | null,
    limit: number,
    order: string
  ): Promise<Page<ThreadItem>> {
    let query = this.supabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq('user_id', this.userId)
      .order('message_index', { ascending: order === 'asc' })
      .limit(limit);

    if (after) {
      // For pagination, fetch items after the 'after' cursor
      const { data: afterItem, error: afterError } = await this.supabase
        .from('thread_messages')
        .select('message_index')
        .eq('id', after)
        .eq('thread_id', threadId)
        .eq('user_id', this.userId)
        .single();

      if (afterError || !afterItem) {
        console.error('[MemoryStore] Error finding "after" item:', afterError);
        throw new Error(`"after" item not found: ${after}`);
      }
      query = query.gt('message_index', afterItem.message_index);
    }

    const { data: messagesData, error } = await query;

    if (error) {
      console.error('[MemoryStore] Error loading thread messages:', error);
      throw error;
    }

    const items: ThreadItem[] = (messagesData || []).map((message: any) =>
      this.convertThreadMessageToChatKit(message, threadId)
    );

    return {
      data: items,
      has_more: false,
      after: null,
    };
  }

  async addThreadItem(threadId: string, item: ThreadItem): Promise<void> {
    const threadMessage = this.convertChatKitToThreadMessage(item, threadId);
    await this.saveThreadMessage(threadMessage);
  }

  async saveThreadItem(threadId: string, item: ThreadItem): Promise<void> {
    const threadMessage = this.convertChatKitToThreadMessage(item, threadId);
    await this.saveThreadMessage(threadMessage);
  }

  private async saveThreadMessage(
    message: ThreadMessage & { thread_id: string; user_id: string; message_index: number }
  ): Promise<void> {
    // Check if message already exists to prevent duplicates
    const { data: existingMessage } = await this.supabase
      .from('thread_messages')
      .select('id')
      .eq('id', message.id)
      .eq('thread_id', message.thread_id)
      .eq('user_id', this.userId)
      .maybeSingle();

    if (existingMessage) {
      return; // Message already exists, skip
    }

    // Get thread's vector store ID
    const { data: thread } = (await this.supabase
      .from('threads')
      .select('vector_store_id')
      .eq('id', message.thread_id)
      .eq('user_id', this.userId)
      .single()) as { data: { vector_store_id: string | null } | null };

    if (!thread?.vector_store_id) {
      throw new Error(`Thread ${message.thread_id} does not have a vector store`);
    }

    const vectorStoreId = thread.vector_store_id;
    let fileId: string | null = null;

    // Store message as a file in the vector store for semantic search
    if (message.content) {
      // Create JSONL representation of the message
      const messageJson = JSON.stringify({
        id: message.id,
        thread_id: message.thread_id,
        role: message.role,
        content: message.content,
        ...((message.role === 'user' || message.role === 'assistant') &&
        (message as UserMessage | AssistantMessage).name
          ? { name: (message as UserMessage | AssistantMessage).name }
          : {}),
        ...(message.role === 'assistant' && (message as AssistantMessage).toolCalls
          ? { tool_calls: (message as AssistantMessage).toolCalls }
          : {}),
        ...(message.role === 'tool' ? { tool_call_id: (message as ToolMessage).toolCallId } : {}),
      });

      // Create a File object from the message JSONL
      const blob = new Blob([messageJson], { type: 'application/jsonl' });
      const file = new File([blob], `message_${message.id}.jsonl`, {
        type: 'application/jsonl',
      });

      // Upload file using OpenAI client
      const uploadedFile = await this.openai.files.create({
        file: file,
        purpose: 'assistants',
      });

      fileId = uploadedFile.id;

      // Add file to vector store
      await this.openai.vectorStores.files.create(vectorStoreId, {
        file_id: fileId,
      });
    }

    // Insert the message with atomic index calculation
    // Use retry logic to handle any remaining race conditions

    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get the next message index using the database function with locking
        const { data: nextIndex, error: indexError } = await this.supabase.rpc(
          'get_next_message_index',
          { p_thread_id: message.thread_id }
        );

        if (indexError || nextIndex === null || nextIndex === undefined) {
          console.error('[MemoryStore] Error getting next message index:', indexError);
          throw new Error(
            `Failed to get next message index: ${indexError?.message || 'unknown error'}`
          );
        }

        const { data, error } = await this.supabase
          .from('thread_messages')
          .insert({
            id: message.id,
            thread_id: message.thread_id,
            user_id: this.userId,
            message_index: nextIndex,
            role: message.role,
            content: message.content,
            name: message.name,
            tool_calls:
              message.role === 'assistant' && (message as AssistantMessage).toolCalls
                ? (message as AssistantMessage).toolCalls
                : null,
            tool_call_id: message.role === 'tool' ? (message as ToolMessage).toolCallId : null,
            file_id: fileId,
            created_at: new Date().toISOString(),
          })
          .select('message_index')
          .single();

        if (error) {
          // Check if it's a constraint violation (duplicate index)
          if (
            error.code === '23505' &&
            error.message.includes('thread_messages_thread_id_message_index_key')
          ) {
            console.warn(
              `[MemoryStore] Index constraint violation on attempt ${attempt + 1}, retrying...`
            );
            lastError = error;
            // Small delay before retry
            await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
            continue;
          } else if (error.code === '23505') {
            // Duplicate message ID - this is expected, skip
            console.log(`[MemoryStore] Message ${message.id} already exists, skipping`);
            return;
          } else {
            throw error;
          }
        }

        // Success
        return;
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries - 1) {
          console.error('[MemoryStore] Error saving thread message after retries:', error);
          throw error;
        }
        // Small delay before retry
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }

    // If we get here, all retries failed
    throw lastError;
  }

  private convertChatKitToThreadMessage(
    item: ThreadItem,
    threadId: string
  ): ThreadMessage & { thread_id: string; user_id: string; message_index: number } {
    const baseMessage = {
      id: item.id,
      thread_id: threadId,
      user_id: this.userId,
      message_index: 0, // Will be set by saveThreadMessage
    };

    if (item.type === 'user_message') {
      const userItem = item as any;
      const textContent =
        userItem.content
          ?.filter((part: any) => part.type === 'input_text')
          ?.map((part: any) => part.text)
          ?.join(' ') || '';

      return {
        ...baseMessage,
        role: 'user' as const,
        content: textContent,
        name: undefined,
      };
    } else if (item.type === 'assistant_message') {
      const assistantItem = item as any;
      const textContent =
        assistantItem.content
          ?.filter((part: any) => part.type === 'output_text')
          ?.map((part: any) => part.text)
          ?.join(' ') || '';

      return {
        ...baseMessage,
        role: 'assistant' as const,
        content: textContent,
        name: undefined,
        toolCalls: assistantItem.tool_calls || undefined,
      };
    } else if (item.type === 'tool_message') {
      const toolItem = item as any;

      return {
        ...baseMessage,
        role: 'tool' as const,
        content: toolItem.content,
        toolCallId: toolItem.tool_call_id,
      };
    } else if (item.type === 'client_tool_call') {
      const toolItem = item as any;

      // If it has output, it's a tool message
      if (toolItem.output) {
        return {
          ...baseMessage,
          role: 'tool' as const,
          content:
            typeof toolItem.output === 'string' ? toolItem.output : JSON.stringify(toolItem.output),
          toolCallId: toolItem.call_id,
        };
      } else {
        // Otherwise, it's an assistant message with tool calls
        const toolCall: ToolCall = {
          id: toolItem.call_id,
          type: 'function',
          function: {
            name: toolItem.name,
            arguments: toolItem.arguments,
          },
        };

        return {
          ...baseMessage,
          role: 'assistant' as const,
          content: undefined,
          name: undefined,
          toolCalls: [toolCall],
        };
      }
    }

    // Default fallback for unknown types
    return {
      ...baseMessage,
      role: 'assistant' as const,
      content: JSON.stringify(item),
      name: undefined,
    };
  }

  private convertThreadMessageToChatKit(message: any, threadId: string): ThreadItem {
    const createdAt = Math.floor(new Date(message.created_at).getTime() / 1000);

    if (message.role === 'user') {
      // Parse the content properly - it should be an array of content parts
      let content;
      try {
        content =
          typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
        // Ensure it's an array
        if (!Array.isArray(content)) {
          content = [{ type: 'input_text', text: String(message.content || '') }];
        }
      } catch (e) {
        content = [{ type: 'input_text', text: String(message.content || '') }];
      }

      return {
        type: 'user_message',
        id: message.id,
        thread_id: threadId,
        content: content,
        created_at: createdAt,
        attachments: [],
      } as any;
    } else if (message.role === 'assistant') {
      // Parse the content properly - it should be an array of content parts
      let content;
      try {
        content =
          typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
        // Ensure it's an array
        if (!Array.isArray(content)) {
          content = [{ type: 'output_text', text: String(message.content || ''), annotations: [] }];
        }
      } catch (e) {
        content = [{ type: 'output_text', text: String(message.content || ''), annotations: [] }];
      }

      // Check if this is a widget item by looking at the content structure
      if (content && content.length === 1 && content[0] && content[0].type === 'widget') {
        return content[0] as any;
      }

      return {
        type: 'assistant_message',
        id: message.id,
        thread_id: threadId,
        content: content,
        created_at: createdAt,
      } as any;
    } else if (message.role === 'tool') {
      return {
        type: 'tool_message',
        id: message.id,
        thread_id: threadId,
        content: message.content,
        created_at: createdAt,
        tool_call_id: message.tool_call_id,
        arguments: '',
        output: message.content?.text || '',
        status: 'completed',
      } as any;
    }

    // Fallback for unknown message types
    return {
      type: 'assistant_message',
      id: message.id,
      thread_id: threadId,
      content: [{ type: 'output_text', text: JSON.stringify(message), annotations: [] }],
      created_at: createdAt,
    } as any;
  }

  async loadItem(threadId: string, itemId: string): Promise<ThreadItem> {
    const { data: messageData, error } = await this.supabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq('id', itemId)
      .eq('user_id', this.userId)
      .single();

    if (error || !messageData) {
      console.error('[MemoryStore] Error loading thread message:', error);
      throw new Error(`Thread message not found: ${itemId}`);
    }

    return this.convertThreadMessageToChatKit(messageData, threadId);
  }

  async loadThreadItem(itemId: string, threadId: string): Promise<ThreadItem | null> {
    try {
      const { data: messageData } = await this.supabase
        .from('thread_messages')
        .select('*')
        .eq('thread_id', threadId)
        .eq('id', itemId)
        .eq('user_id', this.userId)
        .single();

      if (!messageData) {
        return null;
      }

      const result = this.convertThreadMessageToChatKit(messageData, threadId);
      return result;
    } catch (error) {
      console.error('[MemoryStore] Error loading thread item:', error);
      throw error; // Re-throw to avoid hiding issues
    }
  }

  // Run state methods - using thread_run_states table
  async saveRunState(threadId: string, state: string): Promise<void> {
    const { error } = await this.supabase.from('thread_run_states').upsert({
      thread_id: threadId,
      user_id: this.userId,
      state_data: state,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[MemoryStore] Error saving run state:', error);
      throw error;
    }
  }

  async loadRunState(threadId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('thread_run_states')
      .select('state_data')
      .eq('thread_id', threadId)
      .eq('user_id', this.userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No run state found
        return null;
      }
      console.error('[MemoryStore] Error loading run state:', error);
      throw error;
    }

    return data.state_data;
  }

  async clearRunState(threadId: string): Promise<void> {
    const { error } = await this.supabase
      .from('thread_run_states')
      .delete()
      .eq('thread_id', threadId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('[MemoryStore] Error clearing run state:', error);
      throw error;
    }
  }

  // Additional methods required by ChatKit API
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
      .limit(limit);

    if (after) {
      // For pagination, fetch threads after the 'after' cursor
      const { data: afterThread, error: afterError } = await this.supabase
        .from('threads')
        .select('created_at')
        .eq('id', after)
        .eq('user_id', this.userId)
        .single();

      if (afterError || !afterThread) {
        console.error('[MemoryStore] Error finding "after" thread:', afterError);
        throw new Error(`"after" thread not found: ${after}`);
      }
      query = query.lt('created_at', afterThread.created_at);
    }

    const { data: threadsData, error } = await query;

    if (error) {
      console.error('[MemoryStore] Error loading threads:', error);
      throw error;
    }

    const threads: ThreadMetadata[] = (threadsData || []).map((thread: any) => ({
      id: thread.id,
      title: thread.metadata?.title || 'New Chat',
      created_at: new Date(thread.created_at * 1000), // Convert Unix timestamp to Date
      status: { type: 'active' },
      metadata: thread.metadata || {},
    }));

    return {
      data: threads,
      has_more: false, // Simplified for now
      after: threads.length > 0 ? threads[threads.length - 1].id : null,
    };
  }

  async loadFullThread(threadId: string): Promise<any> {
    const { data: threadData, error: convError } = await this.supabase
      .from('threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', this.userId)
      .single();

    if (convError || !threadData) {
      console.error('[MemoryStore] Error loading full thread:', convError);
      throw new Error(`Thread not found: ${threadId}`);
    }

    const thread: ThreadMetadata = {
      id: threadData.id,
      title: threadData.metadata?.title || 'New Chat',
      created_at: new Date(threadData.created_at * 1000),
      status: { type: 'active' },
      metadata: threadData.metadata || {},
    };

    const messagesPage = await this.loadThreadItems(threadId, null, 100, 'asc');
    const threadItems: ThreadItem[] = messagesPage.data; // Already converted in loadThreadItems

    return {
      id: thread.id,
      created_at: thread.created_at,
      status: thread.status || { type: 'active' },
      metadata: thread.metadata || {},
      title: (thread as any).title,
      items: {
        data: threadItems,
        has_more: messagesPage.has_more,
        after: messagesPage.after,
      },
    };
  }

  async deleteThread(threadId: string): Promise<void> {
    const { error: itemsError } = await this.supabase
      .from('thread_messages')
      .delete()
      .eq('thread_id', threadId)
      .eq('user_id', this.userId);

    if (itemsError) {
      console.error('[MemoryStore] Error deleting thread messages:', itemsError);
      throw itemsError;
    }

    const { error: threadError } = await this.supabase
      .from('threads')
      .delete()
      .eq('id', threadId)
      .eq('user_id', this.userId);

    if (threadError) {
      console.error('[MemoryStore] Error deleting thread:', threadError);
      throw threadError;
    }
  }

  /**
   * Get conversation context using K+N retrieval pattern:
   * - K most semantically similar messages to the user query
   * - N most recent messages for temporal context
   *
   * @param threadId The thread to search in
   * @param userMessage The user's message to find similar context for
   * @param options Configuration for retrieval
   * @returns Combined context messages
   */
  async getConversationContext(
    threadId: string,
    userMessage: string,
    options: {
      recentCount?: number; // N - number of recent messages (default: 10)
      similarCount?: number; // K - number of similar messages (default: 5)
      scoreThreshold?: number; // Minimum similarity score (default: 0.7)
    } = {}
  ): Promise<{
    recentMessages: ThreadMessage[];
    similarMessages: Array<ThreadMessage & { similarity_score: number }>;
    combinedMessages: ThreadMessage[];
  }> {
    const recentCount = options.recentCount ?? 10;
    const similarCount = options.similarCount ?? 5;
    const scoreThreshold = options.scoreThreshold ?? 0.7;

    // Get N most recent messages
    const { data: recentMessagesData } = await this.supabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq('user_id', this.userId)
      .order('message_index', { ascending: false })
      .limit(recentCount);

    const recentMessages: ThreadMessage[] = (recentMessagesData || [])
      .reverse() // Put back in chronological order
      .map((msg) => this.dbMessageToThreadMessage(msg));

    // Get thread's vector store for semantic search
    const { data: thread, error: threadError } = (await this.supabase
      .from('threads')
      .select('vector_store_id')
      .eq('id', threadId)
      .eq('user_id', this.userId)
      .single()) as { data: { vector_store_id: string | null } | null; error: Error | null };

    if (threadError || !thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    if (!thread.vector_store_id) {
      throw new Error(`Thread ${threadId} does not have a vector store`);
    }

    const vectorStoreId = thread.vector_store_id;

    // Search vector store for similar messages using fetch since SDK might not have search method
    const searchResponse = await fetch(
      `${this.supabaseUrl}/functions/v1/openai-polyfill/vector_stores/${vectorStoreId}/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.userJwt}`,
        },
        body: JSON.stringify({
          query: userMessage,
          max_num_results: similarCount,
          ranking_options: {
            score_threshold: scoreThreshold,
          },
        }),
      }
    );

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Vector store search failed: ${error}`);
    }

    const searchResults = await searchResponse.json();

    const similarMessages: Array<ThreadMessage & { similarity_score: number }> = [];

    // Convert search results back to messages
    for (const result of searchResults.data) {
      // Extract message ID from filename (format: message_{id}.jsonl)
      const messageId = result.filename.replace('message_', '').replace('.jsonl', '');

      // Load the actual message from database
      const { data: messageData } = await this.supabase
        .from('thread_messages')
        .select('*')
        .eq('id', messageId)
        .eq('thread_id', threadId)
        .eq('user_id', this.userId)
        .single();

      if (messageData) {
        const message = this.dbMessageToThreadMessage(messageData);
        similarMessages.push({
          ...message,
          similarity_score: result.score,
        });
      }
    }

    // Combine messages, removing duplicates (prefer similar messages as they have scores)
    const messageIds = new Set<string>();
    const combinedMessages: ThreadMessage[] = [];

    // Add similar messages first (they're more relevant)
    for (const msg of similarMessages) {
      if (!messageIds.has(msg.id)) {
        messageIds.add(msg.id);
        combinedMessages.push(msg);
      }
    }

    // Add recent messages (for temporal context)
    for (const msg of recentMessages) {
      if (!messageIds.has(msg.id)) {
        messageIds.add(msg.id);
        combinedMessages.push(msg);
      }
    }

    // Sort combined messages chronologically
    combinedMessages.sort((a, b) => {
      const indexA = recentMessagesData?.findIndex((m) => m.id === a.id) ?? -1;
      const indexB = recentMessagesData?.findIndex((m) => m.id === b.id) ?? -1;
      return (indexA >= 0 ? indexA : Infinity) - (indexB >= 0 ? indexB : Infinity);
    });

    return {
      recentMessages,
      similarMessages,
      combinedMessages,
    };
  }

  /**
   * Convert database message format to ThreadMessage format
   */
  private dbMessageToThreadMessage(dbMessage: any): ThreadMessage {
    const baseMessage = {
      id: dbMessage.id,
    };

    if (dbMessage.role === 'user') {
      return {
        ...baseMessage,
        role: 'user' as const,
        content: dbMessage.content || '',
        name: dbMessage.name,
      };
    } else if (dbMessage.role === 'assistant') {
      return {
        ...baseMessage,
        role: 'assistant' as const,
        content: dbMessage.content,
        name: dbMessage.name,
        toolCalls: dbMessage.tool_calls,
      };
    } else if (dbMessage.role === 'tool') {
      return {
        ...baseMessage,
        role: 'tool' as const,
        content: dbMessage.content || '',
        toolCallId: dbMessage.tool_call_id,
      };
    }

    // Fallback
    return {
      ...baseMessage,
      role: 'assistant' as const,
      content: JSON.stringify(dbMessage),
    };
  }

  /**
   * Save response data for trace enrichment
   */
  async saveResponse(responseData: {
    id: string;
    thread_id?: string;
    model?: string;
    instructions?: string;
    usage?: any;
    tools?: any;
    messages?: any;
    output?: any;
    output_type?: string;
    metadata?: any;
  }): Promise<void> {
    const { error } = await this.supabase.from('responses').upsert(
      {
        id: responseData.id,
        user_id: this.userId,
        thread_id: responseData.thread_id || null,
        model: responseData.model || null,
        instructions: responseData.instructions || null,
        usage: responseData.usage || null,
        tools: responseData.tools || null,
        messages: responseData.messages || null,
        output: responseData.output || null,
        output_type: responseData.output_type || null,
        metadata: responseData.metadata || {},
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('[MemoryStore] Error saving response:', error);
      throw error;
    }
  }
}
