import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ThreadService } from '../services/thread_service.ts';
import { ThreadMessageService } from '../services/thread_message_service.ts';
import { ThreadRunStateService } from '../services/thread_run_state_service.ts';
import { AgentsService } from '../services/agent_service.ts';
import { ChatKitService } from '../services/chatkit_service.ts';
import { isStreamingReq, type ChatKitRequest } from '../types/chatkit.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle ChatKit API requests
export async function handlePostChatKitRequest(
  req: Request,
  userId: string,
  agentId: string,
  path: string
): Promise<Response> {
  try {
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

        const threadService = new ThreadService(
          Deno.env.get('SUPABASE_URL') ?? '',
          userJwt,
          currentUserId
        );
        const threadMessageService = new ThreadMessageService(
          Deno.env.get('SUPABASE_URL') ?? '',
          userJwt,
          currentUserId
        );
        const threadRunStateService = new ThreadRunStateService(
          Deno.env.get('SUPABASE_URL') ?? '',
          userJwt,
          currentUserId
        );

        const agentService = new AgentsService(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          userJwt, // Use the clean JWT without "Bearer " prefix
          threadService
        );

        const context = {
          userId: currentUserId,
          supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
          anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          userJwt: userJwt, // Use the clean JWT without "Bearer " prefix
          agentId: agentId, // Use the agent ID from the URL
        };

        // Create the agent and use ChatKitService directly
        const agent = await agentService.createAgent(agentId, currentUserId);
        const chatKitService = new ChatKitService(
          threadService,
          threadMessageService,
          threadRunStateService,
          agent,
          context
        );

        // Parse the request and determine if it's streaming
        const parsedRequest: ChatKitRequest = body;

        if (isStreamingReq(parsedRequest)) {
          // Return streaming response
          const stream = chatKitService.encodeStream(
            chatKitService.processStreamingRequest(parsedRequest)
          );
          return new Response(stream as ReadableStream, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          });
        } else {
          // Return non-streaming response
          const result = await chatKitService.processNonStreamingRequest(parsedRequest);
          return new Response(JSON.stringify(result), {
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
    console.error('Error handling ChatKit request:', error);
    return new Response(JSON.stringify({ error: 'ChatKit request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle ChatKit upload requests
export function handlePostChatKitUploadRequest(
  _req: Request,
  _userId: string,
  _agentId: string,
  _path: string
): Response {
  try {
    // Handle ChatKit upload
    if (_path.endsWith('/chatkit/upload') && _req.method === 'POST') {
      throw new Error('ChatKit upload not implemented - requires real file storage integration');
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error handling ChatKit upload request:', error);
    return new Response(JSON.stringify({ error: 'ChatKit upload request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
