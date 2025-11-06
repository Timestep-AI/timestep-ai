import type { ModelSettings } from '@openai/agents-core';

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

export interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  instructions: string;
  tool_ids: string[];
  handoff_ids: string[];
  model: string | null;
  model_settings: any;
  created_at: string | null;
  updated_at: string | null;
}
