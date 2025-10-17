// ChatKit Types - Basic type definitions for ChatKit protocol

export interface ChatKitRequest {
  type: string;
  params?: any;
}

export interface ThreadMetadata {
  id: string;
  title?: string;
  created_at: Date;
  status?: { type: string };
  metadata?: any;
}

export interface Thread {
  id: string;
  created_at: number;
  status: { type: string };
  metadata: any;
  items: { data: any[]; has_more: boolean; after: string | null };
}

export interface UserMessageItem {
  type: 'user_message';
  id: string;
  content: any[];
  thread_id: string;
  created_at: number;
  attachments?: any[];
  quoted_text?: string;
  inference_options?: any;
}

export interface AssistantMessageItem {
  type: 'assistant_message';
  id: string;
  content: any[];
  thread_id: string;
  created_at: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url?: string;
  size?: number;
}

export type ThreadItem = UserMessageItem | AssistantMessageItem | any;

export interface ThreadStreamEvent {
  type: string;
  [key: string]: any;
}

export interface ThreadCreatedEvent extends ThreadStreamEvent {
  type: 'thread.created';
  thread: Thread;
}

export interface ThreadUpdatedEvent extends ThreadStreamEvent {
  type: 'thread.updated';
  thread: Thread;
}

export interface ThreadItemAddedEvent extends ThreadStreamEvent {
  type: 'thread.item.added';
  item: any;
}

export interface ThreadItemDoneEvent extends ThreadStreamEvent {
  type: 'thread.item.done';
  item: any;
}

export interface UserMessageInput {
  content: any;
  attachments?: any[];
  quoted_text?: string;
  inference_options?: any;
}

export function isStreamingReq(request: ChatKitRequest): boolean {
  const streamingTypes = [
    'threads.create',
    'threads.add_user_message',
    'threads.action',
    'threads.custom_action'
  ];
  return streamingTypes.includes(request.type);
}
