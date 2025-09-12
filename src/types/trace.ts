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
  name: string;
  rootSpanId: string;
  serviceCount: number;
  spanCount: number;
  startTime: string;
  endTime: string;
  duration: number; // in milliseconds
  status: 'ok' | 'error' | 'timeout';
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTraceRequest {
  name: string;
  rootSpanId: string;
  serviceCount?: number;
  spanCount?: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  status?: 'ok' | 'error' | 'timeout';
  errorCount?: number;
}

export interface UpdateTraceRequest {
  name?: string;
  rootSpanId?: string;
  serviceCount?: number;
  spanCount?: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  status?: 'ok' | 'error' | 'timeout';
  errorCount?: number;
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