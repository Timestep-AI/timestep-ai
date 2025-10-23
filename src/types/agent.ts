import type { ModelSettings } from '@openai/agents-core';

// Agent record type shared between frontend and backend
export interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  instructions: string;
  tool_ids: string[];
  handoff_ids: string[];
  model: string;
  model_settings: ModelSettings;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  instructions?: string;
  handoffIds?: string[];
  toolIds?: string[];
  handoffDescription?: string;
  model?: string;
  modelSettings?: ModelSettings;
  status?: 'active' | 'inactive';
  isHandoff?: boolean;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  instructions?: string;
  handoffIds?: string[];
  toolIds?: string[];
  handoffDescription?: string;
  model?: string;
  modelSettings?: ModelSettings;
  status?: 'active' | 'inactive';
  isHandoff?: boolean;
}
