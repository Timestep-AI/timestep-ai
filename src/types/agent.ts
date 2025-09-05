export interface Agent {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  model?: string;
  status: 'active' | 'inactive' | 'handoff';
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  model?: string;
  status?: 'active' | 'inactive' | 'handoff';
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  model?: string;
  status?: 'active' | 'inactive' | 'handoff';
}