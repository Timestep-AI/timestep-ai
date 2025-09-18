export interface Tool {
  id: string;
  name: string;
  description?: string;
  serverId: string;
  serverName: string;
  inputSchema?: any;
  category: string; // This is actually the server name/category from API
  status: 'available' | 'unavailable';
}

export interface CreateToolRequest {
  name: string;
  description?: string;
  serverId: string;
  serverName: string;
  category: string;
  status?: 'available' | 'unavailable';
}

export interface UpdateToolRequest {
  name?: string;
  description?: string;
  serverId?: string;
  serverName?: string;
  category?: string;
  status?: 'available' | 'unavailable';
}