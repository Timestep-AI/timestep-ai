import { Model, CreateModelRequest, UpdateModelRequest } from '@/types/model';

// Immutable default models - these never change
const DEFAULT_MODELS: Readonly<Model[]> = [
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'Latest GPT-4 Turbo with improved instruction following, JSON mode, and function calling.',
    provider: 'OpenAI',
    version: '1106-preview',
    contextLength: 128000,
    inputPrice: 10.0,
    outputPrice: 30.0,
    capabilities: ['text', 'function-calling', 'json-mode', 'vision'],
    status: 'active',
    createdAt: '2023-11-06T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'High-intelligence flagship model for complex, multi-step tasks.',
    provider: 'OpenAI',
    version: '0613',
    contextLength: 8192,
    inputPrice: 30.0,
    outputPrice: 60.0,
    capabilities: ['text', 'function-calling'],
    status: 'active',
    createdAt: '2023-03-14T00:00:00Z',
    updatedAt: '2023-06-13T00:00:00Z',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast, inexpensive model for simple tasks.',
    provider: 'OpenAI',
    version: '1106',
    contextLength: 16385,
    inputPrice: 1.0,
    outputPrice: 2.0,
    capabilities: ['text', 'function-calling', 'json-mode'],
    status: 'active',
    createdAt: '2023-03-01T00:00:00Z',
    updatedAt: '2023-11-06T00:00:00Z',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'Most powerful model for highly complex tasks, superior performance on reasoning, math, and coding.',
    provider: 'Anthropic',
    version: '20240229',
    contextLength: 200000,
    inputPrice: 15.0,
    outputPrice: 75.0,
    capabilities: ['text', 'vision', 'reasoning'],
    status: 'active',
    createdAt: '2024-02-29T00:00:00Z',
    updatedAt: '2024-02-29T00:00:00Z',
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    description: 'Balance of intelligence and speed for enterprise workloads.',
    provider: 'Anthropic',
    version: '20240229',
    contextLength: 200000,
    inputPrice: 3.0,
    outputPrice: 15.0,
    capabilities: ['text', 'vision', 'reasoning'],
    status: 'active',
    createdAt: '2024-02-29T00:00:00Z',
    updatedAt: '2024-02-29T00:00:00Z',
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Fastest and most compact model for near-instant responsiveness.',
    provider: 'Anthropic',
    version: '20240307',
    contextLength: 200000,
    inputPrice: 0.25,
    outputPrice: 1.25,
    capabilities: ['text', 'vision'],
    status: 'active',
    createdAt: '2024-03-07T00:00:00Z',
    updatedAt: '2024-03-07T00:00:00Z',
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    description: 'Google\'s most capable AI model, built for multimodal reasoning.',
    provider: 'Google',
    version: '1.0',
    contextLength: 32768,
    inputPrice: 2.5,
    outputPrice: 7.5,
    capabilities: ['text', 'vision', 'reasoning'],
    status: 'active',
    createdAt: '2023-12-13T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
  {
    id: 'llama-2-70b',
    name: 'Llama 2 70B',
    description: 'Meta\'s open-source large language model for dialogue use cases.',
    provider: 'Meta',
    version: '2.0',
    contextLength: 4096,
    inputPrice: 0.7,
    outputPrice: 0.8,
    capabilities: ['text', 'chat'],
    status: 'active',
    createdAt: '2023-07-18T00:00:00Z',
    updatedAt: '2023-07-18T00:00:00Z',
  },
  {
    id: 'gpt-3',
    name: 'GPT-3',
    description: 'Legacy OpenAI model, deprecated in favor of GPT-3.5 and GPT-4.',
    provider: 'OpenAI',
    version: 'davinci-003',
    contextLength: 4097,
    inputPrice: 20.0,
    outputPrice: 20.0,
    capabilities: ['text'],
    status: 'deprecated',
    createdAt: '2020-06-11T00:00:00Z',
    updatedAt: '2022-11-28T00:00:00Z',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Preview of next-generation Claude model with enhanced capabilities.',
    provider: 'Anthropic',
    version: '20240620',
    contextLength: 200000,
    inputPrice: 3.0,
    outputPrice: 15.0,
    capabilities: ['text', 'vision', 'reasoning', 'coding'],
    status: 'beta',
    createdAt: '2024-06-20T00:00:00Z',
    updatedAt: '2024-06-20T00:00:00Z',
  },
] as const;

class ModelsService {
  private models: Model[] = [];
  private nextId = 5000; // Start custom IDs from 5000 to avoid conflicts

  constructor() {
    // Initialize with default models
    this.createDefaults();
  }

  /**
   * Get all models
   */
  async getAll(): Promise<Model[]> {
    // Simulate API delay
    await this.delay(100);
    return [...this.models]; // Return a copy
  }

  /**
   * Get model by ID
   */
  async getById(id: string): Promise<Model | null> {
    await this.delay(50);
    const model = this.models.find(m => m.id === id);
    return model ? { ...model } : null; // Return a copy
  }

  /**
   * Create a new model
   */
  async create(request: CreateModelRequest): Promise<Model> {
    await this.delay(200);
    
    const now = new Date().toISOString();
    const newModel: Model = {
      id: `model-${this.nextId++}`,
      name: request.name,
      description: request.description,
      provider: request.provider,
      version: request.version,
      contextLength: request.contextLength,
      inputPrice: request.inputPrice,
      outputPrice: request.outputPrice,
      capabilities: request.capabilities || [],
      status: request.status || 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.models.push(newModel);
    return { ...newModel }; // Return a copy
  }

  /**
   * Update an existing model
   */
  async update(id: string, request: UpdateModelRequest): Promise<Model | null> {
    await this.delay(200);
    
    const index = this.models.findIndex(m => m.id === id);
    if (index === -1) return null;

    const updatedModel: Model = {
      ...this.models[index],
      ...request,
      updatedAt: new Date().toISOString(),
    };

    this.models[index] = updatedModel;
    return { ...updatedModel }; // Return a copy
  }

  /**
   * Delete a model by ID
   */
  async delete(id: string): Promise<boolean> {
    await this.delay(150);
    
    const index = this.models.findIndex(m => m.id === id);
    if (index === -1) return false;

    this.models.splice(index, 1);
    return true;
  }

  /**
   * Delete all models
   */
  async deleteAll(): Promise<void> {
    await this.delay(100);
    this.models = [];
  }

  /**
   * Create default models (clone from immutable defaults)
   */
  async createDefaults(): Promise<Model[]> {
    await this.delay(300);
    
    // Clone default models with new IDs to avoid conflicts
    const clonedDefaults: Model[] = DEFAULT_MODELS.map((defaultModel, index) => ({
      ...defaultModel,
      id: `cloned-model-${Date.now()}-${index}`, // Generate unique IDs
      createdAt: new Date().toISOString(), // Update creation time
      updatedAt: new Date().toISOString(), // Update modification time
    }));

    this.models = [...clonedDefaults];
    return [...this.models]; // Return a copy
  }

  /**
   * Get count of models
   */
  async getCount(): Promise<number> {
    await this.delay(50);
    return this.models.length;
  }

  /**
   * Search models by name, provider, or capabilities
   */
  async search(query: string): Promise<Model[]> {
    await this.delay(100);
    
    if (!query.trim()) return [...this.models];
    
    const lowercaseQuery = query.toLowerCase();
    const filtered = this.models.filter(model => 
      model.name.toLowerCase().includes(lowercaseQuery) ||
      model.provider.toLowerCase().includes(lowercaseQuery) ||
      model.capabilities.some(cap => cap.toLowerCase().includes(lowercaseQuery)) ||
      model.description?.toLowerCase().includes(lowercaseQuery)
    );
    
    return filtered.map(model => ({ ...model })); // Return copies
  }

  /**
   * Get models by provider
   */
  async getByProvider(provider: string): Promise<Model[]> {
    await this.delay(100);
    
    const filtered = this.models.filter(model => 
      model.provider.toLowerCase() === provider.toLowerCase()
    );
    
    return filtered.map(model => ({ ...model })); // Return copies
  }

  /**
   * Get models by status
   */
  async getByStatus(status: 'active' | 'deprecated' | 'beta'): Promise<Model[]> {
    await this.delay(100);
    
    const filtered = this.models.filter(model => model.status === status);
    
    return filtered.map(model => ({ ...model })); // Return copies
  }

  /**
   * Simulate API delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const modelsService = new ModelsService();
export default modelsService;