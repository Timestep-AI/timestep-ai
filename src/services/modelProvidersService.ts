export interface ModelProvider {
  id: string; // UUID in database but string in API
  provider: string;
  baseUrl: string;
  modelsUrl: string;
  apiKey?: string;
  isActive?: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

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

class ModelProvidersService {
  async getAll(): Promise<ModelProvider[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/model_providers`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch model providers: ${response.statusText}`);
      }
      const providers = await response.json();
      return providers;
    } catch (error) {
      console.error('Error fetching model providers:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<ModelProvider | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/model_providers/${id}`, { headers });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch model provider: ${response.statusText}`);
      }
      const provider = await response.json();
      console.log('Raw provider response:', provider);
      return provider;
    } catch (error) {
      console.error('Error fetching model provider:', error);
      throw error;
    }
  }

  async create(providerData: Omit<ModelProvider, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModelProvider> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/model_providers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(providerData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create model provider: ${response.statusText}`);
      }
      
      const provider = await response.json();
      return provider;
    } catch (error) {
      console.error('Error creating model provider:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Omit<ModelProvider, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ModelProvider | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/model_providers/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to update model provider: ${response.statusText}`);
      }
      
      const provider = await response.json();
      return provider;
    } catch (error) {
      console.error('Error updating model provider:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/model_providers/${id}`, {
        method: 'DELETE',
        headers,
      });
      
      if (response.status === 404) {
        return false;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to delete model provider: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting model provider:', error);
      throw error;
    }
  }

  async deleteAll(): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/model_providers`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete all model providers: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting all model providers:', error);
      throw error;
    }
  }
}

export const modelProvidersService = new ModelProvidersService();