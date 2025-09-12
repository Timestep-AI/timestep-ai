import { Tool, CreateToolRequest, UpdateToolRequest } from '@/types/tool';

// Mock data for tools
const mockTools: Tool[] = [
  {
    id: '1',
    name: 'Code Formatter',
    description: 'Automatically format and beautify your code across multiple languages',
    category: 'development',
    version: '2.1.3',
    isEnabled: true,
    permissions: ['read', 'write'],
    status: 'active',
    lastUsed: '2024-01-10T14:30:00Z',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-10T14:30:00Z',
    usage: {
      daily: 15,
      weekly: 89,
      monthly: 340
    }
  },
  {
    id: '2',
    name: 'API Documentation Generator',
    description: 'Generate comprehensive API documentation from your code annotations',
    category: 'development',
    version: '1.8.2',
    isEnabled: true,
    permissions: ['read'],
    status: 'active',
    lastUsed: '2024-01-09T09:15:00Z',
    createdAt: '2024-01-02T11:00:00Z',
    updatedAt: '2024-01-09T09:15:00Z',
    usage: {
      daily: 8,
      weekly: 45,
      monthly: 178
    }
  },
  {
    id: '3',
    name: 'Task Scheduler',
    description: 'Schedule and automate recurring tasks with intelligent reminders',
    category: 'productivity',
    version: '3.0.1',
    isEnabled: false,
    permissions: ['read', 'write', 'execute'],
    status: 'maintenance',
    lastUsed: '2024-01-05T16:45:00Z',
    createdAt: '2023-12-15T08:00:00Z',
    updatedAt: '2024-01-08T12:00:00Z',
    usage: {
      daily: 3,
      weekly: 12,
      monthly: 67
    }
  },
  {
    id: '4',
    name: 'Data Analytics Dashboard',
    description: 'Visualize and analyze your application data with interactive charts',
    category: 'analysis',
    version: '1.5.7',
    isEnabled: true,
    permissions: ['read'],
    status: 'active',
    lastUsed: '2024-01-11T11:20:00Z',
    createdAt: '2024-01-03T14:00:00Z',
    updatedAt: '2024-01-11T11:20:00Z',
    usage: {
      daily: 22,
      weekly: 134,
      monthly: 521
    }
  },
  {
    id: '5',
    name: 'Team Collaboration Hub',
    description: 'Centralized communication and project management for development teams',
    category: 'communication',
    version: '2.3.0',
    isEnabled: true,
    permissions: ['read', 'write', 'admin'],
    status: 'active',
    lastUsed: '2024-01-11T15:30:00Z',
    createdAt: '2023-11-20T09:00:00Z',
    updatedAt: '2024-01-11T15:30:00Z',
    usage: {
      daily: 45,
      weekly: 289,
      monthly: 1205
    }
  },
  {
    id: '6',
    name: 'Automated Testing Suite',
    description: 'Comprehensive testing framework with CI/CD integration',
    category: 'automation',
    version: '4.2.1',
    isEnabled: true,
    permissions: ['read', 'write', 'execute'],
    status: 'active',
    createdAt: '2023-10-10T10:00:00Z',
    updatedAt: '2024-01-07T08:15:00Z',
    usage: {
      daily: 18,
      weekly: 95,
      monthly: 412
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
        name: 'Code Formatter',
        description: 'Automatically format and beautify your code across multiple languages',
        category: 'development' as const,
        version: '2.1.3',
        isEnabled: true,
        permissions: ['read', 'write'],
        status: 'active' as const,
        lastUsed: '2024-01-10T14:30:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-10T14:30:00Z',
        usage: {
          daily: 15,
          weekly: 89,
          monthly: 340
        }
      },
      {
        id: '2',
        name: 'API Documentation Generator',
        description: 'Generate comprehensive API documentation from your code annotations',
        category: 'development' as const,
        version: '1.8.2',
        isEnabled: true,
        permissions: ['read'],
        status: 'active' as const,
        lastUsed: '2024-01-09T09:15:00Z',
        createdAt: '2024-01-02T11:00:00Z',
        updatedAt: '2024-01-09T09:15:00Z',
        usage: {
          daily: 8,
          weekly: 45,
          monthly: 178
        }
      }
    ]);
    return mockTools;
  }
};