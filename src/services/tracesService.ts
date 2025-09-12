import { Trace, CreateTraceRequest, UpdateTraceRequest } from '@/types/trace';

// Mock data for traces - LLM orchestration focused
const mockTraces: Trace[] = [
  {
    id: '1',
    name: 'Insurance Claim Processing',
    rootSpanId: 'span_1',
    serviceCount: 3,
    spanCount: 13,
    startTime: '2024-03-15T10:00:00.000Z',
    endTime: '2024-03-15T10:00:08.000Z',
    duration: 8000,
    status: 'ok',
    errorCount: 0,
    createdAt: '2024-03-15T10:00:00.000Z',
    updatedAt: '2024-03-15T10:00:08.000Z'
  },
  {
    id: '2',
    name: 'Customer Support Workflow',
    rootSpanId: 'span_14',
    serviceCount: 2,
    spanCount: 8,
    startTime: '2024-03-15T11:15:00Z',
    endTime: '2024-03-15T11:15:03.200Z',
    duration: 3200,
    status: 'error',
    errorCount: 1,
    createdAt: '2024-03-15T11:15:00Z',
    updatedAt: '2024-03-15T11:15:03.200Z'
  },
  {
    id: '3',
    name: 'Document Analysis Pipeline',
    rootSpanId: 'span_22',
    serviceCount: 4,
    spanCount: 15,
    startTime: '2024-03-15T12:00:00Z',
    endTime: '2024-03-15T12:00:12.800Z',
    duration: 12800,
    status: 'ok',
    errorCount: 0,
    createdAt: '2024-03-15T12:00:00Z',
    updatedAt: '2024-03-15T12:00:12.800Z'
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
        name: 'Insurance Claim Processing',
        rootSpanId: 'span_1',
        serviceCount: 3,
        spanCount: 13,
        startTime: '2024-03-15T10:00:00.000Z',
        endTime: '2024-03-15T10:00:08.000Z',
        duration: 8000,
        status: 'ok' as const,
        errorCount: 0,
        createdAt: '2024-03-15T10:00:00.000Z',
        updatedAt: '2024-03-15T10:00:08.000Z'
      },
      {
        id: '2',
        name: 'Customer Support Workflow',
        rootSpanId: 'span_14',
        serviceCount: 2,
        spanCount: 8,
        startTime: '2024-03-15T11:15:00Z',
        endTime: '2024-03-15T11:15:03.200Z',
        duration: 3200,
        status: 'error' as const,
        errorCount: 1,
        createdAt: '2024-03-15T11:15:00Z',
        updatedAt: '2024-03-15T11:15:03.200Z'
      },
      {
        id: '3',
        name: 'Document Analysis Pipeline',
        rootSpanId: 'span_22',
        serviceCount: 4,
        spanCount: 15,
        startTime: '2024-03-15T12:00:00Z',
        endTime: '2024-03-15T12:00:12.800Z',
        duration: 12800,
        status: 'ok' as const,
        errorCount: 0,
        createdAt: '2024-03-15T12:00:00Z',
        updatedAt: '2024-03-15T12:00:12.800Z'
      }
    ]);
    return mockTraces;
  }
};