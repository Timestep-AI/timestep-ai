import { Model, CreateModelRequest, UpdateModelRequest } from '@/types/model';
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

class ModelsService {
  async getAll(): Promise<Model[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/models`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const apiModels = await response.json();
      
      // If empty array, return empty array
      if (!Array.isArray(apiModels) || apiModels.length === 0) {
        return [];
      }
      
      // Return models exactly as server provides them (OpenAI format)
      const models: Model[] = apiModels.map((apiModel: any) => ({
        id: apiModel.id,
        created: apiModel.created,
        object: apiModel.object,
        owned_by: apiModel.owned_by
      }));
      
      return models;
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Model | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/models/${id}`, { headers });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`);
      }
      const model = await response.json();
      return model;
    } catch (error) {
      console.error('Error fetching model:', error);
      throw error;
    }
  }

  async create(request: CreateModelRequest): Promise<Model> {
    // Note: Models come from model providers, not created directly
    throw new Error('Model creation not supported - models come from model providers');
  }

  async update(id: string, request: UpdateModelRequest): Promise<Model | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/models/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(request),
      });
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to update model: ${response.statusText}`);
      }
      
      const model = await response.json();
      return model;
    } catch (error) {
      console.error('Error updating model:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/models/${id}`, {
        method: 'DELETE',
        headers,
      });
      
      if (response.status === 404) {
        return false;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting model:', error);
      throw error;
    }
  }

  async deleteAll(): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/models`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete all models: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting all models:', error);
      throw error;
    }
  }

  async getCount(): Promise<number> {
    try {
      const models = await this.getAll();
      return models.length;
    } catch (error) {
      console.error('Error getting model count:', error);
      throw error;
    }
  }

  async search(query: string): Promise<Model[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/models/search?q=${encodeURIComponent(query)}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to search models: ${response.statusText}`);
      }
      
      const models = await response.json();
      return models;
    } catch (error) {
      console.error('Error searching models:', error);
      throw error;
    }
  }

  async getByProvider(provider: string): Promise<Model[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/models/provider/${encodeURIComponent(provider)}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to get models by provider: ${response.statusText}`);
      }
      
      const models = await response.json();
      return models;
    } catch (error) {
      console.error('Error getting models by provider:', error);
      throw error;
    }
  }

  async getByStatus(status: 'active' | 'deprecated' | 'beta'): Promise<Model[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/models/status/${encodeURIComponent(status)}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to get models by status: ${response.statusText}`);
      }
      
      const models = await response.json();
      return models;
    } catch (error) {
      console.error('Error getting models by status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const modelsService = new ModelsService();
export default modelsService;