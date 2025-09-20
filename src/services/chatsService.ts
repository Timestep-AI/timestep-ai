import { Chat, CreateChatRequest, UpdateChatRequest } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
  };
};

class ChatsService {
  async getAll(): Promise<Chat[]> {
    try {
      console.log('ChatsService: Fetching chats from', `${SERVER_BASE_URL}/chats`);
      const headers = await getAuthHeaders();
      console.log('ChatsService: Auth headers:', headers);
      const response = await fetch(`${SERVER_BASE_URL}/chats`, { headers });
      console.log('ChatsService: Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Failed to fetch chats: ${response.statusText}`);
      }
      const result = await response.json();
      console.log('ChatsService: Raw response:', result);
      
      // The /chats endpoint returns contexts, so we need to map them to Chat format
      const chats = (Array.isArray(result) ? result : []).map((context: any) => ({
        id: context.contextId || context.id,
        title: `Chat ${context.contextId || context.id}`,
        lastMessage: '',
        createdAt: context.createdAt || new Date().toISOString(),
        updatedAt: context.updatedAt || new Date().toISOString(),
        messageCount: 0,
        status: 'active' as const,
        participants: [],
        agentId: context.agentId || ''
      }));
      
      console.log('ChatsService: Processed chats:', chats);
      return chats;
    } catch (error) {
      console.error('Error fetching chats:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Chat | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/chats/${id}`, { headers });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch chat: ${response.statusText}`);
      }
      const context = await response.json();
      
      // Map context to Chat format
      return {
        id: context.contextId || context.id,
        title: `Chat ${context.contextId || context.id}`,
        lastMessage: '',
        createdAt: context.createdAt || new Date().toISOString(),
        updatedAt: context.updatedAt || new Date().toISOString(),
        messageCount: 0,
        status: 'active' as const,
        participants: [],
        agentId: context.agentId || ''
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