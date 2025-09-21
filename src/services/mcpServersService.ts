import { MCPServer } from '@/types/mcpServer';
import { supabase } from '@/integrations/supabase/client';

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No valid session found. Please sign in.');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
};

class MCPServersService {
  async getAll(): Promise<MCPServer[]> {
    try {
      const headers = await getAuthHeaders();
      // Add cache-busting parameter to ensure we get fresh data
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(`${SERVER_BASE_URL}/mcp_servers${cacheBuster}`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch MCP servers: ${response.statusText}`);
      }
      const servers = await response.json();
      console.log('MCPServersService: getAll raw response:', servers);
      
      // Debug: Log the specific server we're interested in
      const rubeServer = servers.find((s: any) => s.id === '11111111-1111-1111-1111-111111111111');
      if (rubeServer) {
        console.log('MCPServersService: getAll - Rube server raw data:', rubeServer);
        console.log('MCPServersService: getAll - Rube server enabled:', rubeServer.enabled);
        console.log('MCPServersService: getAll - Rube server hasAuthToken:', rubeServer.hasAuthToken);
      }
      
      // Transform the response to match our MCPServer interface
      const transformedServers = servers.map((server: any) => ({
        id: server.id,
        name: server.name,
        description: server.description,
        serverUrl: server.serverUrl,
        enabled: server.enabled,
        authToken: server.hasAuthToken ? '***MASKED***' : undefined, // Don't expose real tokens
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      }));
      
      return transformedServers;
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<MCPServer | null> {
    try {
      const headers = await getAuthHeaders();
      // Add cache-busting parameter to ensure we get fresh data
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(`${SERVER_BASE_URL}/mcp_servers/${id}${cacheBuster}`, { headers });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch MCP server: ${response.statusText}`);
      }
      const server = await response.json();
      console.log('MCPServersService: getById raw response:', server);
      
      // Debug: Log the specific server we're interested in
      if (server.id === '11111111-1111-1111-1111-111111111111') {
        console.log('MCPServersService: getById - Rube server raw data:', server);
        console.log('MCPServersService: getById - Rube server enabled:', server.enabled);
        console.log('MCPServersService: getById - Rube server hasAuthToken:', server.hasAuthToken);
      }
      
      // Transform the response to match our MCPServer interface
      const transformedServer = {
        id: server.id,
        name: server.name,
        description: server.description,
        serverUrl: server.serverUrl,
        enabled: server.enabled,
        authToken: server.hasAuthToken ? '***MASKED***' : undefined, // Don't expose real tokens
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      };
      
      return transformedServer;
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
      
      const headers = await getAuthHeaders();
      const url = `${SERVER_BASE_URL}/mcp_servers/${id}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      
      console.log('MCPServersService: Update response status:', response.status);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('MCPServersService: Update failed with response:', errorText);
        throw new Error(`Failed to update MCP server: ${response.statusText}`);
      }
      
      const server = await response.json();
      console.log('MCPServersService: Update successful, received server:', server);
      
      // Transform the response to match our MCPServer interface
      const transformedServer = {
        id: server.id,
        name: server.name,
        description: server.description,
        serverUrl: server.serverUrl,
        enabled: server.enabled,
        authToken: server.authToken ? '***MASKED***' : undefined, // Don't expose real tokens
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      };
      
      return transformedServer;
    } catch (error) {
      console.error('Error updating MCP server:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      // Delete directly via Supabase to ensure the record is actually removed
      const { data, error } = await supabase
        .from('mcp_servers')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting MCP server:', error);
      throw error;
    }
  }

  async deleteAll(): Promise<void> {
    // Note: Server doesn't support batch MCP server deletion yet
    throw new Error('MCP server batch deletion not implemented in server');
  }

  // Method to refresh a specific server by ID (useful after updates)
  async refreshById(id: string): Promise<MCPServer | null> {
    return this.getById(id);
  }
}

export const mcpServersService = new MCPServersService();