import { Tool, CreateToolRequest, UpdateToolRequest } from '@/types/tool';
import { supabase } from '@/integrations/supabase/client';

// Use environment-based URL for server functions
const getServerBaseUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ohzbghitbjryfpmucgju.supabase.co";
  return `${supabaseUrl}/functions/v1/server`;
};

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
  };
};

export const toolsService = {
  async getAll(): Promise<Tool[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${getServerBaseUrl()}/tools`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`);
      }
      const serverTools = await response.json();
      
      // Return tools with real data from server - server returns MCP tool format
      const tools: Tool[] = serverTools.map((serverTool: any) => ({
        id: serverTool.id,
        name: serverTool.name,
        description: serverTool.description || 'No description available',
        serverId: serverTool.serverId,
        serverName: serverTool.serverName || serverTool.category,
        inputSchema: serverTool.inputSchema,
        category: serverTool.category || serverTool.serverName,
        status: 'available' // Server only returns available tools
      }));
      
      return tools;
    } catch (error) {
      console.error('Error fetching tools:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Tool | undefined> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${getServerBaseUrl()}/tools/${id}`, { headers });
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
    // Note: Tools come from MCP servers, not created directly
    throw new Error('Tool creation not supported - tools come from MCP servers');
  },

  async update(id: string, updateData: UpdateToolRequest): Promise<Tool> {
    // Note: Tools come from MCP servers, not updated directly
    throw new Error('Tool update not supported - tools come from MCP servers');
  },

  async delete(id: string): Promise<void> {
    // Note: Tools come from MCP servers, not deleted directly
    throw new Error('Tool deletion not supported - tools come from MCP servers');
  },

  async deleteAll(): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${getServerBaseUrl()}/tools`, {
        method: 'DELETE',
        headers,
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
      const headers = await getAuthHeaders();
      const response = await fetch(`${getServerBaseUrl()}/tools/${name}/call`, {
        method: 'POST',
        headers,
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