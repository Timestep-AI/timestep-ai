import { Model, CreateModelRequest, UpdateModelRequest } from '@/types/model';

// Immutable default models - these never change
const DEFAULT_MODELS: Readonly<Model[]> = [
  {
    id: 'ollama-gpt-oss-20b',
    name: 'ollama/gpt-oss:20b',
    description: 'Open-source large language model optimized for general-purpose tasks with 20B parameters.',
    provider: 'Ollama',
    version: '20b',
    contextLength: 32768,
    inputPrice: 0.0,
    outputPrice: 0.0,
    capabilities: ['text', 'reasoning', 'coding'],
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
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
    
    // Clone default models keeping original IDs for consistent navigation
    const clonedDefaults: Model[] = DEFAULT_MODELS.map((defaultModel) => ({
      ...defaultModel,
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