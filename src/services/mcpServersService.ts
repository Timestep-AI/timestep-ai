export interface MCPServer {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  toolCount: number;
  version: string;
  lastConnected: string;
  createdAt: string;
  updatedAt: string;
}

class MCPServersService {
  private mockServers: MCPServer[] = [
    {
      id: '1',
      name: 'Built-in MCP Server',
      description: 'Built-in server providing essential tools',
      status: 'active',
      toolCount: 5,
      version: '1.0.0',
      lastConnected: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Custom MCP Server',
      description: 'Custom server for specialized tools',
      status: 'inactive',
      toolCount: 3,
      version: '1.2.0',
      lastConnected: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  async getAll(): Promise<MCPServer[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...this.mockServers];
  }

  async getById(id: string): Promise<MCPServer | null> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return this.mockServers.find(server => server.id === id) || null;
  }

  async create(serverData: Omit<MCPServer, 'id' | 'createdAt' | 'updatedAt'>): Promise<MCPServer> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newServer: MCPServer = {
      ...serverData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.mockServers.push(newServer);
    return newServer;
  }

  async update(id: string, updates: Partial<Omit<MCPServer, 'id' | 'createdAt'>>): Promise<MCPServer | null> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = this.mockServers.findIndex(server => server.id === id);
    if (index === -1) return null;
    
    this.mockServers[index] = {
      ...this.mockServers[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return this.mockServers[index];
  }

  async delete(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = this.mockServers.findIndex(server => server.id === id);
    if (index === -1) return false;
    
    this.mockServers.splice(index, 1);
    return true;
  }

  async deleteAll(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.mockServers.length = 0;
  }
}

export const mcpServersService = new MCPServersService();