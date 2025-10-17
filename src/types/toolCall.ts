export interface PendingToolCall {
  id: string;
  name: string;
  description?: string;
  parameters: Record<string, any>;
  artifactId?: string;
  approved?: boolean;
}
