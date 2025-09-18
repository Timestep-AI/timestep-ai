export interface ModelProvider {
  id: string;
  provider: string;
  base_url: string;
  models_url: string;
  api_key?: string;
  created_at: string;
  updated_at: string;
}

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

class ModelProvidersService {
  async getAll(): Promise<ModelProvider[]> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/model_providers`);
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
      const response = await fetch(`${SERVER_BASE_URL}/model_providers/${id}`);
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
      const response = await fetch(`${SERVER_BASE_URL}/model_providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  async update(id: string, updates: Partial<Omit<ModelProvider, 'id' | 'created_at'>>): Promise<ModelProvider | null> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/model_providers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${SERVER_BASE_URL}/model_providers/${id}`, {
        method: 'DELETE',
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
      const response = await fetch(`${SERVER_BASE_URL}/model_providers`, {
        method: 'DELETE',
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