import { Chat, CreateChatRequest, UpdateChatRequest } from '@/types/chat';
import { Message } from '@/types/message';
import { supabase } from '@/integrations/supabase/client';

// Use environment-based URL for server functions
const getServerBaseUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ohzbghitbjryfpmucgju.supabase.co";
  return `${supabaseUrl}/functions/v1/server`;
};

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No valid session found. Please sign in.');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
};

class ChatsService {
  // Helper method to format tool input like the CLI does
  private formatToolInput(input: string): string {
    try {
      const parsed = JSON.parse(input);
      // Format as a more readable object display
      const entries = Object.entries(parsed);
      if (entries.length === 0) return '{}';
      if (entries.length === 1) {
        const [key, value] = entries[0];
        return `{'${key}': ${JSON.stringify(value)}}`;
      }
      return JSON.stringify(parsed);
    } catch {
      return input;
    }
  }

  async getAll(): Promise<Chat[]> {
    try {
      console.log('ChatsService: Fetching chats from', `${getServerBaseUrl()}/chats`);
      const headers = await getAuthHeaders();
      console.log('ChatsService: Auth headers:', headers);
      const response = await fetch(`${getServerBaseUrl()}/chats`, { headers });
      console.log('ChatsService: Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Failed to fetch chats: ${response.statusText}`);
      }
      const result = await response.json();
      console.log('ChatsService: Raw response:', result);
      
      // The /chats endpoint returns contexts, so we need to map them to Chat format
      const chats = (Array.isArray(result) ? result : []).map((context: any) => {
        // Extract messages from taskHistories to get real message data
        const allMessages: any[] = [];
        if (context.taskHistories && typeof context.taskHistories === 'object') {
          Object.values(context.taskHistories).forEach((taskHistory: any) => {
            if (Array.isArray(taskHistory)) {
              allMessages.push(...taskHistory);
            }
          });
        }
        
        // All items in taskHistories are messages (user messages, function calls, function results, assistant messages)
        const messageContent = allMessages.filter(msg => 
          msg && (msg.type === 'message' || msg.type === 'function_call' || msg.type === 'function_call_result')
        );
        
        // Get the last message content - prefer actual message content over function calls
        const lastMessage = messageContent.length > 0 
          ? (messageContent[messageContent.length - 1].content?.[0]?.text || 
             messageContent[messageContent.length - 1].name || 
             messageContent[messageContent.length - 1].id || 
             '')
          : '';
        
        return {
          id: context.contextId || context.context_id || context.id,
          title: context.title || `Chat ${context.contextId || context.context_id || context.id}`,
          lastMessage: lastMessage,
          createdAt: context.createdAt || context.created_at || new Date().toISOString(),
          updatedAt: context.updatedAt || context.updated_at || new Date().toISOString(),
          messageCount: messageContent.length,
          status: context.status || 'active',
          participants: context.participants || [],
          agentId: context.agentId || context.agent_id || ''
        };
      });
      
      console.log('ChatsService: Processed chats:', chats);
      return chats;
    } catch (error) {
      console.error('Error fetching chats:', error);
      throw error;
    }
  }

  async getRawContextData(id: string): Promise<any | null> {
    try {
      // Since there's no /chats/{id} endpoint, get all chats and find the one with matching ID
      const allChats = await this.getAll();
      const chat = allChats.find(c => c.id === id);
      if (!chat) return null;
      
      // Get the raw context data from the server
      const headers = await getAuthHeaders();
      const response = await fetch(`${getServerBaseUrl()}/chats`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch contexts: ${response.statusText}`);
      }
      const contexts = await response.json();
      
      // Find the context with matching ID
      return contexts.find((context: any) => 
        (context.contextId || context.context_id || context.id) === id
      ) || null;
    } catch (error) {
      console.error('Error fetching raw context data:', error);
      return null;
    }
  }

  async getMessagesFromContext(chatId: string): Promise<Message[]> {
    try {
      // Use the dedicated history endpoint like the CLI does
      const headers = await getAuthHeaders();
      const response = await fetch(`${getServerBaseUrl()}/contexts/${chatId}/history`, { headers });
      
      if (!response.ok) {
        console.error(`Failed to fetch conversation history: ${response.statusText}`);
        return [];
      }
      
      const history = await response.json();
      console.log('Loaded conversation history:', history);

      if (!Array.isArray(history) || history.length === 0) {
        return [];
      }

      // Convert history items to Message format (like CLI does)
      return history.map((msg: any, index: number) => {
        let messageType: 'user' | 'assistant' | 'system' | 'tool_call' | 'tool_response';
        let sender: string;
        let content: string;

        // Handle different message types like the CLI does
        if (msg.role === 'user') {
          messageType = 'user';
          sender = 'User';
          content = msg.content?.[0]?.text || msg.content || '';
        } else if (msg.role === 'assistant') {
          messageType = 'assistant';
          sender = 'Assistant';
          content = msg.content?.[0]?.text || msg.content || '';
        } else if (msg.type === 'function_call') {
          messageType = 'tool_call';
          sender = 'Agent';
          // Format like CLI: functionName("formattedArgs")
          const functionArgs = msg.arguments || msg.parameters || msg.input || '{}';
          const formattedArgs = this.formatToolInput(functionArgs);
          content = `${msg.name}("${formattedArgs}")`;
          console.log('Function call raw data:', msg);
        } else if (msg.type === 'function_call_result') {
          messageType = 'tool_response';
          sender = 'Tool';
          // Extract text content from output like CLI does
          let cleanOutput = msg.output || 'No output';
          if (typeof cleanOutput === 'object' && cleanOutput.type === 'text') {
            cleanOutput = cleanOutput.text;
          } else if (typeof cleanOutput === 'string') {
            try {
              const parsed = JSON.parse(cleanOutput);
              if (parsed.type === 'text' && parsed.text) {
                cleanOutput = parsed.text;
              }
            } catch {
              // Keep original string if not JSON
            }
          }
          content = cleanOutput;
        } else {
          messageType = 'system';
          sender = 'System';
          content = msg.content?.[0]?.text || msg.name || msg.id || '';
        }

        // Detect tool calls in assistant messages OR direct tool_call messages
        const isToolCall = (messageType === 'assistant' &&
          content &&
          /^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*.*\s*\)\s*$/.test(content.trim())) ||
          messageType === 'tool_call';

        // Debug logging for tool call detection
        if ((messageType === 'assistant' && content) || messageType === 'tool_call') {
          console.log('Checking message for tool call:', {
            content: content,
            isToolCall: isToolCall,
            messageType: messageType,
            rawMsg: msg
          });
        }

        // Create rawMessage for tool call approval
        let rawMessage = undefined;
        if (isToolCall) {
          // Extract tool name and arguments from content
          const toolCallMatch = content.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*)\s*\)\s*$/);
          if (toolCallMatch) {
            const toolName = toolCallMatch[1];
            const argsString = toolCallMatch[2];
            
            // Get task ID from the message data (like CLI does)
            const taskId = msg.taskId || msg.task_id || msg.task?.id;
            
            rawMessage = {
              name: toolName,
              arguments: argsString,
              callId: msg.id || `msg-${index}`,
              taskId: taskId
            };
          }
        } else if (messageType === 'tool_call') {
          // For function_call messages, extract tool call data
          const taskId = msg.taskId || msg.task_id || msg.task?.id;
          
          // Debug logging to see what fields are available
          console.log('Function call message fields:', {
            id: msg.id,
            name: msg.name,
            taskId: msg.taskId,
            task_id: msg.task_id,
            task: msg.task,
            allFields: Object.keys(msg)
          });
          
          rawMessage = {
            name: msg.name,
            arguments: JSON.stringify(msg.arguments || msg.parameters || {}),
            callId: msg.id || `msg-${index}`,
            taskId: taskId
          };
        }

        return {
          id: msg.id || `msg-${index}`,
          chatId: chatId,
          content: content,
          sender: sender,
          type: messageType,
          status: 'sent' as const,
          timestamp: new Date().toISOString(),
          isToolCall,
          rawMessage: rawMessage
        };
      });
    } catch (error) {
      console.error('Error extracting messages from context:', error);
      return [];
    }
  }

  async getById(id: string): Promise<Chat | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${getServerBaseUrl()}/chats/${id}`, { headers });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch chat: ${response.statusText}`);
      }
      const context = await response.json();
      
      // Extract messages from taskHistories to get real message data
      const allMessages: any[] = [];
      if (context.taskHistories && typeof context.taskHistories === 'object') {
        Object.values(context.taskHistories).forEach((taskHistory: any) => {
          if (Array.isArray(taskHistory)) {
            allMessages.push(...taskHistory);
          }
        });
      }
      
      // All items in taskHistories are messages (user messages, function calls, function results, assistant messages)
      const messageContent = allMessages.filter(msg => 
        msg && (msg.type === 'message' || msg.type === 'function_call' || msg.type === 'function_call_result')
      );
      
      // Get the last message content - prefer actual message content over function calls
      const lastMessage = messageContent.length > 0 
        ? (messageContent[messageContent.length - 1].content?.[0]?.text || 
           messageContent[messageContent.length - 1].name || 
           messageContent[messageContent.length - 1].id || 
           '')
        : '';

      // Map context to Chat format
      return {
        id: context.contextId || context.context_id || context.id,
        title: context.title || `Chat ${context.contextId || context.context_id || context.id}`,
        lastMessage: lastMessage,
        createdAt: context.createdAt || context.created_at || new Date().toISOString(),
        updatedAt: context.updatedAt || context.updated_at || new Date().toISOString(),
        messageCount: messageContent.length,
        status: context.status || 'active',
        participants: context.participants || [],
        agentId: context.agentId || context.agent_id || ''
      };
    } catch (error) {
      console.error('Error fetching chat:', error);
      throw error;
    }
  }

  async create(request: CreateChatRequest): Promise<Chat> {
    try {
      console.log('ChatsService: Creating chat with request:', request);
      
      // Create a context via direct Supabase call since the edge function doesn't support POST for contexts
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const contextId = crypto.randomUUID();
      const { data, error } = await supabase
        .from('contexts')
        .insert([{
          context_id: contextId,
          agent_id: request.agentId,
          user_id: user.id,
          task_histories: {},
          task_states: {},
          tasks: []
        }])
        .select()
        .single();

      if (error) throw error;

      // Return in Chat format
      const chat: Chat = {
        id: data.context_id,
        title: request.title,
        lastMessage: '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        messageCount: 0,
        status: request.status || 'active',
        participants: request.participants || [],
        agentId: request.agentId
      };

      console.log('ChatsService: Created chat:', chat);
      return chat;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  async update(id: string, request: UpdateChatRequest): Promise<Chat | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('contexts')
        .update({
          agent_id: request.agentId,
          updated_at: new Date().toISOString()
        })
        .eq('context_id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return null;

      // Return in Chat format
      return {
        id: data.context_id,
        title: request.title || `Chat ${data.context_id}`,
        lastMessage: '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        messageCount: 0,
        status: request.status || 'active',
        participants: request.participants || [],
        agentId: data.agent_id
      };
    } catch (error) {
      console.error('Error updating chat:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('contexts')
        .delete()
        .eq('context_id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }

  async deleteAll(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('contexts')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting all chats:', error);
      throw error;
    }
  }

  async getCount(): Promise<number> {
    try {
      const chats = await this.getAll();
      return chats.length;
    } catch (error) {
      console.error('Error getting chat count:', error);
      throw error;
    }
  }

  async search(query: string): Promise<Chat[]> {
    try {
      const allChats = await this.getAll();
      return allChats.filter(chat => 
        chat.title.toLowerCase().includes(query.toLowerCase()) ||
        chat.lastMessage?.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching chats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const chatsService = new ChatsService();
export default chatsService;