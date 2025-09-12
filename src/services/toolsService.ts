import { Tool, CreateToolRequest, UpdateToolRequest } from '@/types/tool';
import { mcpClient } from './mcpClient';

export const toolsService = {
  async getAll(): Promise<Tool[]> {
    return await mcpClient.listTools();
  },

  async getById(id: string): Promise<Tool | undefined> {
    return await mcpClient.getTool(id);
  },

  async create(toolData: CreateToolRequest): Promise<Tool> {
    return await mcpClient.createTool(toolData);
  },

  async update(id: string, updateData: UpdateToolRequest): Promise<Tool> {
    return await mcpClient.updateTool(id, updateData);
  },

  async delete(id: string): Promise<void> {
    return await mcpClient.deleteTool(id);
  },

  async deleteAll(): Promise<void> {
    return await mcpClient.deleteAllTools();
  },

  async createDefaults(): Promise<Tool[]> {
    return await mcpClient.createDefaultTools();
  },

  // Additional MCP-specific method to call tools
  async callTool(name: string, args: Record<string, any> = {}): Promise<string> {
    return await mcpClient.callTool(name, args);
  }
};