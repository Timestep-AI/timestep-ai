import { Span, CreateSpanRequest, UpdateSpanRequest } from '@/types/trace';

// Mock data for spans
const mockSpans: Span[] = [
  // Spans for trace 1 (User Login Flow)
  {
    id: 'span-1',
    traceId: '1',
    operationName: 'user.login',
    serviceName: 'auth-service',
    startTime: '2024-01-12T10:30:00Z',
    endTime: '2024-01-12T10:30:02.450Z',
    duration: 2450,
    status: 'ok',
    tags: {
      'user.id': '12345',
      'http.method': 'POST',
      'http.url': '/api/login'
    },
    logs: [
      {
        timestamp: '2024-01-12T10:30:00.100Z',
        message: 'Starting user authentication',
        level: 'info'
      },
      {
        timestamp: '2024-01-12T10:30:02.400Z',
        message: 'User authenticated successfully',
        level: 'info'
      }
    ],
    createdAt: '2024-01-12T10:30:00Z',
    updatedAt: '2024-01-12T10:30:02.450Z'
  },
  {
    id: 'span-2',
    traceId: '1',
    parentId: 'span-1',
    operationName: 'db.user_lookup',
    serviceName: 'database-service',
    startTime: '2024-01-12T10:30:00.200Z',
    endTime: '2024-01-12T10:30:01.100Z',
    duration: 900,
    status: 'ok',
    tags: {
      'db.type': 'postgresql',
      'db.statement': 'SELECT * FROM users WHERE email = ?'
    },
    createdAt: '2024-01-12T10:30:00.200Z',
    updatedAt: '2024-01-12T10:30:01.100Z'
  },
  {
    id: 'span-3',
    traceId: '1',
    parentId: 'span-1',
    operationName: 'jwt.generate',
    serviceName: 'auth-service',
    startTime: '2024-01-12T10:30:01.200Z',
    endTime: '2024-01-12T10:30:02.000Z',
    duration: 800,
    status: 'ok',
    tags: {
      'jwt.algorithm': 'RS256',
      'jwt.expires': '3600'
    },
    createdAt: '2024-01-12T10:30:01.200Z',
    updatedAt: '2024-01-12T10:30:02.000Z'
  },
  
  // Spans for trace 2 (API Data Fetch)
  {
    id: 'span-9',
    traceId: '2',
    operationName: 'api.fetch_data',
    serviceName: 'api-gateway',
    startTime: '2024-01-12T11:15:00Z',
    endTime: '2024-01-12T11:15:01.200Z',
    duration: 1200,
    status: 'error',
    tags: {
      'http.method': 'GET',
      'http.url': '/api/data',
      'error': 'true'
    },
    logs: [
      {
        timestamp: '2024-01-12T11:15:00.050Z',
        message: 'Starting data fetch operation',
        level: 'info'
      },
      {
        timestamp: '2024-01-12T11:15:01.150Z',
        message: 'Database connection timeout',
        level: 'error'
      }
    ],
    createdAt: '2024-01-12T11:15:00Z',
    updatedAt: '2024-01-12T11:15:01.200Z'
  },
  {
    id: 'span-10',
    traceId: '2',
    parentId: 'span-9',
    operationName: 'db.query',
    serviceName: 'database-service',
    startTime: '2024-01-12T11:15:00.100Z',
    endTime: '2024-01-12T11:15:01.100Z',
    duration: 1000,
    status: 'error',
    tags: {
      'db.type': 'postgresql',
      'db.statement': 'SELECT * FROM analytics_data WHERE date >= ?',
      'error': 'true'
    },
    logs: [
      {
        timestamp: '2024-01-12T11:15:01.050Z',
        message: 'Connection timeout after 1000ms',
        level: 'error'
      }
    ],
    createdAt: '2024-01-12T11:15:00.100Z',
    updatedAt: '2024-01-12T11:15:01.100Z'
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