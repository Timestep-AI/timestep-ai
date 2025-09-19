import { MCPServer } from '@/types/mcpServer';

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

class MCPServersService {
  async getAll(): Promise<MCPServer[]> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/mcp_servers`);
      if (!response.ok) {
        throw new Error(`Failed to fetch MCP servers: ${response.statusText}`);
      }
      const servers = await response.json();
      return servers;
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<MCPServer | null> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/mcp_servers/${id}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch MCP server: ${response.statusText}`);
      }
      const server = await response.json();
      return server;
    } catch (error) {
      console.error('Error fetching MCP server:', error);
      throw error;
    }
  }

  async create(serverData: Omit<MCPServer, 'id' | 'createdAt' | 'updatedAt'>): Promise<MCPServer> {
    // Note: Server doesn't support MCP server creation yet  
    throw new Error('MCP server creation not implemented in server');
  }

  async update(id: string, updates: Partial<MCPServer>): Promise<MCPServer | null> {
    try {
      // Map the updates to the expected API format
      const payload = {
        name: updates.name,
        description: updates.description,
        serverUrl: updates.serverUrl,
        enabled: updates.enabled,
        authToken: updates.authToken,
      };
      
      const response = await fetch(`${SERVER_BASE_URL}/mcp_servers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to update MCP server: ${response.statusText}`);
      }
      
      const server = await response.json();
      return server;
    } catch (error) {
      console.error('Error updating MCP server:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    // Note: Server doesn't support MCP server deletion yet
    throw new Error('MCP server deletion not implemented in server');
  }

  async deleteAll(): Promise<void> {
    // Note: Server doesn't support batch MCP server deletion yet
    throw new Error('MCP server batch deletion not implemented in server');
  }
}

export const mcpServersService = new MCPServersService();