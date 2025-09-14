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