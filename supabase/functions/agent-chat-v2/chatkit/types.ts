// ChatKit Types - mirror minimal structures used by Python server

export interface ThreadMetadata {
  id: string;
  title?: string;
  created_at: Date;
  status?: { type: string };
  metadata?: any;
}

export interface Thread {
  id: string;
  title?: string;
  created_at: Date | number;
  status?: { type: string };
  metadata?: any;
  items: { data: any[]; has_more: boolean; after: string | null };
}

export interface UserMessageItem {
  type: 'user_message';
  id: string;
  content: any[] | string;
  thread_id: string;
  created_at: Date | number;
  attachments?: any[];
  quoted_text?: string | null;
  inference_options?: any;
}

export interface AssistantMessageItem {
  type: 'assistant_message';
  id: string;
  content: any[] | string;
  thread_id: string;
  created_at: Date | number;
}

export type ThreadItem = UserMessageItem | AssistantMessageItem | any;

export interface Page<T> {
  data: T[];
  has_more: boolean;
  after: string | null;
}

export interface ThreadStreamEvent {
  type: string;
  [key: string]: any;
}


