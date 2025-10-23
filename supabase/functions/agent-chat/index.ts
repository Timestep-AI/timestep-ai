import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { setDefaultOpenAIKey, setDefaultOpenAITracingExporter } from 'npm:@openai/agents-openai';
import { handleGetAgentsRequest } from './apis/agents_api.ts';
import { handlePostChatKitRequest, handlePostChatKitUploadRequest } from './apis/chatkit_api.ts';

// Configure OpenAI API key and tracing exporter
const DEFAULT_OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
if (DEFAULT_OPENAI_API_KEY) {
  setDefaultOpenAIKey(DEFAULT_OPENAI_API_KEY);
}

// Configure HTTP exporter to send traces to OpenAI's servers
setDefaultOpenAITracingExporter();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');

    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    // Get the session or user object
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // Require authentication (including anonymous users)
    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    const url = new URL(req.url);
    const path = url.pathname;

    // Handle different path patterns (Supabase strips /functions/v1 prefix)
    if (path === '/agent-chat' || path === '/') {
      return new Response(
        JSON.stringify({ message: 'Welcome to the Agent ChatKit Server!' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Agents API endpoints
    if (path === '/agent-chat/agents' && req.method === 'GET') {
      return await handleGetAgentsRequest(userId, req.headers.get('Authorization') ?? '');
    }

    // Agent-specific ChatKit upload endpoints
    if (path.startsWith('/agent-chat/agents/') && path.endsWith('/chatkit/upload')) {
      // Extract agent ID from path: /agent-chat/agents/{agentId}/chatkit/upload
      const pathParts = path.split('/');
      const agentIndex = pathParts.indexOf('agents');
      const agentId = pathParts[agentIndex + 1];

      if (!agentId) {
        return new Response(JSON.stringify({ error: 'Agent ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return await handlePostChatKitUploadRequest(req, userId, agentId, path);
    }

    // Agent-specific ChatKit API endpoints
    if (path.startsWith('/agent-chat/agents/') && path.includes('/chatkit')) {
      // Extract agent ID from path: /agent-chat/agents/{agentId}/chatkit
      const pathParts = path.split('/');
      const agentIndex = pathParts.indexOf('agents');
      const agentId = pathParts[agentIndex + 1];

      if (!agentId) {
        return new Response(JSON.stringify({ error: 'Agent ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return await handlePostChatKitRequest(req, userId, agentId, path);
    }

    return new Response(JSON.stringify({ error: 'Not found', path: path }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
