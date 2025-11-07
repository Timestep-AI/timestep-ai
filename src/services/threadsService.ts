import { getBackendBaseUrl, type BackendType } from '@/services/backendConfig';
import { supabase } from '@/integrations/supabase/client';
import type { ThreadListResponse } from '@/types/thread';

class ThreadsService {
  private async getAuthHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('No valid session found. Please sign in.');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  async listThreads(
    backendType: BackendType,
    limit: number = 20,
    after: string | null = null,
    order: 'asc' | 'desc' = 'desc'
  ): Promise<ThreadListResponse> {
    const baseUrl = getBackendBaseUrl(backendType);
    const authHeaders = await this.getAuthHeaders();

    const params = new URLSearchParams({
      limit: limit.toString(),
      order,
    });
    if (after) {
      params.append('after', after);
    }

    const response = await fetch(`${baseUrl}/threads/list?${params.toString()}`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch threads: ${errorText}`);
    }

    return response.json();
  }
}

export const threadsService = new ThreadsService();

