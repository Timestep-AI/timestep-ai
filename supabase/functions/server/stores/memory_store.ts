// Memory Store - Implements the Store interface for ChatKit data
// Uses clean thread/message format as canonical storage and converts to ChatKit format as needed
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ThreadMetadata, ThreadItem, Attachment } from '../types/chatkit-types.ts';

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
  role: "user";
  content: string; // Text input from the user
  name?: string; // Optional user identifier
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  content?: string; // Text response from the assistant (optional if using tool calls)
  name?: string; // Optional assistant identifier
  toolCalls?: ToolCall[]; // Optional tool calls made by the assistant
}

export interface ToolMessage {
  id: string;
  role: "tool";
  content: string; // Result from the tool execution
  toolCallId: string; // ID of the tool call this message responds to
}

export interface ToolCall {
  id: string; // Unique ID for this tool call
  type: "function"; // Type of tool call
  function: {
    name: string; // Name of the function to call
    arguments: string; // JSON-encoded string of arguments
  };
}

export type ThreadMessage = UserMessage | AssistantMessage | ToolMessage;

export class MemoryStore<TContext = any> {
  private supabase: ReturnType<typeof createClient>;
  private attachments: Map<string, Attachment> = new Map();

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
          Authorization: `Bearer ${userJwt}`
        }
      }
    });
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

    const thread: ThreadMetadata = {
      id: data.id,
      title: data.metadata?.title || 'New Chat',
      created_at: new Date(data.created_at * 1000), // Convert Unix timestamp to Date
      status: { type: 'active' },
      metadata: data.metadata || {}
    };
    return thread;
  }

  async saveThread(thread: ThreadMetadata): Promise<void> {
    // Handle both Date objects and Unix timestamps
    const createdAt = thread.created_at instanceof Date 
      ? Math.floor(thread.created_at.getTime() / 1000)
      : Math.floor(thread.created_at / 1000);

    const { error } = await this.supabase
      .from('threads')
      .upsert({
        id: thread.id,
        user_id: this.userId,
        created_at: createdAt,
        metadata: {
          ...thread.metadata,
          title: (thread as any).title || null
        },
        object: 'thread',
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('[MemoryStore] Error saving thread:', error);
      throw error;
    }
    console.log('[MemoryStore] Saved thread to database:', thread.id);
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
      after: null
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

  private async saveThreadMessage(message: ThreadMessage & { thread_id: string; user_id: string; message_index: number }): Promise<void> {
    // Check if message already exists to prevent duplicates
    const { data: existingMessage, error: checkError } = await this.supabase
      .from('thread_messages')
      .select('id')
      .eq('id', message.id)
      .maybeSingle();
    
    if (existingMessage) {
      console.log('[MemoryStore] Thread message already exists, skipping save:', message.id);
      return;
    }

    // Get the next message index
    const { data: existingMessages } = await this.supabase
      .from('thread_messages')
      .select('message_index')
      .eq('thread_id', message.thread_id)
      .order('message_index', { ascending: false })
      .limit(1);

    const nextIndex = existingMessages && existingMessages.length > 0 
      ? existingMessages[0].message_index + 1 
      : 0;
      
    console.log('[MemoryStore] Saving thread message with ID:', message.id, 'thread:', message.thread_id, 'role:', message.role);

    const messageData: any = {
      id: message.id,
      thread_id: message.thread_id,
      user_id: this.userId,
        message_index: nextIndex,
      role: message.role,
      content: message.content,
      name: message.name,
      created_at: new Date().toISOString()
    };

    // Add role-specific fields
    if (message.role === 'assistant' && (message as AssistantMessage).toolCalls) {
      messageData.tool_calls = (message as AssistantMessage).toolCalls;
    }
    if (message.role === 'tool') {
      messageData.tool_call_id = (message as ToolMessage).toolCallId;
    }

    const { error } = await this.supabase
      .from('thread_messages')
      .insert(messageData);

    if (error) {
      console.error('[MemoryStore] Error saving thread message:', error);
      throw error;
    }
    console.log('[MemoryStore] Saved thread message to database:', message.id);
  }

  private convertChatKitToThreadMessage(item: ThreadItem, threadId: string): ThreadMessage & { thread_id: string; user_id: string; message_index: number } {
    const baseMessage = {
      id: item.id,
      thread_id: threadId,
      user_id: this.userId,
      message_index: 0, // Will be set by saveThreadMessage
    };

    if (item.type === 'user_message') {
      const userItem = item as any;
      const textContent = userItem.content
        ?.filter((part: any) => part.type === 'input_text')
        ?.map((part: any) => part.text)
        ?.join(' ') || '';
      
      return {
        ...baseMessage,
        role: 'user' as const,
        content: textContent,
        name: undefined
      };
    } else if (item.type === 'assistant_message') {
      const assistantItem = item as any;
      const textContent = assistantItem.content
        ?.filter((part: any) => part.type === 'output_text')
        ?.map((part: any) => part.text)
        ?.join(' ') || '';
      
      return {
        ...baseMessage,
        role: 'assistant' as const,
        content: textContent,
        name: undefined,
        toolCalls: assistantItem.tool_calls || undefined
      };
    } else if (item.type === 'tool_message') {
      const toolItem = item as any;
      
      return {
        ...baseMessage,
        role: 'tool' as const,
        content: toolItem.content,
        toolCallId: toolItem.tool_call_id
      };
    } else if (item.type === 'client_tool_call') {
      const toolItem = item as any;
      
      // If it has output, it's a tool message
      if (toolItem.output) {
        return {
          ...baseMessage,
          role: 'tool' as const,
          content: typeof toolItem.output === 'string' ? toolItem.output : JSON.stringify(toolItem.output),
          toolCallId: toolItem.call_id
        };
      } else {
        // Otherwise, it's an assistant message with tool calls
        const toolCall: ToolCall = {
          id: toolItem.call_id,
          type: 'function',
          function: {
            name: toolItem.name,
            arguments: toolItem.arguments
          }
        };
        
        return {
          ...baseMessage,
          role: 'assistant' as const,
          content: undefined,
          name: undefined,
          toolCalls: [toolCall]
        };
      }
    }

    // Default fallback for unknown types
    return {
      ...baseMessage,
      role: 'assistant' as const,
      content: JSON.stringify(item),
      name: undefined
    };
  }

  private convertThreadMessageToChatKit(message: any, threadId: string): ThreadItem {
    const createdAt = Math.floor(new Date(message.created_at).getTime() / 1000);

    if (message.role === 'user') {
      return {
        type: 'user_message',
        id: message.id,
        thread_id: threadId,
        content: [{ type: 'input_text', text: message.content?.text || '' }],
        created_at: createdAt,
        attachments: []
      } as any;
    } else if (message.role === 'assistant') {
      // Check if this is a widget item by looking at the content structure
      let parsedContent;
      try {
        parsedContent = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
      } catch (e) {
        parsedContent = message.content;
      }
      
      // If it's a widget item, return it as a widget
      if (parsedContent && parsedContent.type === 'widget') {
        return parsedContent as any;
      }
      
      // Otherwise, treat as regular assistant message
      const content = message.content?.text ? [{ type: 'output_text', text: message.content.text, annotations: [] }] : [];
      
      return {
        type: 'assistant_message',
        id: message.id,
        thread_id: threadId,
        content: content,
        created_at: createdAt
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
        status: 'completed'
      } as any;
    }

    // Fallback for unknown message types
    return {
      type: 'assistant_message',
      id: message.id,
      thread_id: threadId,
      content: [{ type: 'output_text', text: JSON.stringify(message), annotations: [] }],
      created_at: createdAt
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
        console.log('[MemoryStore] No thread message found for item:', itemId, 'thread:', threadId);
        return null;
      }
      
      console.log('[MemoryStore] Loading thread message data:', JSON.stringify(messageData, null, 2));
      const result = this.convertThreadMessageToChatKit(messageData, threadId);
      console.log('[MemoryStore] Converted to ChatKit item:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('[MemoryStore] Error loading thread item:', error);
      throw error; // Re-throw to avoid hiding issues
    }
  }


  // Run state methods - using thread_run_states table
  async saveRunState(threadId: string, state: string): Promise<void> {
    const { error } = await this.supabase
      .from('thread_run_states')
      .upsert({
        thread_id: threadId,
        user_id: this.userId,
        state_data: state,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('[MemoryStore] Error saving run state:', error);
      throw error;
    }
    
    console.log('[MemoryStore] Saved run state to database for thread:', threadId);
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
        console.log('[MemoryStore] No run state found for thread:', threadId);
        return null;
      }
      console.error('[MemoryStore] Error loading run state:', error);
      throw error;
    }

    console.log('[MemoryStore] Loaded run state from database for thread:', threadId);
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

    console.log('[MemoryStore] Cleared run state from database for thread:', threadId);
  }

  // Additional methods required by ChatKit API
  async loadThreads(limit: number, after: string | null, order: string): Promise<Page<ThreadMetadata>> {
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
      metadata: thread.metadata || {}
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
      metadata: threadData.metadata || {}
    };

    const messagesPage = await this.loadThreadItems(threadId, null, 100, 'asc');
    const threadItems: ThreadItem[] = messagesPage.data.map(msg => this.convertThreadMessageToChatKit(msg, threadId));

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
    console.log('[MemoryStore] Deleted thread and its messages:', threadId);
  }
}