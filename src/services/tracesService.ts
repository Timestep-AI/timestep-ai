import { Trace, CreateTraceRequest, UpdateTraceRequest } from '@/types/trace';

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

export const tracesService = {
  async getAll(): Promise<Trace[]> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/traces`);
      if (!response.ok) {
        throw new Error(`Failed to fetch traces: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error fetching traces:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Trace | undefined> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/traces/${id}`);
      if (response.status === 404) {
        return undefined;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch trace: ${response.statusText}`);
      }
      const trace = await response.json();
      return trace;
    } catch (error) {
      console.error('Error fetching trace:', error);
      throw error;
    }
  },

  async create(traceData: CreateTraceRequest): Promise<Trace> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(traceData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create trace: ${response.statusText}`);
      }
      
      const trace = await response.json();
      return trace;
    } catch (error) {
      console.error('Error creating trace:', error);
      throw error;
    }
  },

  async update(id: string, updateData: UpdateTraceRequest): Promise<Trace> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/traces/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update trace: ${response.statusText}`);
      }
      
      const trace = await response.json();
      return trace;
    } catch (error) {
      console.error('Error updating trace:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/traces/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete trace: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting trace:', error);
      throw error;
    }
  },

  async deleteAll(): Promise<void> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/traces`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete all traces: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting all traces:', error);
      throw error;
    }
  }
};