export interface TextPart {
  kind: 'text';
  text: string;
  metadata?: { [key: string]: any };
}

export interface FilePart {
  kind: 'file';
  file: {
    name?: string;
    mimeType?: string;
  } & ({
    uri: string;
  } | {
    bytes: string; // base64 encoded
  });
  metadata?: { [key: string]: any };
}

export interface DataPart {
  kind: 'data';
  data: any;
  metadata?: { [key: string]: any };
}

export type Part = TextPart | FilePart | DataPart;

export interface A2AMessage {
  readonly messageId: string;
  readonly kind: 'message';
  readonly role: 'user' | 'agent';
  parts: Part[];
  taskId?: string;
  contextId?: string;
  metadata?: { [key: string]: any };
  extensions?: string[];
  referenceTaskIds?: string[];
}

export interface MessageSendConfiguration {
  acceptedOutputModes?: string[];
  historyLength?: number;
  blocking?: boolean;
}

export interface MessageSendParams {
  message: A2AMessage;
  configuration?: MessageSendConfiguration;
  metadata?: { [key: string]: any };
}

export type TaskState = 
  | 'submitted' 
  | 'working' 
  | 'input-required' 
  | 'completed' 
  | 'canceled' 
  | 'failed' 
  | 'rejected' 
  | 'auth-required' 
  | 'unknown';

export interface TaskStatus {
  state: TaskState;
  message?: A2AMessage;
  timestamp?: string; // ISO 8601
}

export interface TaskStatusUpdateEvent {
  readonly kind: 'status-update';
  taskId: string;
  contextId: string;
  status: TaskStatus;
  final: boolean;
  metadata?: { [key: string]: any };
}

export interface Artifact {
  artifactId: string;
  name?: string;
  parts: Part[];
  metadata?: { [key: string]: any };
}

export interface TaskArtifactUpdateEvent {
  readonly kind: 'artifact-update';
  taskId: string;
  contextId: string;
  artifact: Artifact;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: { [key: string]: any };
}

export interface Task {
  readonly kind: 'task';
  id: string;
  contextId: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: A2AMessage[];
  metadata?: { [key: string]: any };
}

export type A2AEvent = A2AMessage | TaskStatusUpdateEvent | TaskArtifactUpdateEvent | Task;

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

export interface AgentCard {
  name?: string;
  description?: string;
  version?: string;
  capabilities?: AgentCapabilities;
  url?: string;
  inputModes?: string[];
  outputModes?: string[];
}