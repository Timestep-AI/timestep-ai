import { Tool, CreateToolRequest, UpdateToolRequest } from '@/types/tool';

// Mock data for tools
const mockTools: Tool[] = [
  {
    id: '1',
    name: 'get_emails',
    description: 'Retrieve and manage email messages from various email accounts',
    category: 'communication',
    version: '1.0.0',
    isEnabled: true,
    permissions: ['read'],
    status: 'active',
    lastUsed: '2024-01-10T14:30:00Z',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-10T14:30:00Z',
    usage: {
      daily: 25,
      weekly: 150,
      monthly: 620
    }
  },
  {
    id: '2',
    name: 'get_weather',
    description: 'Get current weather conditions and forecasts for any location',
    category: 'productivity',
    version: '1.0.0',
    isEnabled: true,
    permissions: ['read'],
    status: 'active',
    lastUsed: '2024-01-11T09:15:00Z',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-11T09:15:00Z',
    usage: {
      daily: 12,
      weekly: 78,
      monthly: 305
    }
  },
  {
    id: '3',
    name: 'think',
    description: 'Process information and provide thoughtful analysis and reasoning',
    category: 'analysis',
    version: '1.0.0',
    isEnabled: true,
    permissions: ['read', 'write'],
    status: 'active',
    lastUsed: '2024-01-11T16:45:00Z',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-11T16:45:00Z',
    usage: {
      daily: 45,
      weekly: 280,
      monthly: 1150
    }
  }
];

export const toolsService = {
  async getAll(): Promise<Tool[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockTools;
  },

  async getById(id: string): Promise<Tool | undefined> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockTools.find(tool => tool.id === id);
  },

  async create(toolData: CreateToolRequest): Promise<Tool> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newTool: Tool = {
      id: (mockTools.length + 1).toString(),
      ...toolData,
      isEnabled: toolData.isEnabled ?? true,
      permissions: toolData.permissions ?? ['read'],
      status: toolData.status ?? 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usage: {
        daily: 0,
        weekly: 0,
        monthly: 0
      }
    };
    mockTools.push(newTool);
    return newTool;
  },

  async update(id: string, updateData: UpdateToolRequest): Promise<Tool> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const toolIndex = mockTools.findIndex(tool => tool.id === id);
    if (toolIndex === -1) {
      throw new Error(`Tool with id ${id} not found`);
    }
    
    const updatedTool = {
      ...mockTools[toolIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    mockTools[toolIndex] = updatedTool;
    return updatedTool;
  },

  async delete(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const toolIndex = mockTools.findIndex(tool => tool.id === id);
    if (toolIndex === -1) {
      throw new Error(`Tool with id ${id} not found`);
    }
    mockTools.splice(toolIndex, 1);
  },

  async deleteAll(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    mockTools.splice(0, mockTools.length);
  },

  async createDefaults(): Promise<Tool[]> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Reset to default tools
    mockTools.splice(0, mockTools.length);
    mockTools.push(...[
      {
        id: '1',
        name: 'get_emails',
        description: 'Retrieve and manage email messages from various email accounts',
        category: 'communication' as const,
        version: '1.0.0',
        isEnabled: true,
        permissions: ['read'],
        status: 'active' as const,
        lastUsed: '2024-01-10T14:30:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-10T14:30:00Z',
        usage: {
          daily: 25,
          weekly: 150,
          monthly: 620
        }
      },
      {
        id: '2',
        name: 'get_weather',
        description: 'Get current weather conditions and forecasts for any location',
        category: 'productivity' as const,
        version: '1.0.0',
        isEnabled: true,
        permissions: ['read'],
        status: 'active' as const,
        lastUsed: '2024-01-11T09:15:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-11T09:15:00Z',
        usage: {
          daily: 12,
          weekly: 78,
          monthly: 305
        }
      },
      {
        id: '3',
        name: 'think',
        description: 'Process information and provide thoughtful analysis and reasoning',
        category: 'analysis' as const,
        version: '1.0.0',
        isEnabled: true,
        permissions: ['read', 'write'],
        status: 'active' as const,
        lastUsed: '2024-01-11T16:45:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-11T16:45:00Z',
        usage: {
          daily: 45,
          weekly: 280,
          monthly: 1150
        }
      }
    ]);
    return mockTools;
  }
};