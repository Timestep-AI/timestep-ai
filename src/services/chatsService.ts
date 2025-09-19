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
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/chats`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch chats: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data || [];
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
      const chat = await response.json();
      return chat;
    } catch (error) {
      console.error('Error fetching chat:', error);
      throw error;
    }
  }

  async create(request: CreateChatRequest): Promise<Chat> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/chats`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create chat: ${response.statusText}`);
      }
      
      const chat = await response.json();
      return chat;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  async update(id: string, request: UpdateChatRequest): Promise<Chat | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/chats/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(request),
      });
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to update chat: ${response.statusText}`);
      }
      
      const chat = await response.json();
      return chat;
    } catch (error) {
      console.error('Error updating chat:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/chats/${id}`, {
        method: 'DELETE',
        headers,
      });
      
      if (response.status === 404) {
        return false;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to delete chat: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }

  async deleteAll(): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/chats`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete all chats: ${response.statusText}`);
      }
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
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/chats/search?q=${encodeURIComponent(query)}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to search chats: ${response.statusText}`);
      }
      
      const chats = await response.json();
      return chats;
    } catch (error) {
      console.error('Error searching chats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const chatsService = new ChatsService();
export default chatsService;