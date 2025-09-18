export interface ApiKey {
  id: string;
  name: string;
  provider: string;
  key_encrypted: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

class ApiKeysService {
  private mockApiKeys: ApiKey[] = [
    {
      id: '1',
      name: 'OpenAI Production',
      provider: 'OpenAI',
      key_encrypted: 'encrypted_key_data_1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'user_1'
    },
    {
      id: '2',
      name: 'Anthropic Claude',
      provider: 'Anthropic',
      key_encrypted: 'encrypted_key_data_2',
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      user_id: 'user_1'
    },
    {
      id: '3',
      name: 'Google Gemini',
      provider: 'Google',
      key_encrypted: 'encrypted_key_data_3',
      created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      updated_at: new Date(Date.now() - 172800000).toISOString(),
      user_id: 'user_1'
    }
  ];

  async getAll(): Promise<ApiKey[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...this.mockApiKeys];
  }

  async getById(id: string): Promise<ApiKey | null> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return this.mockApiKeys.find(key => key.id === id) || null;
  }

  async create(apiKeyData: Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>): Promise<ApiKey> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newApiKey: ApiKey = {
      ...apiKeyData,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.mockApiKeys.push(newApiKey);
    return newApiKey;
  }

  async update(id: string, updates: Partial<Omit<ApiKey, 'id' | 'created_at'>>): Promise<ApiKey | null> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = this.mockApiKeys.findIndex(key => key.id === id);
    if (index === -1) return null;
    
    this.mockApiKeys[index] = {
      ...this.mockApiKeys[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return this.mockApiKeys[index];
  }

  async delete(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = this.mockApiKeys.findIndex(key => key.id === id);
    if (index === -1) return false;
    
    this.mockApiKeys.splice(index, 1);
    return true;
  }

  async deleteAll(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.mockApiKeys.length = 0;
  }
}

export const apiKeysService = new ApiKeysService();