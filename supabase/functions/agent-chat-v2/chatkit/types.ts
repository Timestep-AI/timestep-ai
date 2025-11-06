// ChatKit Types - TypeScript equivalent of types.py
// Comprehensive type definitions matching Python implementation

import type { ErrorCode } from './errors.ts';
import type { WidgetComponent, WidgetRoot, WidgetIcon } from './widgets.ts';

// ============================================================================
// Page Types
// ============================================================================

export interface Page<T> {
  /** Paginated collection of records returned from the API. */
  data: T[];
  has_more: boolean;
  after: string | null;
}

// ============================================================================
// Thread Status Types
// ============================================================================

export interface ActiveStatus {
  /** Status indicating the thread is active. */
  type: "active";
}

export interface LockedStatus {
  /** Status indicating the thread is locked. */
  type: "locked";
  reason?: string | null;
}

export interface ClosedStatus {
  /** Status indicating the thread is closed. */
  type: "closed";
  reason?: string | null;
}

export type ThreadStatus = ActiveStatus | LockedStatus | ClosedStatus;
/** Union of lifecycle states for a thread. */

// ============================================================================
// Thread Types
// ============================================================================

export interface ThreadMetadata {
  /** Metadata describing a thread without its items. */
  title?: string | null;
  id: string;
  created_at: Date;
  status: ThreadStatus;
  metadata: Record<string, any>;
}

export interface Thread extends ThreadMetadata {
  /** Thread with its paginated items. */
  items: Page<ThreadItem>;
}

// ============================================================================
// Thread Item Base and Content Types
// ============================================================================

export interface ThreadItemBase {
  /** Base fields shared by all thread items. */
  id: string;
  thread_id: string;
  created_at: Date;
}

export interface AssistantMessageContent {
  /** Assistant message content consisting of text and annotations. */
  annotations: Annotation[];
  text: string;
  type: "output_text";
}

export interface Annotation {
  /** Reference to supporting context attached to assistant output. */
  type: "annotation";
  source: URLSource | FileSource | EntitySource;
  index?: number | null;
}

export interface UserMessageTextContent {
  /** User message content containing plaintext. */
  type: "input_text";
  text: string;
}

export interface UserMessageTagContent {
  /** User message content representing an interactive tag. */
  type: "input_tag";
  id: string;
  text: string;
  data: Record<string, any>;
  interactive?: boolean;
}

export type UserMessageContent = UserMessageTextContent | UserMessageTagContent;
/** Union of allowed user message content payloads. */

export interface UserMessageInput {
  /** Payload describing a user message submission. */
  content: UserMessageContent[];
  attachments: string[];
  quoted_text?: string | null;
  inference_options: InferenceOptions;
}

export interface InferenceOptions {
  /** Model and tool configuration for message processing. */
  tool_choice?: ToolChoice | null;
  model?: string | null;
}

export interface ToolChoice {
  /** Explicit tool selection for the assistant to invoke. */
  id: string;
}

export interface AttachmentBase {
  /** Base metadata shared by all attachments. */
  id: string;
  name: string;
  mime_type: string;
  upload_url?: string | null;
  /** The URL to upload the file, used for two-phase upload.
   * Should be set to None after upload is complete or when using direct upload where uploading happens when creating the attachment object.
   */
}

export interface FileAttachment extends AttachmentBase {
  /** Attachment representing a generic file. */
  type: "file";
}

export interface ImageAttachment extends AttachmentBase {
  /** Attachment representing an image resource. */
  type: "image";
  preview_url: string;
}

export type Attachment = FileAttachment | ImageAttachment;
/** Union of supported attachment types. */

export interface AttachmentCreateParams {
  /** Metadata needed to initialize an attachment. */
  name: string;
  size: number;
  mime_type: string;
}

// ============================================================================
// Thread Item Types
// ============================================================================

export interface UserMessageItem extends ThreadItemBase {
  /** Thread item representing a user message. */
  type: "user_message";
  content: UserMessageContent[];
  attachments: Attachment[];
  quoted_text?: string | null;
  inference_options: InferenceOptions;
}

export interface AssistantMessageItem extends ThreadItemBase {
  /** Thread item representing an assistant message. */
  type: "assistant_message";
  content: AssistantMessageContent[];
}

export interface ClientToolCallItem extends ThreadItemBase {
  /** Thread item capturing a client tool call. */
  type: "client_tool_call";
  status: "pending" | "completed";
  call_id: string;
  name: string;
  arguments: Record<string, any>;
  output?: any | null;
}

export interface WidgetItem extends ThreadItemBase {
  /** Thread item containing widget content. */
  type: "widget";
  widget: WidgetRoot;
  copy_text?: string | null;
}

export interface TaskItem extends ThreadItemBase {
  /** Thread item containing a task. */
  type: "task";
  task: Task;
}

export interface WorkflowItem extends ThreadItemBase {
  /** Thread item representing a workflow. */
  type: "workflow";
  workflow: Workflow;
}

export interface EndOfTurnItem extends ThreadItemBase {
  /** Marker item indicating the assistant ends its turn. */
  type: "end_of_turn";
}

export interface HiddenContextItem extends ThreadItemBase {
  /** HiddenContext is never sent to the client. It's not officially part of ChatKit. It is only used internally to store additional context in a specific place in the thread. */
  type: "hidden_context_item";
  content: any;
}

export type ThreadItem =
  | UserMessageItem
  | AssistantMessageItem
  | ClientToolCallItem
  | WidgetItem
  | WorkflowItem
  | TaskItem
  | HiddenContextItem
  | EndOfTurnItem;
/** Union of all thread item variants. */

// ============================================================================
// Workflow and Task Types
// ============================================================================

export interface CustomSummary {
  /** Custom summary for a workflow. */
  title: string;
  icon?: WidgetIcon | null;
}

export interface DurationSummary {
  /** Summary providing total workflow duration. */
  duration: number;
  /** The duration of the workflow in seconds */
}

export type WorkflowSummary = CustomSummary | DurationSummary;
/** Summary variants available for workflows. */

export interface Workflow {
  /** Workflow attached to a thread with optional summary. */
  type: "custom" | "reasoning";
  tasks: Task[];
  summary?: WorkflowSummary | null;
  expanded?: boolean;
}

export interface BaseTask {
  /** Base fields common to all workflow tasks. */
  status_indicator?: "none" | "loading" | "complete";
  /** Only used when rendering the task as part of a workflow. Indicates the status of the task. */
}

export interface CustomTask extends BaseTask {
  /** Workflow task displaying custom content. */
  type: "custom";
  title?: string | null;
  icon?: WidgetIcon | null;
  content?: string | null;
}

export interface SearchTask extends BaseTask {
  /** Workflow task representing a web search. */
  type: "web_search";
  title?: string | null;
  title_query?: string | null;
  queries: string[];
  sources: URLSource[];
}

export interface ThoughtTask extends BaseTask {
  /** Workflow task capturing assistant reasoning. */
  type: "thought";
  title?: string | null;
  content: string;
}

export interface FileTask extends BaseTask {
  /** Workflow task referencing file sources. */
  type: "file";
  title?: string | null;
  sources: FileSource[];
}

export interface ImageTask extends BaseTask {
  /** Workflow task rendering image content. */
  type: "image";
  title?: string | null;
}

export type Task = CustomTask | SearchTask | ThoughtTask | FileTask | ImageTask;
/** Union of workflow task variants. */

// ============================================================================
// Source Types
// ============================================================================

export interface SourceBase {
  /** Base class for sources displayed to users. */
  title: string;
  description?: string | null;
  timestamp?: string | null;
  group?: string | null;
}

export interface FileSource extends SourceBase {
  /** Source metadata for file-based references. */
  type: "file";
  filename: string;
}

export interface URLSource extends SourceBase {
  /** Source metadata for external URLs. */
  type: "url";
  url: string;
  attribution?: string | null;
}

export interface EntitySource extends SourceBase {
  /** Source metadata for entity references. */
  type: "entity";
  id: string;
  icon?: WidgetIcon | null;
  preview?: "lazy" | null;
  data: Record<string, any>;
}

export type Source = URLSource | FileSource | EntitySource;
/** Union of supported source types. */

// ============================================================================
// Thread Stream Event Types
// ============================================================================

export interface ThreadCreatedEvent {
  /** Event emitted when a thread is created. */
  type: "thread.created";
  thread: Thread;
}

export interface ThreadUpdatedEvent {
  /** Event emitted when a thread is updated. */
  type: "thread.updated";
  thread: Thread;
}

export interface ThreadItemAddedEvent {
  /** Event emitted when a new item is added to a thread. */
  type: "thread.item.added";
  item: ThreadItem;
}

export interface ThreadItemUpdated {
  /** Event describing an update to an existing thread item. */
  type: "thread.item.updated";
  item_id: string;
  update: ThreadItemUpdate;
}

export interface ThreadItemDoneEvent {
  /** Event emitted when a thread item is marked complete. */
  type: "thread.item.done";
  item: ThreadItem;
}

export interface ThreadItemRemovedEvent {
  /** Event emitted when a thread item is removed. */
  type: "thread.item.removed";
  item_id: string;
}

export interface ThreadItemReplacedEvent {
  /** Event emitted when a thread item is replaced. */
  type: "thread.item.replaced";
  item: ThreadItem;
}

export interface ProgressUpdateEvent {
  /** Event providing incremental progress from the assistant. */
  type: "progress_update";
  icon?: WidgetIcon | null;
  text: string;
}

export interface ErrorEvent {
  /** Event indicating an error occurred while processing a thread. */
  type: "error";
  code?: ErrorCode | "custom";
  message?: string | null;
  allow_retry?: boolean;
}

export interface NoticeEvent {
  /** Event conveying a user-facing notice. */
  type: "notice";
  level: "info" | "warning" | "danger";
  message: string;
  /** Supports markdown e.g. "You've reached your limit of 100 messages. [Upgrade](https://...) to a paid plan." */
  title?: string | null;
}

export type ThreadStreamEvent =
  | ThreadCreatedEvent
  | ThreadUpdatedEvent
  | ThreadItemDoneEvent
  | ThreadItemAddedEvent
  | ThreadItemUpdated
  | ThreadItemRemovedEvent
  | ThreadItemReplacedEvent
  | ProgressUpdateEvent
  | ErrorEvent
  | NoticeEvent;
/** Union of all streaming events emitted to clients. */

// ============================================================================
// Thread Item Update Types
// ============================================================================

export interface AssistantMessageContentPartAdded {
  /** Event emitted when new assistant content is appended. */
  type: "assistant_message.content_part.added";
  content_index: number;
  content: AssistantMessageContent;
}

export interface AssistantMessageContentPartTextDelta {
  /** Event carrying incremental assistant text output. */
  type: "assistant_message.content_part.text_delta";
  content_index: number;
  delta: string;
}

export interface AssistantMessageContentPartAnnotationAdded {
  /** Event announcing a new annotation on assistant content. */
  type: "assistant_message.content_part.annotation_added";
  content_index: number;
  annotation_index: number;
  annotation: Annotation;
}

export interface AssistantMessageContentPartDone {
  /** Event indicating an assistant content part is finalized. */
  type: "assistant_message.content_part.done";
  content_index: number;
  content: AssistantMessageContent;
}

export interface WidgetStreamingTextValueDelta {
  /** Event streaming widget text deltas. */
  type: "widget.streaming_text.value_delta";
  component_id: string;
  delta: string;
  done: boolean;
}

export interface WidgetRootUpdated {
  /** Event published when the widget root changes. */
  type: "widget.root.updated";
  widget: WidgetRoot;
}

export interface WidgetComponentUpdated {
  /** Event emitted when a widget component updates. */
  type: "widget.component.updated";
  component_id: string;
  component: WidgetComponent;
}

export interface WorkflowTaskAdded {
  /** Event emitted when a workflow task is added. */
  type: "workflow.task.added";
  task_index: number;
  task: Task;
}

export interface WorkflowTaskUpdated {
  /** Event emitted when a workflow task is updated. */
  type: "workflow.task.updated";
  task_index: number;
  task: Task;
}

export type ThreadItemUpdate =
  | AssistantMessageContentPartAdded
  | AssistantMessageContentPartTextDelta
  | AssistantMessageContentPartAnnotationAdded
  | AssistantMessageContentPartDone
  | WidgetStreamingTextValueDelta
  | WidgetComponentUpdated
  | WidgetRootUpdated
  | WorkflowTaskAdded
  | WorkflowTaskUpdated;
/** Union of possible updates applied to thread items. */

// ============================================================================
// Misc Types
// ============================================================================

export type FeedbackKind = "positive" | "negative";
/** Literal type for feedback sentiment. */

// IconName is exported from widgets.ts
