export interface ModelProvider {
  id: string;
  provider: string;
  base_url: string;
  models_url: string;
  api_key?: string;
  created_at: string;
  updated_at: string;
}

class ModelProvidersService {
  private mockProviders: ModelProvider[] = [
    {
      id: '1',
      provider: 'OpenAI',
      base_url: 'https://api.openai.com/v1',
      models_url: 'https://api.openai.com/v1/models',
      api_key: 'configured',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '2',
      provider: 'Anthropic',
      base_url: 'https://api.anthropic.com/v1',
      models_url: 'https://api.anthropic.com/v1/models',
      api_key: 'configured',
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '3',
      provider: 'Google',
      base_url: 'https://generativelanguage.googleapis.com/v1',
      models_url: 'https://generativelanguage.googleapis.com/v1/models',
      created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      updated_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: '4',
      provider: 'Local Ollama',
      base_url: 'http://localhost:11434/v1',
      models_url: 'http://localhost:11434/v1/models',
      created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
      updated_at: new Date(Date.now() - 259200000).toISOString(),
    }
  ];

  async getAll(): Promise<ModelProvider[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...this.mockProviders];
  }

  async getById(id: string): Promise<ModelProvider | null> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return this.mockProviders.find(provider => provider.id === id) || null;
  }

  async create(providerData: Omit<ModelProvider, 'id' | 'created_at' | 'updated_at'>): Promise<ModelProvider> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newProvider: ModelProvider = {
      ...providerData,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.mockProviders.push(newProvider);
    return newProvider;
  }

  async update(id: string, updates: Partial<Omit<ModelProvider, 'id' | 'created_at'>>): Promise<ModelProvider | null> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = this.mockProviders.findIndex(provider => provider.id === id);
    if (index === -1) return null;
    
    this.mockProviders[index] = {
      ...this.mockProviders[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return this.mockProviders[index];
  }

  async delete(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = this.mockProviders.findIndex(provider => provider.id === id);
    if (index === -1) return false;
    
    this.mockProviders.splice(index, 1);
    return true;
  }

  async deleteAll(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.mockProviders.length = 0;
  }
}

export const modelProvidersService = new ModelProvidersService();