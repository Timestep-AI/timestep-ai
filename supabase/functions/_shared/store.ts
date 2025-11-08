import type { ThreadMetadata, ThreadItem, Page, Attachment, AttachmentCreateParams } from './types.ts';

// Match Python: TContext = TypeVar("TContext", default=Any) (line 15)
type TContext = any;

// Match Python: StoreItemType = Literal[...] (line 17-19)
export type StoreItemType = "thread" | "message" | "tool_call" | "task" | "workflow" | "attachment";

// Match Python: _ID_PREFIXES dict (line 22-29)
const _ID_PREFIXES: Record<StoreItemType, string> = {
  "thread": "thr",
  "message": "msg",
  "tool_call": "tc",
  "workflow": "wf",
  "task": "tsk",
  "attachment": "atc",
};

// Match Python: default_generate_id function (line 32-34)
export function default_generate_id(item_type: StoreItemType): string {
  const prefix = _ID_PREFIXES[item_type];
  // Use crypto.randomUUID() matching Python's uuid.uuid4().hex[:8]
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;
}

// Match Python: NotFoundError exception (line 37-38)
export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface Store<TContext> {
  // Match Python: context is required, not optional
  generate_thread_id(context: TContext): string;
  generate_item_id(item_type: StoreItemType, thread: ThreadMetadata, context: TContext): string;
  add_thread_item(thread_id: string, item: ThreadItem, context: TContext): Promise<void>;
  load_thread(thread_id: string, context: TContext): Promise<ThreadMetadata>;
  load_thread_items(
    thread_id: string,
    after: string | null,
    limit: number,
    order: 'asc' | 'desc',
    context: TContext
  ): Promise<Page<ThreadItem>>;
  load_threads(
    limit: number,
    after: string | null,
    order: 'asc' | 'desc',
    context: TContext
  ): Promise<Page<ThreadMetadata>>;
  save_thread(thread: ThreadMetadata, context: TContext): Promise<void>;
  delete_thread_item(thread_id: string, item_id: string, context: TContext): Promise<void>;
  save_item(thread_id: string, item: ThreadItem, context: TContext): Promise<void>;
  load_item(thread_id: string, item_id: string, context: TContext): Promise<ThreadItem>;
  delete_thread(thread_id: string, context: TContext): Promise<void>;
  save_attachment(attachment: Attachment, context: TContext): Promise<void>;
  load_attachment(attachment_id: string, context: TContext): Promise<Attachment>;
  delete_attachment(attachment_id: string, context: TContext): Promise<void>;
}

export interface AttachmentStore<TContext> {
  // Match Python: delete_attachment is abstract/required
  delete_attachment(attachment_id: string, context: TContext): Promise<void>;
  // Match Python: create_attachment has default implementation (raises NotImplementedError)
  // So we make it optional but implementers should provide it
  create_attachment?(params: AttachmentCreateParams, context: TContext): Promise<Attachment>;
  // Match Python: generate_attachment_id has default implementation
  // So we make it optional but implementers can override it
  generate_attachment_id?(mime_type: string, context: TContext): string;
}
