import { Tool, CreateToolRequest, UpdateToolRequest } from '@/types/tool';

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

export const toolsService = {
  async getAll(): Promise<Tool[]> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/tools`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`);
      }
      const serverTools = await response.json();
      
      // Return tools with only real data from server
      const tools: Tool[] = serverTools.map((serverTool: any) => ({
        id: serverTool.id,
        name: serverTool.name,
        description: serverTool.description,
        serverId: serverTool.serverId,
        serverName: serverTool.serverName,
        inputSchema: serverTool.inputSchema,
        category: serverTool.category,
        status: serverTool.status === 'available' ? 'available' : 'unavailable'
      }));
      
      return tools;
    } catch (error) {
      console.error('Error fetching tools:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Tool | undefined> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/tools/${id}`);
      if (response.status === 404) {
        return undefined;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch tool: ${response.statusText}`);
      }
      const serverTool = await response.json();
      return {
        id: serverTool.id,
        name: serverTool.name,
        description: serverTool.description,
        serverId: serverTool.serverId,
        serverName: serverTool.serverName,
        inputSchema: serverTool.inputSchema,
        category: serverTool.category,
        status: serverTool.status === 'available' ? 'available' : 'unavailable'
      };
    } catch (error) {
      console.error('Error fetching tool:', error);
      throw error;
    }
  },

  async create(toolData: CreateToolRequest): Promise<Tool> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toolData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create tool: ${response.statusText}`);
      }
      
      const tool = await response.json();
      return tool;
    } catch (error) {
      console.error('Error creating tool:', error);
      throw error;
    }
  },

  async update(id: string, updateData: UpdateToolRequest): Promise<Tool> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/tools/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update tool: ${response.statusText}`);
      }
      
      const tool = await response.json();
      return tool;
    } catch (error) {
      console.error('Error updating tool:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/tools/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete tool: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting tool:', error);
      throw error;
    }
  },

  async deleteAll(): Promise<void> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/tools`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete all tools: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting all tools:', error);
      throw error;
    }
  },

  async callTool(name: string, args: Record<string, any> = {}): Promise<string> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/tools/${name}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arguments: args }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to call tool: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.output || result.result || '';
    } catch (error) {
      console.error('Error calling tool:', error);
      throw error;
    }
  }
};