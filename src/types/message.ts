export interface Message {
  id: string;
  chatId: string;
  content: string;
  sender: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'system';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  attachments?: string[];
}

export interface CreateMessageRequest {
  chatId: string;
  content: string;
  sender: string;
  type?: 'user' | 'assistant' | 'system';
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  attachments?: string[];
}

export interface UpdateMessageRequest {
  content?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  attachments?: string[];
}