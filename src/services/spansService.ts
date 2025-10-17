import { Span, CreateSpanRequest, UpdateSpanRequest } from '@/types/trace';

// Real spans service - no mock data
export const spansService = {
  async getSpansByTraceId(traceId: string): Promise<Span[]> {
    throw new Error('Spans service not implemented - requires real trace integration');
  },

  async getSpanById(id: string): Promise<Span | null> {
    throw new Error('Spans service not implemented - requires real trace integration');
  },

  async createSpan(request: CreateSpanRequest): Promise<Span> {
    throw new Error('Spans service not implemented - requires real trace integration');
  },

  async updateSpan(id: string, request: UpdateSpanRequest): Promise<Span> {
    throw new Error('Spans service not implemented - requires real trace integration');
  },

  async deleteSpan(id: string): Promise<void> {
    throw new Error('Spans service not implemented - requires real trace integration');
  }
};