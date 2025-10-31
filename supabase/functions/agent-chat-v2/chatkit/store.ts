import type { ThreadMetadata, ThreadItem, Page } from './types.ts';

export type StoreItemType = string;

export interface Store<TContext> {
  generate_thread_id(context?: TContext | null): string;
  generate_item_id(item_type: string | StoreItemType, thread: ThreadMetadata, context?: TContext | null): string;
  add_thread_item(thread_id: string, item: ThreadItem, context?: TContext | null): Promise<void>;
  load_thread(thread_id: string, context?: TContext | null): Promise<ThreadMetadata>;
  load_thread_items(
    thread_id: string,
    after: string | null,
    limit: number,
    order: 'asc' | 'desc',
    context?: TContext | null
  ): Promise<Page<ThreadItem>>;
  load_threads(
    limit: number,
    after: string | null,
    order: 'asc' | 'desc',
    context?: TContext | null
  ): Promise<Page<ThreadMetadata>>;
  save_thread(thread: ThreadMetadata, context?: TContext | null): Promise<void>;
  delete_thread_item?(thread_id: string, item_id: string, context?: TContext | null): Promise<void>;
  save_item?(thread_id: string, item: ThreadItem, context?: TContext | null): Promise<void>;
  delete_attachment?(attachment_id: string, context?: TContext | null): Promise<void>;
  load_attachment?(attachment_id: string, context?: TContext | null): Promise<any>;
}

export interface AttachmentStore<TContext> {
  create_attachment?(params: any, context?: TContext | null): Promise<any>;
  delete_attachment?(attachment_id: string, context?: TContext | null): Promise<void>;
  generate_attachment_id?(mime_type: string, context: TContext): string;
}


