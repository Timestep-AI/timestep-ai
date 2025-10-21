import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ChatKitService } from '../../services/chatkit/service.ts';
import { MemoryStore } from '../../stores/memory_store.ts';
import { AgentService } from '../../services/agent/service.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle agent-specific ChatKit API requests
export async function handleAgentChatKitRequest(
  req: Request,
  userId: string,
  agentId: string,
  path: string
): Promise<Response> {
  try {
    // Handle ChatKit session creation
    if (path.endsWith('/chatkit/session') && req.method === 'POST') {
      throw new Error(
        'ChatKit session creation not implemented - requires real OpenAI API integration'
      );
    }

    // Handle ChatKit upload
    if (path.endsWith('/chatkit/upload') && req.method === 'POST') {
      throw new Error('ChatKit upload not implemented - requires real file storage integration');
    }

    // Handle main ChatKit API requests
    if (path.endsWith('/chatkit') || path.endsWith('/chatkit/')) {
      if (req.method === 'POST') {
        const body = await req.json();

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
            } else {
              console.warn(
                '[TimestepChatKitServer] Could not extract user ID from thread, using:',
                currentUserId
              );
            }
          } catch (_e) {
            console.warn(
              '[TimestepChatKitServer] Could not extract user ID from thread, using:',
              currentUserId
            );
          }
        }

        // Create ChatKit server instance
        // Extract just the JWT token from Authorization header (remove "Bearer " prefix)
        const authHeader = req.headers.get('Authorization') ?? '';
        const userJwt = authHeader.replace('Bearer ', '');

        const store = new MemoryStore<{
          userId: string;
          supabaseUrl: string;
          anonKey: string;
          userJwt: string;
          agentId: string;
        }>(Deno.env.get('SUPABASE_URL') ?? '', userJwt, currentUserId);

        const agentService = new AgentService(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          userJwt // Use the clean JWT without "Bearer " prefix
        );

        const context = {
          userId: currentUserId,
          supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
          anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          userJwt: userJwt, // Use the clean JWT without "Bearer " prefix
          agentId: agentId, // Use the agent ID from the URL
        };

        const chatKitService = new ChatKitService(store, agentService, context);

        // Process the request
        const result = await chatKitService.processRequest(JSON.stringify(body));

        if (result.streaming) {
          // Return streaming response
          return new Response(result.result as ReadableStream, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          });
        } else {
          // Return non-streaming response
          return new Response(JSON.stringify(result.result), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error handling agent ChatKit request:', error);
    return new Response(JSON.stringify({ error: 'Agent ChatKit request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
