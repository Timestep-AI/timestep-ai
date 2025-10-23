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
