import { Model, CreateModelRequest, UpdateModelRequest } from '@/types/model';

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

class ModelsService {
  async getAll(): Promise<Model[]> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/models`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const apiModels = await response.json();
      
      // If empty array, return empty array
      if (!Array.isArray(apiModels) || apiModels.length === 0) {
        return [];
      }
      
      // Map API response to our Model interface since server returns OpenAI format
      const models: Model[] = apiModels.map((apiModel: any) => ({
        id: apiModel.id,
        name: apiModel.id,
        description: `Model provided by ${apiModel.owned_by}`,
        provider: apiModel.owned_by || 'unknown',
        version: '1.0.0',
        contextLength: 0, // Not provided by OpenAI format
        inputPrice: 0, // Not provided by OpenAI format
        outputPrice: 0, // Not provided by OpenAI format  
        capabilities: [], // Not provided by OpenAI format
        status: 'active' as const,
        createdAt: new Date(apiModel.created * 1000).toISOString(),
        updatedAt: new Date(apiModel.created * 1000).toISOString()
      }));
      
      return models;
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Model | null> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/models/${id}`);
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
      const response = await fetch(`${SERVER_BASE_URL}/models/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${SERVER_BASE_URL}/models/${id}`, {
        method: 'DELETE',
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
      const response = await fetch(`${SERVER_BASE_URL}/models`, {
        method: 'DELETE',
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
      const response = await fetch(`${SERVER_BASE_URL}/models/search?q=${encodeURIComponent(query)}`);
      
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
      const response = await fetch(`${SERVER_BASE_URL}/models/provider/${encodeURIComponent(provider)}`);
      
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
      const response = await fetch(`${SERVER_BASE_URL}/models/status/${encodeURIComponent(status)}`);
      
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