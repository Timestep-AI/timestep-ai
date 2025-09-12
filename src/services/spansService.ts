import { Span, CreateSpanRequest, UpdateSpanRequest } from '@/types/trace';

// Mock data for spans - LLM orchestration focused
const mockSpans: Span[] = [
  // Triage Agent
  {
    id: 'span_1',
    traceId: '1',
    operationName: 'Triage Agent',
    serviceName: 'LLM Orchestrator',
    type: 'agent',
    startTime: '2024-03-15T10:00:00.000Z',
    endTime: '2024-03-15T10:00:01.233Z',
    duration: 1233,
    status: 'ok',
    model: 'ollama/gpt-oss:20b',
    tokens: {
      input: 245,
      output: 128,
      total: 373
    },
    functions: ['get_weather', 'get_emails'],
    tags: {
      'agent.type': 'triage',
      'llm.temperature': '0.7'
    },
    logs: [
      {
        timestamp: '2024-03-15T10:00:00.500Z',
        message: 'Starting triage analysis',
        level: 'info'
      }
    ],
    createdAt: '2024-03-15T10:00:00.000Z',
    updatedAt: '2024-03-15T10:00:01.233Z'
  },
  {
    id: 'span_2',
    traceId: '1',
    parentId: 'span_1',
    operationName: 'POST /v1/responses',
    serviceName: 'OpenAI API',
    type: 'api_request',
    startTime: '2024-03-15T10:00:00.100Z',
    endTime: '2024-03-15T10:00:01.333Z',
    duration: 1233,
    status: 'ok',
    tags: {
      'http.method': 'POST',
      'http.url': '/v1/responses'
    },
    createdAt: '2024-03-15T10:00:00.100Z',
    updatedAt: '2024-03-15T10:00:01.333Z'
  },
  {
    id: 'span_3',
    traceId: '1',
    operationName: 'Handoff → Approval agent',
    serviceName: 'LLM Orchestrator',
    type: 'handoff',
    startTime: '2024-03-15T10:00:01.233Z',
    endTime: '2024-03-15T10:00:01.233Z',
    duration: 0,
    status: 'ok',
    tags: {
      'handoff.from': 'triage',
      'handoff.to': 'approval'
    },
    createdAt: '2024-03-15T10:00:01.233Z',
    updatedAt: '2024-03-15T10:00:01.233Z'
  },
  // Approval Agent
  {
    id: 'span_4',
    traceId: '1',
    operationName: 'Approval agent',
    serviceName: 'LLM Orchestrator',
    type: 'agent',
    startTime: '2024-03-15T10:00:01.233Z',
    endTime: '2024-03-15T10:00:05.553Z',
    duration: 4320,
    status: 'ok',
    model: 'ollama/gpt-oss:20b',
    tokens: {
      input: 512,
      output: 256,
      total: 768
    },
    functions: ['check_eligibility', 'send_email'],
    tags: {
      'agent.type': 'approval',
      'llm.temperature': '0.3'
    },
    createdAt: '2024-03-15T10:00:01.233Z',
    updatedAt: '2024-03-15T10:00:05.553Z'
  },
  {
    id: 'span_5',
    traceId: '1',
    parentId: 'span_4',
    operationName: 'POST /v1/responses',
    serviceName: 'OpenAI API',
    type: 'api_request',
    startTime: '2024-03-15T10:00:01.333Z',
    endTime: '2024-03-15T10:00:02.497Z',
    duration: 1164,
    status: 'ok',
    tags: {
      'http.method': 'POST',
      'http.url': '/v1/responses'
    },
    createdAt: '2024-03-15T10:00:01.333Z',
    updatedAt: '2024-03-15T10:00:02.497Z'
  },
  {
    id: 'span_6',
    traceId: '1',
    parentId: 'span_4',
    operationName: 'fetch_data',
    serviceName: 'Function Call',
    type: 'function_call',
    startTime: '2024-03-15T10:00:02.497Z',
    endTime: '2024-03-15T10:00:02.497Z',
    duration: 0,
    status: 'ok',
    tags: {
      'function.name': 'fetch_data',
      'function.arguments': '{"query": "eligibility"}'
    },
    createdAt: '2024-03-15T10:00:02.497Z',
    updatedAt: '2024-03-15T10:00:02.497Z'
  },
  {
    id: 'span_7',
    traceId: '1',
    parentId: 'span_4',
    operationName: 'POST /v1/responses',
    serviceName: 'OpenAI API',
    type: 'api_request',
    startTime: '2024-03-15T10:00:02.497Z',
    endTime: '2024-03-15T10:00:04.118Z',
    duration: 1621,
    status: 'ok',
    tags: {
      'http.method': 'POST',
      'http.url': '/v1/responses'
    },
    createdAt: '2024-03-15T10:00:02.497Z',
    updatedAt: '2024-03-15T10:00:04.118Z'
  },
  {
    id: 'span_8',
    traceId: '1',
    parentId: 'span_4',
    operationName: 'check_eligibility',
    serviceName: 'Function Call',
    type: 'function_call',
    startTime: '2024-03-15T10:00:04.118Z',
    endTime: '2024-03-15T10:00:04.118Z',
    duration: 0,
    status: 'ok',
    tags: {
      'function.name': 'check_eligibility',
      'function.arguments': '{"user_id": "123"}'
    },
    createdAt: '2024-03-15T10:00:04.118Z',
    updatedAt: '2024-03-15T10:00:04.118Z'
  },
  {
    id: 'span_9',
    traceId: '1',
    parentId: 'span_4',
    operationName: 'POST /v1/responses',
    serviceName: 'OpenAI API',
    type: 'api_request',
    startTime: '2024-03-15T10:00:04.118Z',
    endTime: '2024-03-15T10:00:05.748Z',
    duration: 1630,
    status: 'ok',
    tags: {
      'http.method': 'POST',
      'http.url': '/v1/responses'
    },
    createdAt: '2024-03-15T10:00:04.118Z',
    updatedAt: '2024-03-15T10:00:05.748Z'
  },
  {
    id: 'span_10',
    traceId: '1',
    parentId: 'span_4',
    operationName: 'send_email',
    serviceName: 'Function Call',
    type: 'function_call',
    startTime: '2024-03-15T10:00:05.748Z',
    endTime: '2024-03-15T10:00:05.748Z',
    duration: 0,
    status: 'ok',
    tags: {
      'function.name': 'send_email',
      'function.arguments': '{"to": "user@example.com"}'
    },
    createdAt: '2024-03-15T10:00:05.748Z',
    updatedAt: '2024-03-15T10:00:05.748Z'
  },
  {
    id: 'span_11',
    traceId: '1',
    operationName: 'Handoff → Summarizer Agent',
    serviceName: 'LLM Orchestrator',
    type: 'handoff',
    startTime: '2024-03-15T10:00:05.748Z',
    endTime: '2024-03-15T10:00:05.749Z',
    duration: 1,
    status: 'ok',
    tags: {
      'handoff.from': 'approval',
      'handoff.to': 'summarizer'
    },
    createdAt: '2024-03-15T10:00:05.748Z',
    updatedAt: '2024-03-15T10:00:05.749Z'
  },
  // Summarizer Agent
  {
    id: 'span_12',
    traceId: '1',
    operationName: 'Summarizer Agent',
    serviceName: 'LLM Orchestrator',
    type: 'agent',
    startTime: '2024-03-15T10:00:05.749Z',
    endTime: '2024-03-15T10:00:08.000Z',
    duration: 2151,
    status: 'ok',
    model: 'ollama/gpt-oss:20b',
    tokens: {
      input: 1024,
      output: 512,
      total: 1536
    },
    tags: {
      'agent.type': 'summarizer',
      'llm.temperature': '0.5'
    },
    createdAt: '2024-03-15T10:00:05.749Z',
    updatedAt: '2024-03-15T10:00:08.000Z'
  },
  {
    id: 'span_13',
    traceId: '1',
    parentId: 'span_12',
    operationName: 'POST /v1/responses',
    serviceName: 'OpenAI API',
    type: 'api_request',
    startTime: '2024-03-15T10:00:05.849Z',
    endTime: '2024-03-15T10:00:07.999Z',
    duration: 2150,
    status: 'ok',
    tags: {
      'http.method': 'POST',
      'http.url': '/v1/responses'
    },
    createdAt: '2024-03-15T10:00:05.849Z',
    updatedAt: '2024-03-15T10:00:07.999Z'
  }
];

export const spansService = {
  async getByTraceId(traceId: string): Promise<Span[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    return mockSpans.filter(span => span.traceId === traceId);
  },

  async getById(id: string): Promise<Span | undefined> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockSpans.find(span => span.id === id);
  },

  async create(spanData: CreateSpanRequest): Promise<Span> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newSpan: Span = {
      id: `span-${mockSpans.length + 1}`,
      ...spanData,
      startTime: spanData.startTime ?? new Date().toISOString(),
      endTime: spanData.endTime ?? new Date().toISOString(),
      duration: spanData.duration ?? 1000,
      status: spanData.status ?? 'ok',
      tags: spanData.tags ?? {},
      logs: spanData.logs ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockSpans.push(newSpan);
    return newSpan;
  },

  async update(id: string, updateData: UpdateSpanRequest): Promise<Span> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const spanIndex = mockSpans.findIndex(span => span.id === id);
    if (spanIndex === -1) {
      throw new Error(`Span with id ${id} not found`);
    }
    
    const updatedSpan = {
      ...mockSpans[spanIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    mockSpans[spanIndex] = updatedSpan;
    return updatedSpan;
  },

  async delete(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const spanIndex = mockSpans.findIndex(span => span.id === id);
    if (spanIndex === -1) {
      throw new Error(`Span with id ${id} not found`);
    }
    mockSpans.splice(spanIndex, 1);
  }
};