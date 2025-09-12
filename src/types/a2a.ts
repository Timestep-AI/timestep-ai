export interface TextPart {
  kind: 'text';
  text: string;
}

export interface FilePart {
  kind: 'file';
  file: {
    name?: string;
    mimeType?: string;
    uri?: string;
    bytes?: string;
  };
}

export interface DataPart {
  kind: 'data';
  data: any;
}

export type Part = TextPart | FilePart | DataPart;

export interface A2AMessage {
  messageId: string;
  kind: 'message';
  role: 'user' | 'agent';
  parts: Part[];
  taskId?: string;
  contextId?: string;
}

export interface MessageSendParams {
  message: A2AMessage;
  configuration?: {
    acceptedOutputModes?: string[];
    blocking?: boolean;
  };
}

export interface TaskStatusUpdateEvent {
  kind: 'status-update';
  taskId: string;
  contextId: string;
  status: {
    state: 'working' | 'input-required' | 'completed' | 'canceled' | 'failed' | 'submitted' | 'rejected';
    message?: A2AMessage;
  };
  final?: boolean;
}

export interface TaskArtifactUpdateEvent {
  kind: 'artifact-update';
  taskId: string;
  contextId: string;
  artifact: {
    artifactId: string;
    name?: string;
    parts: Part[];
  };
}

export interface Task {
  kind: 'task';
  id: string;
  contextId: string;
  status: {
    state: string;
    message?: A2AMessage;
  };
  artifacts?: Array<{
    artifactId: string;
    name?: string;
    parts: Part[];
  }>;
}

export type A2AEvent = A2AMessage | TaskStatusUpdateEvent | TaskArtifactUpdateEvent | Task;

export interface AgentCard {
  name?: string;
  description?: string;
  version?: string;
  capabilities?: {
    streaming?: boolean;
  };
}