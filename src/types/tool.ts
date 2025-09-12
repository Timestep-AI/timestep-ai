export interface Tool {
  id: string;
  name: string;
  description?: string;
  category: 'productivity' | 'development' | 'communication' | 'analysis' | 'automation';
  version: string;
  isEnabled: boolean;
  permissions: string[];
  status: 'active' | 'inactive' | 'maintenance';
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
  usage: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface CreateToolRequest {
  name: string;
  description?: string;
  category: 'productivity' | 'development' | 'communication' | 'analysis' | 'automation';
  version: string;
  isEnabled?: boolean;
  permissions?: string[];
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface UpdateToolRequest {
  name?: string;
  description?: string;
  category?: 'productivity' | 'development' | 'communication' | 'analysis' | 'automation';
  version?: string;
  isEnabled?: boolean;
  permissions?: string[];
  status?: 'active' | 'inactive' | 'maintenance';
}