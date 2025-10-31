import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { setDefaultOpenAIKey, setDefaultOpenAITracingExporter } from '@openai/agents-openai';
import { handleGetAgentsRequest } from './apis/agent_api.ts';
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-function-path',
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
    let userId: string | null = null;
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (user?.id) {
      userId = user.id;
    } else if (authHeader) {
      // If getUser() fails but we have an auth header, try to extract user ID from JWT
      // This handles cases where the user might not exist in the database yet (e.g., anonymous users)
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const parts = token.split('.');
        if (parts.length >= 2) {
          // Decode JWT payload (base64url)
          let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          // Add padding if needed
          while (base64.length % 4) {
            base64 += '=';
          }
          const payload = JSON.parse(atob(base64));
          userId = payload.sub || payload.user_id || null;
        }
      } catch (e) {
        console.error('Error decoding JWT:', e);
      }
    }

    // Require authentication (including anonymous users)
    if (!userId) {
      const errorMessage = userError ? `Authentication failed: ${userError.message}` : 'Authentication required';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname;
    
    // Check for custom header indicating the path when called via SDK invoke
    const functionPath = req.headers.get('x-function-path');
    const effectivePath = functionPath || path;

    // Handle different path patterns (Supabase strips /functions/v1 prefix)
    // When called via SDK invoke, path might be /agent-chat or /, so check x-function-path header
    if ((path === '/agent-chat' || path === '/') && !functionPath) {
      return new Response(
        JSON.stringify({ message: 'Welcome to the Timestep AI ChatKit Server!' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Agents API endpoints - handle both direct HTTP calls and SDK invoke calls
    if ((effectivePath === '/agent-chat/agents' || effectivePath === '/agents') && req.method === 'GET') {
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
