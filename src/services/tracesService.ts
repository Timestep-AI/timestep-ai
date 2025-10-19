import { supabase } from '@/integrations/supabase/client';

export interface Trace {
  id: string;
  user_id: string;
  thread_id: string | null;
  name: string;
  status: string;
  duration_ms: number;
  metadata: any;
  created_at: string;
  updated_at?: string;
}

export interface Span {
  id: string;
  trace_id: string;
  parent_span_id: string | null;
  user_id: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  name: string;
  kind: string;
  status: string;
  status_message: string | null;
  attributes: any;
  events: any[];
  links: any[];
  created_at: string;
}

export interface TracesResponse {
  traces: Trace[];
  total: number;
  limit: number;
  offset: number;
}

export interface TraceDetailResponse {
  trace: Trace;
  spans: Span[];
}

export class TracesService {
  private static getServerBaseUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ohzbghitbjryfpmucgju.supabase.co";
    return `${supabaseUrl}/functions/v1/agent-chat`;
  }

  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`
    };
  }

  static async getTraces(limit: number = 50, offset: number = 0): Promise<TracesResponse> {
    const auth = await this.getAuthHeaders();
    const url = `${this.getServerBaseUrl()}/traces?limit=${limit}&offset=${offset}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...auth,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch traces: ${response.statusText}`);
    }

    return await response.json();
  }

  static async getTraceDetail(traceId: string): Promise<TraceDetailResponse> {
    const auth = await this.getAuthHeaders();
    const url = `${this.getServerBaseUrl()}/traces?traceId=${traceId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...auth,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trace detail: ${response.statusText}`);
    }

    return await response.json();
  }
}
