export interface Chat {
  id: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status: 'active' | 'archived' | 'paused';
  participants?: string[];
  agentId: string;
}

export interface CreateChatRequest {
  title: string;
  lastMessage?: string;
  status?: 'active' | 'archived' | 'paused';
  participants?: string[];
  agentId: string;
}

export interface UpdateChatRequest {
  title?: string;
  lastMessage?: string;
  status?: 'active' | 'archived' | 'paused';
  participants?: string[];
  agentId?: string;
}