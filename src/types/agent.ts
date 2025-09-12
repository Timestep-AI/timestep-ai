export interface Agent {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  handoffIds?: string[];
  handoffDescription?: string;
  createdAt: string;
  model?: string;
  modelSettings?: {
    temperature?: number;
  };
  status: 'active' | 'inactive';
  isHandoff: boolean;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  instructions?: string;
  handoffIds?: string[];
  handoffDescription?: string;
  model?: string;
  modelSettings?: {
    temperature?: number;
  };
  status?: 'active' | 'inactive';
  isHandoff?: boolean;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  instructions?: string;
  handoffIds?: string[];
  handoffDescription?: string;
  model?: string;
  modelSettings?: {
    temperature?: number;
  };
  status?: 'active' | 'inactive';
  isHandoff?: boolean;
}