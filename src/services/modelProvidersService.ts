export interface ModelProvider {
  id: string; // UUID in database but string in API
  provider: string;
  base_url: string;
  models_url: string;
  api_key?: string;
  is_active?: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
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
      return provider;
    } catch (error) {
      console.error('Error fetching model provider:', error);
      throw error;
    }
  }

  async create(providerData: Omit<ModelProvider, 'id' | 'created_at' | 'updated_at'>): Promise<ModelProvider> {
    try {
      // Map snake_case interface to camelCase API format
      const payload = {
        provider: providerData.provider,
        baseUrl: providerData.base_url,
        modelsUrl: providerData.models_url,
        apiKey: providerData.api_key,
        isActive: providerData.is_active,
        description: providerData.description,
      };
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/model_providers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
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

  async update(id: string, updates: Partial<Omit<ModelProvider, 'id' | 'created_at' | 'updated_at'>>): Promise<ModelProvider | null> {
    try {
      // Map snake_case interface to camelCase API format
      const payload = {
        provider: updates.provider,
        baseUrl: updates.base_url,
        modelsUrl: updates.models_url,
        apiKey: updates.api_key,
        isActive: updates.is_active,
        description: updates.description,
      };
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/model_providers/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
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