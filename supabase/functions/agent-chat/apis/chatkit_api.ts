import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ChatKitServer, streamAgentResponse } from '../services/chatkit_service.ts'
import { MemoryStore } from '../stores/memory_store.ts'
import { AgentFactory } from '../services/agent_service.ts'
import { Runner, RunConfig } from '@openai/agents-core'
import { OpenAIProvider, setDefaultOpenAITracingExporter } from '@openai/agents-openai'
import { createUserTracingExporter } from '../services/tracing_service.ts'
import type { ThreadMetadata, UserMessageItem, ThreadStreamEvent } from '../types/chatkit-types.ts'

// Helper to extract message text from UserMessageItem
function userMessageText(item: UserMessageItem): string {
  // Handle both array format and string format
  if (typeof item.content === 'string') {
    return item.content.trim();
  } else if (Array.isArray(item.content)) {
    return item.content
      .filter((part) => part.type === 'input_text')
      .map((part) => (part as any).text)
      .join(' ')
      .trim();
  }
  return '';
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

    try {
      // Load conversation history from the thread
      const threadItems = await this.store.loadThreadItems(thread.id, null, 100, 'asc');
      
      // Convert thread items to OpenAI messages format
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (const threadItem of threadItems.data) {
        
        if ((threadItem as any).type === 'user_message') {
          const text = userMessageText(threadItem as UserMessageItem);
          if (text) {
            messages.push({ role: 'user', content: text });
          }
        } else if ((threadItem as any).type === 'assistant_message') {
          const assistantItem = threadItem as any;
          let text = '';
          
          // Handle different content formats
          if (typeof assistantItem.content === 'string') {
            // Simple string content
            text = assistantItem.content.trim();
          } else if (Array.isArray(assistantItem.content)) {
            // Array of content parts
            text = assistantItem.content
              .filter((part: any) => part.type === 'output_text')
              .map((part: any) => part.text)
              .join(' ')
              .trim();
          }
          
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

      // Note: The current message is already included in the conversation history loaded from the database
      // No need to add it again here

      // Set up OpenAI model provider
      const modelProvider = new OpenAIProvider({
        apiKey: Deno.env.get('OPENAI_API_KEY') || '',
      });

      // Set up user-specific tracing exporter for this request
      const userTracingExporter = createUserTracingExporter(context.supabaseUrl, context.userJwt);
      setDefaultOpenAITracingExporter(userTracingExporter);

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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


// Handle agent-specific ChatKit API requests
export async function handleAgentChatKitRequest(
  req: Request, 
  userId: string, 
  agentId: string, 
  path: string
): Promise<Response> {
  try {
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
        let currentUserId = userId;
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
              currentUserId = threadData.user_id;
              console.log('[Server] Using user ID from thread:', currentUserId);
            }
          } catch (_e) {
            console.log('[Server] Could not extract user ID from thread, using:', currentUserId);
          }
        }
        
        // Create ChatKit server instance
        // Extract just the JWT token from Authorization header (remove "Bearer " prefix)
        const authHeader = req.headers.get('Authorization') ?? '';
        const userJwt = authHeader.replace('Bearer ', '');
        
        const store = new MemoryStore<{ userId: string; supabaseUrl: string; anonKey: string; userJwt: string; agentId: string }>(
          Deno.env.get('SUPABASE_URL') ?? '',
          userJwt,
          currentUserId
        );
        
        const agentFactory = new AgentFactory(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          userJwt // Use the clean JWT without "Bearer " prefix
        );
        
        const context = {
          userId: currentUserId,
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

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

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

