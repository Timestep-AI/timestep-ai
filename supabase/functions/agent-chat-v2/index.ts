// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { setDefaultOpenAIKey, setDefaultOpenAITracingExporter } from '@openai/agents-openai';
// Import OpenAIConversationsSession from local copy since it might not be in npm yet
// TODO: Replace with '@openai/agents-openai/memory' when published
import { OpenAIConversationsSession } from './@openai/agents-openai/memory/openaiConversationsSession.ts';

// Configure OpenAI API key and tracing exporter
// This must be called before any agents-core usage
const DEFAULT_OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
if (DEFAULT_OPENAI_API_KEY) {
  setDefaultOpenAIKey(DEFAULT_OPENAI_API_KEY);
}

// Configure HTTP exporter to send traces to OpenAI's servers
setDefaultOpenAITracingExporter();
import { PostgresStore, BlobStorageStore, type TContext } from './stores.ts';
import type { Store, AttachmentStore } from './chatkit/store.ts';
import type { ThreadMetadata, ThreadStreamEvent, UserMessageItem } from './chatkit/types.ts';
import { ChatKitServer, StreamingResult } from './chatkit/server.ts';
import { AgentContext, simple_to_agent_input as simpleToAgentInput, stream_agent_response as streamAgentResponse } from './chatkit/agents.ts';
import { Agent, Runner } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';
import OpenAI from 'openai';
import type { RunConfig } from '@openai/agents-core';

// Interface for agent record from database
interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  instructions: string;
  tool_ids: string[];
  handoff_ids: string[];
  model: string | null;
  model_settings: any;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Load an agent from the database by ID
 * Matches Python implementation: queries agents table with RLS
 */
async function loadAgentFromDatabase(agentId: string, ctx: TContext): Promise<Agent> {
  if (!ctx.user_id) {
    throw new Error('user_id is required to load agents');
  }
  
  const { data: agentData, error } = await ctx.supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('user_id', ctx.user_id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      throw new Error(`Agent not found: ${agentId}`);
    }
    console.error('[agent-chat-v2] Error fetching agent:', error);
    throw new Error(`Failed to load agent: ${error.message}`);
  }
  
  if (!agentData) {
    throw new Error(`Agent not found: ${agentId}`);
  }
  
  const agentRecord = agentData as AgentRecord;
  
  // Create Agent from database record
  // Use model from database, fallback to 'gpt-4o' if not set
  const model = agentRecord.model || 'gpt-4o';
  
  return new Agent({
    model: model,
    name: agentRecord.name,
    instructions: agentRecord.instructions,
  });
}

function getSessionForThread(threadId: string, ctx: TContext): OpenAIConversationsSession {
  /**Create or get an OpenAIConversationsSession for a given thread.
  
  Points to the openai-polyfill Conversations API using the request's JWT.
  Matches Python version: OpenAIConversationsSession(conversation_id=thread_id, openai_client=client)
  */
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required');
  }
  const baseUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/openai-polyfill`;
  const apiKey = ctx.user_jwt || 'anonymous';
  const client = new OpenAI({
    baseURL: baseUrl,
    apiKey: apiKey,
  });
  // Use a stable conversation_id per thread to retain history
  // Return an actual OpenAIConversationsSession instance that implements Session
  return new OpenAIConversationsSession({
    conversationId: threadId,
    client: client,
  });
}

class MyChatKitServer extends ChatKitServer {
  constructor(dataStore: Store<TContext>, attachmentStore?: AttachmentStore<TContext> | null) {
    super(dataStore, attachmentStore ?? null);
  }


  async *respond(
    thread: ThreadMetadata,
    input: UserMessageItem | null,
    context: TContext
  ): AsyncIterable<ThreadStreamEvent> {
    const agentContext = new AgentContext(thread, this.store, context);
    
    // Load agent from database using agent_id from context
    // agent_id is required - no fallbacks
    if (!context.agent_id) {
      throw new Error('agent_id is required in context');
    }
    
    const agent = await loadAgentFromDatabase(context.agent_id, context);
    
    // Create Conversations session bound to polyfill with per-request JWT
    const session = getSessionForThread(thread.id, context);
    await session.getSessionId();
    
    // Fetch existing history from session and merge with new input
    // The JavaScript Runner may not automatically fetch history, so we do it manually
    let historyItems: any[] = [];
    try {
      historyItems = await session.getItems();
    } catch (error) {
      console.error('[agent-chat-v2] Error fetching history:', error);
    }
    
    // Convert input to agent format
    const newAgentInput = await simpleToAgentInput(input);
    
    // Sanitize function to remove fields that OpenAI Responses API doesn't accept
    function sanitizeItem(item: any): any {
      if (item && typeof item === 'object') {
        // Keep only role and content, remove id, type, created_at, etc.
        return {
          role: item.role,
          content: item.content,
        };
      }
      return item;
    }
    
    // Sanitize history items (they come from the conversation API with extra fields)
    const sanitizedHistory = historyItems.map(sanitizeItem);
    // New items should already be clean, but sanitize them too just in case
    const sanitizedNew = newAgentInput.map(sanitizeItem);
    
    // Merge history with new input
    const agentInput = [...sanitizedHistory, ...sanitizedNew];
    
    // When using session memory with list inputs, we need to provide a callback
    // that defines how to merge history items with new items.
    // The session automatically saves items after the run completes.
    function sessionInputCallback(historyItems: any[], newItems: any[]): any[] {
      // Sanitize history items (they come from the conversation API with extra fields)
      const sanitizedHistory = historyItems.map(sanitizeItem);
      // New items should already be clean, but sanitize them too just in case
      const sanitizedNew = newItems.map(sanitizeItem);
      
      return [...sanitizedHistory, ...sanitizedNew];
    }
    
    // Match Python: Runner.run_streamed(agent, agent_input, context=agent_context, session=session, run_config=run_config)
    // The session contains the OpenAI client configured to use the polyfill for conversation history
    // The Runner uses the multi-provider for actual model calls
    // Create RunConfig with session_input_callback
    const runConfig: RunConfig = {
      sessionInputCallback: sessionInputCallback as any,
      traceIncludeSensitiveData: true,
      tracingDisabled: false, // Enable tracing with setDefaultOpenAITracingExporter()
    } as RunConfig;
    
    // Create Runner with multi-provider support
    // Match agent-chat implementation - wire up multi-provider directly
    let runner: Runner;
    try {
      // Dynamically import multi-provider components only when needed
      const { OllamaModelProvider } = await import('./utils/ollama_model_provider.ts');
      const { MultiModelProvider, MultiModelProviderMap } = await import('./utils/multi_model_provider.ts');

      const modelProviderMap = new MultiModelProviderMap();

      // Add Anthropic provider using OpenAI interface
      if (Deno.env.get('ANTHROPIC_API_KEY')) {
        modelProviderMap.addProvider(
          'anthropic',
          new OpenAIProvider({
            apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
            baseURL: 'https://api.anthropic.com/v1/',
            useResponses: false,
          })
        );
      }

      if (Deno.env.get('HF_TOKEN')) {
        modelProviderMap.addProvider(
          'hf_inference_endpoints',
          new OpenAIProvider({
            apiKey: Deno.env.get('HF_TOKEN'),
            baseURL: 'https://bb8igs5dnyzb8gu1.us-east-1.aws.endpoints.huggingface.cloud/v1/',
            useResponses: false,
          })
        );

        modelProviderMap.addProvider(
          'hf_inference_providers',
          new OpenAIProvider({
            apiKey: Deno.env.get('HF_TOKEN'),
            baseURL: 'https://router.huggingface.co/v1',
            useResponses: false,
          })
        );
      }

      if (Deno.env.get('OLLAMA_API_KEY')) {
        modelProviderMap.addProvider(
          'ollama',
          new OllamaModelProvider({
            apiKey: Deno.env.get('OLLAMA_API_KEY'),
          })
        );
      }

      // Use MultiModelProvider for model selection - it will delegate to OpenAIProvider by default
      const modelProvider = new MultiModelProvider({
        provider_map: modelProviderMap,
        openai_api_key: DEFAULT_OPENAI_API_KEY || '',
        openai_use_responses: false,
      });
      
      runner = new Runner({
        modelProvider: modelProvider,
        traceIncludeSensitiveData: true,
        tracingDisabled: false, // Enable tracing with setDefaultOpenAITracingExporter()
        groupId: thread.id,
        metadata: { user_id: context.user_id || 'anonymous' },
      } as any);
    } catch (error) {
      console.error('[agent-chat-v2] Error creating Runner:', error);
      throw error;
    }
    
    // Match Python: Runner.run_streamed returns an AsyncIterator directly
    // In JavaScript, runner.run() with stream: true returns the stream directly
    // Use the dynamically loaded agent instead of hardcoded this.assistantAgent
    try {
      const result = await runner.run(agent, agentInput, {
        context: agentContext,
        stream: true,
        session: session,
        runConfig: runConfig,
      });
      
      // The result is the stream itself (as AsyncIterable)
      for await (const event of streamAgentResponse(agentContext, result as AsyncIterable<any>)) {
        yield event;
      }
      
      // After the run completes, ensure session items are saved
      // The Runner should automatically save items via session.addItems()
      // But we need to manually save the new input to the session
      try {
        // Save the new user input to session
        const itemsToSave = [...newAgentInput];
        if (itemsToSave.length > 0) {
          // Only save if items aren't already in history
          const currentHistory = await session.getItems();
          const existingIds = new Set(currentHistory.map((item: any) => item.id).filter(Boolean));
          const newItemsToSave = itemsToSave.filter((item: any) => !existingIds.has(item.id));
          if (newItemsToSave.length > 0) {
            await session.addItems(newItemsToSave);
          }
        }
      } catch (error) {
        console.error('[agent-chat-v2] Error saving items to session:', error);
      }
    } catch (error) {
      console.error('[agent-chat-v2] Error in runner.run():', error);
      throw error;
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
const data_store = new PostgresStore();
const attachment_store = new BlobStorageStore(data_store);
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
    const chatkitMatch = path.match(/\/agents\/([^\/]+)\/chatkit/);
    if (chatkitMatch) {
      const agentId = chatkitMatch[1];
      // Build context with agent_id included
      const ctx = buildRequestContext(request, agentId);
      const body = new Uint8Array(await request.arrayBuffer());
      const result = await server.process(body, ctx);
      if (result instanceof StreamingResult) {
        return new Response(result.json_events as ReadableStream, {
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
            statusValue = { type: String(statusValue || 'active') };
          }
        }

        return {
          id: t.id,
          title: t.title || 'New Chat',
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

    // Handle /agents proxy endpoint (GET and POST)
    if (path === '/agents' || path.endsWith('/agents')) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL is required');
      }

      // Forward relevant headers for anonymous auth support
      const headersToForward: Record<string, string> = {};

      const ctx = buildRequestContext(request);
      // Use JWT from context if available
      if (ctx.user_jwt) {
        if (!ctx.user_jwt.startsWith('Bearer ')) {
          headersToForward['Authorization'] = `Bearer ${ctx.user_jwt}`;
        } else {
          headersToForward['Authorization'] = ctx.user_jwt;
        }
      } else {
        // Fallback to request headers
        const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
        if (authHeader) {
          headersToForward['Authorization'] = authHeader;
        }
      }

      // Include apikey header (required for Supabase functions)
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (supabaseAnonKey) {
        headersToForward['apikey'] = supabaseAnonKey;
      }

      // Forward other headers that might be needed
      for (const headerName of ['x-client-info', 'content-type']) {
        const headerValue = request.headers.get(headerName) || request.headers.get(headerName.replace('-', '_'));
        if (headerValue) {
          headersToForward[headerName] = headerValue;
        }
      }

      // Get request body if present (for POST requests)
      let body: any = null;
      if (request.method === 'POST') {
        try {
          const bodyBytes = await request.arrayBuffer();
          if (bodyBytes.byteLength > 0) {
            const text = new TextDecoder().decode(bodyBytes);
            body = JSON.parse(text);
          }
        } catch {
          // If body is not JSON, skip
        }
      }

      // The edge function only handles GET requests for /agents
      // Convert POST to GET if needed
      const methodToUse = request.method === 'POST' ? 'GET' : request.method;

      const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/agent-chat/agents`;

      // Make direct HTTP request to edge function
      const response = await fetch(functionUrl, {
        method: methodToUse,
        headers: headersToForward,
        body: body && methodToUse !== 'GET' ? JSON.stringify(body) : undefined,
      });

      const responseContent = await response.arrayBuffer();
      const mediaType = response.headers.get('content-type') || 'application/json';

      // Log error responses for debugging
      if (response.status >= 400) {
        try {
          const errorBody = new TextDecoder().decode(responseContent);
          console.error(`Edge function returned ${response.status}: ${errorBody}`);
        } catch {
          // Ignore decode errors
        }
      }

      // Return response with proper headers
      return new Response(responseContent, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': mediaType,
        },
      });
    }

    // Default response for root path
    return new Response(
      JSON.stringify({ message: 'agent-chat-v2 ChatKit Server' }),
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
    console.error('Error in agent-chat-v2:', e);
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

