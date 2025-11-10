// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { setDefaultOpenAIKey, setDefaultOpenAITracingExporter } from '@openai/agents-openai';

// Configure OpenAI API key and tracing exporter
// This must be called before any agents-core usage
const DEFAULT_OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
if (DEFAULT_OPENAI_API_KEY) {
  setDefaultOpenAIKey(DEFAULT_OPENAI_API_KEY);
}

// Configure HTTP exporter to send traces to OpenAI's servers
setDefaultOpenAITracingExporter();
import { ChatKitDataStore, ChatKitAttachmentStore, type TContext } from '../_shared/stores.ts';
import { StreamingResult } from '../_shared/chatkit/server.ts';
import { MyChatKitServer, getAgentById } from './chatkit_server.ts';

/**
 * Ensure default agents exist for the user
 * Matches Python ensure_default_agents_exist implementation
 */
async function ensureDefaultAgentsExist(ctx: TContext): Promise<void> {
  if (!ctx.user_id) {
    return;
  }
  
  const defaultModel = Deno.env.get('DEFAULT_AGENT_MODEL') || 'gpt-4o';
  const defaultModelSettings = {
    temperature: 0.0,
    toolChoice: 'auto',
    reasoning: { effort: null }
  };
  
  // Default Personal Assistant
  const personalAssistantId = '00000000-0000-0000-0000-000000000000';
  if (!(await getAgentById(personalAssistantId, ctx))) {
    const { error } = await ctx.supabase.from('agents').insert({
      id: personalAssistantId,
      user_id: ctx.user_id,
      name: 'Personal Assistant',
      instructions: `# System context
You are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstraction: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named \`transfer_to_<agent_name>\`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.
You are an AI agent acting as a personal assistant.`,
      tool_ids: ['00000000-0000-0000-0000-000000000000.think'],
      handoff_ids: ['ffffffff-ffff-ffff-ffff-ffffffffffff'],
      model: defaultModel,
      model_settings: defaultModelSettings,
    });
    
    // Ignore duplicate key errors
    if (error && error.code !== '23505') {
      console.warn('[agents] Error creating default Personal Assistant:', error);
    }
  }
  
  // Default Weather Assistant
  const weatherAssistantId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  if (!(await getAgentById(weatherAssistantId, ctx))) {
    const { error } = await ctx.supabase.from('agents').insert({
      id: weatherAssistantId,
      user_id: ctx.user_id,
      name: 'Weather Assistant',
      instructions: 'You are a helpful AI assistant that can answer questions about weather. When asked about weather, you MUST use the get_weather tool to get accurate, real-time weather information.',
      tool_ids: [
        '00000000-0000-0000-0000-000000000000.get_weather',
        '00000000-0000-0000-0000-000000000000.think',
      ],
      handoff_ids: [],
      model: defaultModel,
      model_settings: defaultModelSettings,
    });
    
    // Ignore duplicate key errors
    if (error && error.code !== '23505') {
      console.warn('[agents] Error creating default Weather Assistant:', error);
    }
  }
}


function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1];
  return null;
}

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

function buildRequestContext(request: Request, agentId?: string | null): TContext {
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
  
  return { supabase: client, user_id, user_jwt: token, agent_id: agentId || null };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

// Initialize stores and server
const data_store = new ChatKitDataStore();
const attachment_store = new ChatKitAttachmentStore(data_store);
const server = new MyChatKitServer(data_store, attachment_store);

Deno.serve(async (request: Request) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle /agents/{agent_id}/chatkit endpoint
    const chatkitMatch = path.match(/\/agents\/([^/]+)\/chatkit/);
    if (chatkitMatch) {
      const agentId = chatkitMatch[1];
      console.log('[agents] Processing chatkit request for agent:', agentId);
      // Build context with agent_id included
      const ctx = buildRequestContext(request, agentId);
      console.log('[agents] Context built:', { user_id: ctx.user_id, agent_id: ctx.agent_id });
      const body = new Uint8Array(await request.arrayBuffer());
      console.log('[agents] Body received, calling server.process');
      const result = await server.process(body, ctx);
      console.log('[agents] server.process completed, result type:', result instanceof StreamingResult ? 'StreamingResult' : 'other');
      if (result instanceof StreamingResult) {
        console.log('[agents] Creating ReadableStream from result.json_events');
        // Convert AsyncIterable<Uint8Array> to ReadableStream
        const stream = new ReadableStream({
          async start(controller) {
            console.log('[agents] ReadableStream start() called');
            try {
              console.log('[agents] Beginning to iterate through json_events');
              for await (const chunk of result.json_events) {
                console.log('[agents] Got chunk from json_events, length:', chunk.length);
                controller.enqueue(chunk);
              }
              console.log('[agents] Finished iterating through json_events, closing stream');
              controller.close();
            } catch (error) {
              console.error('[agents] Error in ReadableStream:', error);
              controller.error(error);
            }
          },
        });
        console.log('[agents] Returning Response with stream');
        return new Response(stream, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        return new Response(result.json, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // Handle /agents endpoint (GET and POST)
    if (path === '/agents' || path.endsWith('/agents')) {
      const ctx = buildRequestContext(request);
      
      if (!ctx.user_id) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      try {
        // Ensure default agents exist first
        await ensureDefaultAgentsExist(ctx);

        // Fetch all agents for the user
        const { data: agents, error } = await ctx.supabase
          .from('agents')
          .select('*')
          .eq('user_id', ctx.user_id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('[agents] Error fetching agents:', error);
          throw new Error(`Failed to fetch agents: ${error.message}`);
        }

        return new Response(
          JSON.stringify(agents || []),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        console.error('[agents] Error in /agents endpoint:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch agents',
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
    }

    // Default response for root path
    return new Response(
      JSON.stringify({ message: 'agents ChatKit Server' }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : String(e);
    const detail = e && typeof e === 'object' && 'stack' in e ? String((e as any).stack) : undefined;
    console.error('Error in agents:', e);
    return new Response(
      JSON.stringify({
        error: msg,
        detail: detail,
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

