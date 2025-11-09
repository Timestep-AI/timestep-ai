// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ChatKitDataStore, type TContext } from '../_shared/stores.ts';
import type { ThreadMetadata } from '../_shared/chatkit/types.ts';

/**
 * Extract bearer token from request headers
 */
function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1];
  return null;
}

/**
 * Decode JWT token to extract user ID
 */
function decodeJwtSub(jwtToken: string): string | null {
  try {
    const parts = jwtToken.split('.');
    if (parts.length < 2) return null;
    const payloadB64 = parts[1];
    // Base64url decode with padding
    const padding = '='.repeat((-payloadB64.length % 4 + 4) % 4);
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/') + padding);
    const payload = JSON.parse(payloadJson);
    return payload.sub || payload.user_id || null;
  } catch {
    return null;
  }
}

/**
 * Build request context from request headers
 */
function buildRequestContext(request: Request): TContext {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }
  const token = extractBearerToken(request);
  const client = createClient(supabaseUrl, supabaseKey, { 
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} } 
  });
  // Apply per-request RLS via JWT if present
  if (token && client.postgrest) {
    (client.postgrest as any).auth(token);
  }
  
  let user_id = request.headers.get('x-user-id') || request.headers.get('X-User-Id') || null;
  if (!user_id && token) {
    user_id = decodeJwtSub(token);
  }
  
  return { supabase: client, user_id, user_jwt: token };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

// Initialize data store
const data_store = new ChatKitDataStore();

Deno.serve(async (request: Request) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle /threads/list endpoint
    if (path === '/threads/list' || path.endsWith('/threads/list')) {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const after = url.searchParams.get('after') || null;
      const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';

      const ctx = buildRequestContext(request);
      const page = await data_store.load_threads(limit, after, order, ctx);

      // Convert ThreadMetadata to JSON-friendly dicts (matching Python implementation)
      const jsonData = page.data.map((t: ThreadMetadata) => {
        let statusValue = t.status;
        if (!statusValue || typeof statusValue !== 'object') {
          if (statusValue && typeof statusValue === 'object' && 'type' in statusValue) {
            statusValue = { type: (statusValue as any).type };
          } else {
            statusValue = { type: 'active' as const };
          }
        }

        return {
          id: t.id,
          title: t.title,
          created_at: Math.floor((t.created_at instanceof Date ? t.created_at : new Date(t.created_at)).getTime() / 1000),
          status: statusValue,
          metadata: t.metadata || {},
        };
      });

      return new Response(
        JSON.stringify({
          data: jsonData,
          has_more: page.has_more,
          after: page.after,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Default response for unknown paths
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[threads] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        detail: error && typeof error === 'object' && 'message' in error ? String((error as any).message) : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
