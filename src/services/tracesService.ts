import { Trace, CreateTraceRequest, UpdateTraceRequest } from '@/types/trace';
import { supabase } from '@/integrations/supabase/client';

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
  };
};

export const tracesService = {
  async getAll(): Promise<Trace[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/traces`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch traces: ${response.statusText}`);
      }
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching traces:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Trace | undefined> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/traces/${id}`, { headers });
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
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/traces`, {
        method: 'POST',
        headers,
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
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/traces/${id}`, {
        method: 'PUT',
        headers,
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
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/traces/${id}`, {
        method: 'DELETE',
        headers,
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
      const headers = await getAuthHeaders();
      const response = await fetch(`${SERVER_BASE_URL}/traces`, {
        method: 'DELETE',
        headers,
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