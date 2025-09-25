export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  id: string;
  chatId: string;
  content: string;
  sender: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'system' | 'tool_call' | 'tool_response';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'sending';
  attachments?: string[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
  approved?: boolean;
  isToolCall?: boolean;
  rawMessage?: any; // Raw message data from server for tool call approval
}

export interface CreateMessageRequest {
  chatId: string;
  content: string;
  sender: string;
  type?: 'user' | 'assistant' | 'system' | 'tool_call' | 'tool_response';
  status?: 'sent' | 'delivered' | 'read' | 'failed' | 'sending';
  attachments?: string[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
  approved?: boolean;
}

export interface UpdateMessageRequest {
  content?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed' | 'sending';
  attachments?: string[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
  approved?: boolean;
}