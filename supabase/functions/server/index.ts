import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ChatKitServer, streamAgentResponse } from './apis/chatkit_api.ts'
import { MemoryStore } from './stores/memory_store.ts'
import { AgentFactory } from './services/agent_service.ts'
import { Runner, RunConfig } from '@openai/agents-core'
import { OpenAIProvider, setDefaultOpenAIKey, setDefaultOpenAITracingExporter } from '@openai/agents-openai'
import type { ThreadMetadata, UserMessageItem, ThreadStreamEvent } from './types/chatkit-types.ts'

// Configure OpenAI API key and tracing exporter
const DEFAULT_OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
if (DEFAULT_OPENAI_API_KEY) {
  setDefaultOpenAIKey(DEFAULT_OPENAI_API_KEY);
}

// Configure HTTP exporter to send traces to OpenAI's servers
// Without this, traces are only logged to console instead of being sent via HTTP
setDefaultOpenAITracingExporter();

console.log('[TimestepChatKitServer] ✅ OpenAI HTTP Tracing Exporter configured');
console.log('[TimestepChatKitServer] Traces will be sent to: https://api.openai.com/v1/traces/ingest');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to extract message text from UserMessageItem
function userMessageText(item: UserMessageItem): string {
  return item.content
    .filter((part) => part.type === 'input_text')
    .map((part) => part.text)
    .join(' ')
    .trim();
}

// Custom ChatKit server implementation
class TimestepChatKitServer extends ChatKitServer<{ userId: string; supabaseUrl: string; anonKey: string; userJwt: string; agentId: string }> {
  constructor(store: MemoryStore, agentFactory: AgentFactory, context: { userId: string; supabaseUrl: string; anonKey: string; userJwt: string; agentId: string }) {
    super(store, agentFactory, context);
  }

  async *respond(
    thread: ThreadMetadata,
    item: UserMessageItem | null,
    context: { userId: string; supabaseUrl: string; anonKey: string; userJwt: string; agentId: string }
  ): AsyncIterable<ThreadStreamEvent> {
    if (!item) {
      return;
    }

    const messageText = userMessageText(item);
    if (!messageText) {
      return;
    }

    console.log('[TimestepChatKitServer] Processing message:', messageText, 'for thread:', thread.id, 'with agent:', context.agentId);

    try {
      // Load conversation history from the thread
      const threadItems = await this.store.loadThreadItems(thread.id, null, 100, 'asc');
      
      console.log('[TimestepChatKitServer] Loaded', threadItems.data.length, 'thread items');
      
      // Convert thread items to OpenAI messages format
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (const threadItem of threadItems.data) {
        console.log('[TimestepChatKitServer] Processing item:', threadItem.type, 'content type:', typeof threadItem.content);
        
        if (threadItem.type === 'user_message') {
          const text = userMessageText(threadItem as UserMessageItem);
          if (text) {
            messages.push({ role: 'user', content: text });
          }
        } else if (threadItem.type === 'assistant_message') {
          const assistantItem = threadItem as any;
          const content = Array.isArray(assistantItem.content) ? assistantItem.content : [];
          const text = content
            .filter((part: any) => part.type === 'output_text')
            .map((part: any) => part.text)
            .join(' ')
            .trim();
          if (text) {
            messages.push({ role: 'assistant', content: text });
          }
        } else if ((threadItem as any).type === 'client_tool_call') {
          // Include tool call information in conversation history
          const toolCallItem = threadItem as any;
          const toolCallText = `[Tool call: ${toolCallItem.name}(${toolCallItem.arguments}) -> ${toolCallItem.output || 'pending'}]`;
          messages.push({ role: 'assistant', content: toolCallText });
        }
      }

      console.log('[TimestepChatKitServer] Loaded', messages.length, 'previous messages from thread');

      // Load agent configuration from database using AgentFactory
      const agent = await this.agentFactory.createAgent(context.agentId, context.userId);

      // Convert messages to Agents SDK format
      const inputItems: any[] = messages.map(msg => {
        if (msg.role === 'user') {
          return {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_text',
              text: msg.content
            }]
          };
        } else {
          // Assistant messages
          return {
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{
              type: 'output_text',
              text: msg.content
            }]
          };
        }
      });

      // Add the current message
      inputItems.push({
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: messageText }]
      });

      console.log('[TimestepChatKitServer] Sending', inputItems.length, 'messages to agent');

      // Set up OpenAI model provider
      const modelProvider = new OpenAIProvider({
        apiKey: Deno.env.get('OPENAI_API_KEY') || '',
      });

      // Configure the runner with the model provider
      const runConfig: RunConfig = {
        model: 'gpt-4o-mini',
        modelProvider: modelProvider,
        traceIncludeSensitiveData: true,
        tracingDisabled: false,
        workflowName: `Agent workflow (${Date.now()})`,
      };

      // Run the agent with streaming and full conversation history
      const runner = new Runner(runConfig);
      const result = await runner.run(agent, inputItems, {
        context: { threadId: thread.id, userId: context.userId },
        stream: true,
      });

      console.log('[TimestepChatKitServer] Result type:', typeof result);
      console.log('[TimestepChatKitServer] Result is AsyncIterable:', result && typeof result[Symbol.asyncIterator] === 'function');
      console.log('[TimestepChatKitServer] Result keys:', result ? Object.keys(result) : 'null');

      // Save the run state so we can resume after approval/rejection
      if (result && (result as any).state) {
        console.log('[TimestepChatKitServer] Saving run state for approval:', thread.id);
        await this.store.saveRunState(thread.id, (result as any).state);
      } else {
        console.warn('[TimestepChatKitServer] No run state found in result');
      }

      // Convert Agents SDK events to ChatKit events
      try {
        yield* streamAgentResponse(result as any, thread.id, this.store, runner);
      } catch (streamError) {
        console.error('[TimestepChatKitServer] Stream error:', streamError);
        throw streamError;
      }
    } catch (error) {
      console.error('[TimestepChatKitServer] Error:', error);
      throw error;
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the session or user object
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    // For development with --no-verify-jwt, create a mock user if none exists
    let userId = user?.id;
    if (!userId) {
      // Create a mock user ID for development - use a consistent UUID
      userId = '701c71d2-a48a-421a-a89b-b3aacb9fbde3';
      console.log('[Server] No user found, using mock user ID for development:', userId);
    }

    const url = new URL(req.url)
    const path = url.pathname
    
    console.log('Request path:', path)

    // Handle different path patterns (Supabase strips /functions/v1 prefix)
    if (path === '/server' || path === '/server/') {
      return new Response(
        JSON.stringify({ message: "Welcome to the Timestep AI ChatKit Server!" }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Agents API endpoints
    if (path === '/server/agents' && req.method === 'GET') {
      try {
        console.log('Agents API request for user:', userId);
        
        // Extract just the JWT token from Authorization header (remove "Bearer " prefix)
        const authHeader = req.headers.get('Authorization') ?? '';
        const userJwt = authHeader.replace('Bearer ', '');
        
        const agentFactory = new AgentFactory(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          userJwt
        );
        
        // Get all agents for the user (this will create default agents if they don't exist)
        const agents = await agentFactory.getAllAgents(userId);
        
        return new Response(
          JSON.stringify(agents),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } catch (error) {
        console.error('Error handling agents request:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch agents' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Agent-specific ChatKit API endpoints
    if (path.startsWith('/server/agents/') && path.includes('/chatkit')) {
      try {
        // Extract agent ID from path: /server/agents/{agentId}/chatkit
        const pathParts = path.split('/');
        const agentIndex = pathParts.indexOf('agents');
        const agentId = pathParts[agentIndex + 1];
        
        if (!agentId) {
          return new Response(
            JSON.stringify({ error: 'Agent ID is required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        console.log('Agent-specific ChatKit API request for user:', userId, 'agent:', agentId);
        
        // Handle ChatKit session creation
        if (path.endsWith('/chatkit/session') && req.method === 'POST') {
          throw new Error('ChatKit session creation not implemented - requires real OpenAI API integration');
        }

        // Handle ChatKit upload
        if (path.endsWith('/chatkit/upload') && req.method === 'POST') {
          throw new Error('ChatKit upload not implemented - requires real file storage integration');
        }

        // Handle main ChatKit API requests
        if (path.endsWith('/chatkit') || path.endsWith('/chatkit/')) {
          console.log('Agent ChatKit API request for user:', userId, 'Method:', req.method, 'Path:', path, 'Agent:', agentId);
          
          if (req.method === 'POST') {
            const body = await req.json();
            console.log('Agent ChatKit request body:', JSON.stringify(body, null, 2));
            
            // For ChatKit actions, try to extract user ID from the thread if available
            if (body.params?.thread_id) {
              try {
                const supabaseClient = createClient(
                  Deno.env.get('SUPABASE_URL') ?? '',
                  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
                );
                
                const { data: threadData } = await supabaseClient
                  .from('threads')
                  .select('user_id')
                  .eq('id', body.params.thread_id)
                  .single();
                  
                if (threadData?.user_id) {
                  userId = threadData.user_id;
                  console.log('[Server] Using user ID from thread:', userId);
                }
              } catch (e) {
                console.log('[Server] Could not extract user ID from thread, using:', userId);
              }
            }
            
            // Create ChatKit server instance
            // Extract just the JWT token from Authorization header (remove "Bearer " prefix)
            const authHeader = req.headers.get('Authorization') ?? '';
            const userJwt = authHeader.replace('Bearer ', '');
            
            const store = new MemoryStore<{ userId: string; supabaseUrl: string; anonKey: string; userJwt: string; agentId: string }>(
              Deno.env.get('SUPABASE_URL') ?? '',
              userJwt,
              userId
            );
            
            const agentFactory = new AgentFactory(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_ANON_KEY') ?? '',
              userJwt // Use the clean JWT without "Bearer " prefix
            );
            
            const context = {
              userId: userId,
              supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
              anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
              userJwt: req.headers.get('Authorization') ?? '',
              agentId: agentId // Use the agent ID from the URL
            };
            
            const chatKitServer = new TimestepChatKitServer(store, agentFactory, context);
            
            // Process the request
            const result = await chatKitServer.process(JSON.stringify(body), context);
            
            if (result.streaming) {
              // Return streaming response
              return new Response(result.result as ReadableStream, {
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive',
                },
              });
            } else {
              // Return non-streaming response
              return new Response(
                JSON.stringify(result.result),
                { 
                  status: 200, 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              );
            }
          }
        }

      } catch (error) {
        console.error('Error handling agent ChatKit request:', error);
        return new Response(
          JSON.stringify({ error: 'Agent ChatKit request failed' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Legacy ChatKit API endpoints (for backward compatibility)
    if (path.startsWith('/server/api/chatkit')) {
      try {
        // Handle ChatKit session creation
        if (path === '/server/api/chatkit/session' && req.method === 'POST') {
          throw new Error('ChatKit session creation not implemented - requires real OpenAI API integration');
        }

        // Handle ChatKit upload
        if (path === '/server/api/chatkit/upload' && req.method === 'POST') {
          throw new Error('ChatKit upload not implemented - requires real file storage integration');
        }

        // Handle main ChatKit API requests
        if (path === '/server/api/chatkit' || path.startsWith('/server/api/chatkit/')) {
          console.log('ChatKit API request for user:', userId, 'Method:', req.method, 'Path:', path)
          
          if (req.method === 'POST') {
            const body = await req.json();
            console.log('ChatKit request body:', JSON.stringify(body, null, 2));
            
            // Create ChatKit server instance
            // Extract just the JWT token from Authorization header (remove "Bearer " prefix)
            const authHeader = req.headers.get('Authorization') ?? '';
            const userJwt = authHeader.replace('Bearer ', '');
            
            const store = new MemoryStore<{ userId: string; supabaseUrl: string; anonKey: string; userJwt: string; agentId: string }>(
              Deno.env.get('SUPABASE_URL') ?? '',
              userJwt,
              userId
            );
            
            const agentFactory = new AgentFactory(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_ANON_KEY') ?? '',
              userJwt // Use the clean JWT without "Bearer " prefix
            );
            
            const context = {
              userId: userId,
              supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
              anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
              userJwt: req.headers.get('Authorization') ?? '',
              agentId: '00000000-0000-0000-0000-000000000000' // Default Personal Assistant
            };
            
            const chatKitServer = new TimestepChatKitServer(store, agentFactory, context);
            
            // Process the request
            const result = await chatKitServer.process(JSON.stringify(body), context);
            
            if (result.streaming) {
              // Return streaming response
              return new Response(result.result as ReadableStream, {
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive',
                },
              });
            } else {
              // Return non-streaming response
              return new Response(
                JSON.stringify(result.result),
                { 
                  status: 200, 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              );
            }
          }
        }

      } catch (error) {
        console.error('Error handling ChatKit request:', error)
        return new Response(
          JSON.stringify({ error: 'ChatKit request failed' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Not found', path: path }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})