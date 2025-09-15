import { Model, CreateModelRequest, UpdateModelRequest } from '@/types/model';

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1';

class ModelsService {
  async getAll(): Promise<Model[]> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/server/models`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const models = await response.json();
      return models;
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Model | null> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/server/models/${id}`);
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
    try {
      const response = await fetch(`${SERVER_BASE_URL}/server/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create model: ${response.statusText}`);
      }
      
      const model = await response.json();
      return model;
    } catch (error) {
      console.error('Error creating model:', error);
      throw error;
    }
  }

  async update(id: string, request: UpdateModelRequest): Promise<Model | null> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/server/models/${id}`, {
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
      const response = await fetch(`${SERVER_BASE_URL}/server/models/${id}`, {
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
      const response = await fetch(`${SERVER_BASE_URL}/server/models`, {
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
      const response = await fetch(`${SERVER_BASE_URL}/server/models/search?q=${encodeURIComponent(query)}`);
      
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
      const response = await fetch(`${SERVER_BASE_URL}/server/models/provider/${encodeURIComponent(provider)}`);
      
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
      const response = await fetch(`${SERVER_BASE_URL}/server/models/status/${encodeURIComponent(status)}`);
      
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