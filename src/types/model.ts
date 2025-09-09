export interface Model {
  id: string;
  name: string;
  description?: string;
  provider: string;
  version: string;
  contextLength: number;
  inputPrice: number; // per 1M tokens
  outputPrice: number; // per 1M tokens
  capabilities: string[];
  status: 'active' | 'deprecated' | 'beta';
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelRequest {
  name: string;
  description?: string;
  provider: string;
  version: string;
  contextLength: number;
  inputPrice: number;
  outputPrice: number;
  capabilities?: string[];
  status?: 'active' | 'deprecated' | 'beta';
}

export interface UpdateModelRequest {
  name?: string;
  description?: string;
  version?: string;
  contextLength?: number;
  inputPrice?: number;
  outputPrice?: number;
  capabilities?: string[];
  status?: 'active' | 'deprecated' | 'beta';
}