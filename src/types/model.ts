export interface Model {
  id: string;
  created: number;
  object: string;
  owned_by: string;
}

export interface CreateModelRequest {
  // Models come from model providers, not created directly
  id: string;
  created: number;
  object: string;
  owned_by: string;
}

export interface UpdateModelRequest {
  // Models come from model providers, not updated directly
  id?: string;
  created?: number;
  object?: string;
  owned_by?: string;
}