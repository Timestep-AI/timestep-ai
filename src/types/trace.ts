export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  operationName: string;
  serviceName: string;
  type: 'agent' | 'function_call' | 'api_request' | 'handoff' | 'completion';
  startTime: string;
  endTime: string;
  duration: number; // in milliseconds
  status: 'ok' | 'error' | 'timeout' | 'running';
  model?: string;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  functions?: string[];
  tags?: Record<string, string>;
  logs?: Array<{
    timestamp: string;
    message: string;
    level: 'info' | 'warn' | 'error' | 'debug';
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface Trace {
  id: string;
  object: string;
  created_at: string;
  duration_ms: number | null;
  first_5_agents: string[] | null;
  group_id: string | null;
  handoff_count: number;
  tool_count: number;
  workflow_name: string;
  metadata: Record<string, any>;
}

export interface CreateTraceRequest {
  workflow_name: string;
  duration_ms?: number | null;
  first_5_agents?: string[] | null;
  group_id?: string | null;
  handoff_count?: number;
  tool_count?: number;
  metadata?: Record<string, any>;
}

export interface UpdateTraceRequest {
  workflow_name?: string;
  duration_ms?: number | null;
  first_5_agents?: string[] | null;
  group_id?: string | null;
  handoff_count?: number;
  tool_count?: number;
  metadata?: Record<string, any>;
}

export interface CreateSpanRequest {
  traceId: string;
  parentId?: string;
  operationName: string;
  serviceName: string;
  type: 'agent' | 'function_call' | 'api_request' | 'handoff' | 'completion';
  startTime?: string;
  endTime?: string;
  duration?: number;
  status?: 'ok' | 'error' | 'timeout' | 'running';
  model?: string;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  functions?: string[];
  tags?: Record<string, string>;
  logs?: Array<{
    timestamp: string;
    message: string;
    level: 'info' | 'warn' | 'error' | 'debug';
  }>;
}

export interface UpdateSpanRequest {
  parentId?: string;
  operationName?: string;
  serviceName?: string;
  type?: 'agent' | 'function_call' | 'api_request' | 'handoff' | 'completion';
  startTime?: string;
  endTime?: string;
  duration?: number;
  status?: 'ok' | 'error' | 'timeout' | 'running';
  model?: string;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  functions?: string[];
  tags?: Record<string, string>;
  logs?: Array<{
    timestamp: string;
    message: string;
    level: 'info' | 'warn' | 'error' | 'debug';
  }>;
}