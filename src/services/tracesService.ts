import { Trace, CreateTraceRequest, UpdateTraceRequest } from '@/types/trace';

// Mock data for traces
const mockTraces: Trace[] = [
  {
    id: '1',
    name: 'User Login Flow',
    rootSpanId: 'span-1',
    serviceCount: 3,
    spanCount: 8,
    startTime: '2024-01-12T10:30:00Z',
    endTime: '2024-01-12T10:30:02.450Z',
    duration: 2450,
    status: 'ok',
    errorCount: 0,
    createdAt: '2024-01-12T10:30:00Z',
    updatedAt: '2024-01-12T10:30:02.450Z'
  },
  {
    id: '2',
    name: 'API Data Fetch',
    rootSpanId: 'span-9',
    serviceCount: 5,
    spanCount: 15,
    startTime: '2024-01-12T11:15:00Z',
    endTime: '2024-01-12T11:15:01.200Z',
    duration: 1200,
    status: 'error',
    errorCount: 2,
    createdAt: '2024-01-12T11:15:00Z',
    updatedAt: '2024-01-12T11:15:01.200Z'
  },
  {
    id: '3',
    name: 'Background Job Processing',
    rootSpanId: 'span-24',
    serviceCount: 2,
    spanCount: 12,
    startTime: '2024-01-12T12:00:00Z',
    endTime: '2024-01-12T12:00:05.800Z',
    duration: 5800,
    status: 'ok',
    errorCount: 0,
    createdAt: '2024-01-12T12:00:00Z',
    updatedAt: '2024-01-12T12:00:05.800Z'
  },
  {
    id: '4',
    name: 'Database Migration',
    rootSpanId: 'span-36',
    serviceCount: 1,
    spanCount: 25,
    startTime: '2024-01-12T09:45:00Z',
    endTime: '2024-01-12T09:47:30.500Z',
    duration: 150500,
    status: 'timeout',
    errorCount: 1,
    createdAt: '2024-01-12T09:45:00Z',
    updatedAt: '2024-01-12T09:47:30.500Z'
  },
  {
    id: '5',
    name: 'Real-time Notification',
    rootSpanId: 'span-61',
    serviceCount: 4,
    spanCount: 6,
    startTime: '2024-01-12T14:20:00Z',
    endTime: '2024-01-12T14:20:00.850Z',
    duration: 850,
    status: 'ok',
    errorCount: 0,
    createdAt: '2024-01-12T14:20:00Z',
    updatedAt: '2024-01-12T14:20:00.850Z'
  }
];

export const tracesService = {
  async getAll(): Promise<Trace[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockTraces;
  },

  async getById(id: string): Promise<Trace | undefined> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockTraces.find(trace => trace.id === id);
  },

  async create(traceData: CreateTraceRequest): Promise<Trace> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newTrace: Trace = {
      id: (mockTraces.length + 1).toString(),
      ...traceData,
      serviceCount: traceData.serviceCount ?? 1,
      spanCount: traceData.spanCount ?? 1,
      startTime: traceData.startTime ?? new Date().toISOString(),
      endTime: traceData.endTime ?? new Date().toISOString(),
      duration: traceData.duration ?? 1000,
      status: traceData.status ?? 'ok',
      errorCount: traceData.errorCount ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockTraces.push(newTrace);
    return newTrace;
  },

  async update(id: string, updateData: UpdateTraceRequest): Promise<Trace> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const traceIndex = mockTraces.findIndex(trace => trace.id === id);
    if (traceIndex === -1) {
      throw new Error(`Trace with id ${id} not found`);
    }
    
    const updatedTrace = {
      ...mockTraces[traceIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    mockTraces[traceIndex] = updatedTrace;
    return updatedTrace;
  },

  async delete(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const traceIndex = mockTraces.findIndex(trace => trace.id === id);
    if (traceIndex === -1) {
      throw new Error(`Trace with id ${id} not found`);
    }
    mockTraces.splice(traceIndex, 1);
  },

  async deleteAll(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    mockTraces.splice(0, mockTraces.length);
  },

  async createDefaults(): Promise<Trace[]> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Reset to default traces
    mockTraces.splice(0, mockTraces.length);
    mockTraces.push(...[
      {
        id: '1',
        name: 'User Login Flow',
        rootSpanId: 'span-1',
        serviceCount: 3,
        spanCount: 8,
        startTime: '2024-01-12T10:30:00Z',
        endTime: '2024-01-12T10:30:02.450Z',
        duration: 2450,
        status: 'ok' as const,
        errorCount: 0,
        createdAt: '2024-01-12T10:30:00Z',
        updatedAt: '2024-01-12T10:30:02.450Z'
      },
      {
        id: '2',
        name: 'API Data Fetch',
        rootSpanId: 'span-9',
        serviceCount: 5,
        spanCount: 15,
        startTime: '2024-01-12T11:15:00Z',
        endTime: '2024-01-12T11:15:01.200Z',
        duration: 1200,
        status: 'error' as const,
        errorCount: 2,
        createdAt: '2024-01-12T11:15:00Z',
        updatedAt: '2024-01-12T11:15:01.200Z'
      }
    ]);
    return mockTraces;
  }
};