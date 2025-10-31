// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PostgresStore, BlobStorageStore, type TContext } from './stores.ts';
import type { Store, AttachmentStore } from './chatkit/store.ts';
import type { ThreadMetadata, ThreadStreamEvent } from './chatkit/types.ts';
import { ChatKitServer, StreamingResult } from './chatkit/server.ts';
import { AgentContext, simple_to_agent_input as simpleToAgentInput, stream_agent_response as streamAgentResponse } from './chatkit/agents.ts';
import type { RunConfig } from 'https://esm.sh/@openai/agents-core@0.0.1';

function getSessionForThread(threadId: string) {
  const sessionId = `thread_${threadId}`;
  return { id: sessionId } as unknown as object;
}

class MyChatKitServer extends ChatKitServer {
  constructor(dataStore: Store<TContext>, attachmentStore?: AttachmentStore<TContext> | null) {
    super(dataStore, attachmentStore ?? null);
  }

  // Parity with Python: assistant_agent defined on the class
  readonly assistantAgent = {
    model: 'gpt-4.1',
    name: 'Assistant',
    instructions: 'You are a helpful assistant',
  } as const;

  async *respond(thread: ThreadMetadata, input: any | null, context: TContext): AsyncIterable<ThreadStreamEvent> {
    const agentContext = new AgentContext(thread, this.store, context);

    // Match Python ordering: get session immediately after creating AgentContext
    const session = getPrismaSessionForThread(thread.id);

    const agentInput = await simpleToAgentInput(input);

    // session_input_callback parity: merge history + new items
    const sessionInputCallback = (historyItems: any[], newItems: any[]) => {
      return [...historyItems, ...newItems];
    };

    const runConfig: RunConfig = { sessionInputCallback: sessionInputCallback as any } as unknown as RunConfig;

    // Placeholder for Runner.run_streamed(self.assistant_agent, agent_input, ...)
    const result: AsyncIterable<any> = (async function* () {})();

    for await (const event of streamAgentResponse(agentContext, result)) {
      yield event;
    }
  }
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1];
  return null;
}

function buildContext(req: Request): TContext {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const token = extractBearer(req);
  const client = createClient(supabaseUrl, supabaseKey, { global: { headers: token ? { Authorization: `Bearer ${token}` } : {} } });
  const user_id = req.headers.get('x-user-id') || req.headers.get('X-User-Id') || null;
  return { supabase: client, user_id };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function constructSupabaseDbUrl(): string {
  const explicit = Deno.env.get('SUPABASE_DB_URL');
  if (explicit) return explicit;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL or SUPABASE_DB_URL is required');
  if (supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost')) {
    const dbPassword = Deno.env.get('SUPABASE_DB_PASSWORD') ?? 'postgres';
    return `postgresql://postgres:${dbPassword}@127.0.0.1:54322/postgres`;
  }
  try {
    const u = new URL(supabaseUrl);
    const host = u.hostname;
    const projectRef = host.replace('.supabase.co', '');
    const dbPassword = Deno.env.get('SUPABASE_DB_PASSWORD');
    if (!dbPassword) throw new Error('SUPABASE_DB_PASSWORD is required for cloud Supabase');
    return `postgresql://postgres.${projectRef}:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;
  } catch (e) {
    throw new Error(`Failed to construct DB URL from SUPABASE_URL: ${e}`);
  }
}

function getPrismaSessionForThread(threadId: string) {
  const sessionId = `thread_${threadId}`;
  const dbUrl = constructSupabaseDbUrl();
  // Parity with Python: create (and lazily initialize) session tables
  // API shape may differ; adapt to your PrismaSession implementation as needed.
  // Placeholder for PrismaSession.fromUrl({ sessionId, url, createTables: true })
  return { id: sessionId, url: dbUrl } as unknown as object;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    if (!path.includes('/chatkit')) {
      return new Response(JSON.stringify({ message: 'agent-chat-v2 ChatKit Server' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = new Uint8Array(await req.arrayBuffer());
    const data_store = new PostgresStore();
    const attachment_store = new BlobStorageStore(data_store);
    const server = new MyChatKitServer(data_store, attachment_store);
    const context = buildContext(req);
    const result = await server.process(body, context);
    if (result instanceof StreamingResult) {
      return new Response(result.json_events as ReadableStream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
    }
    return new Response(result.json, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

