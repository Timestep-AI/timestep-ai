// Supabase Edge Function to polyfill OpenAI API endpoints
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleEmbeddingsRequest } from './apis/embeddings_api.ts';
import { handleVectorStoresRequest } from './apis/vector_stores_api.ts';
import { handleFilesRequest } from './apis/files_api.ts';
import { handleUploadsRequest } from './apis/uploads_api.ts';
import { handleConversationsRequest } from './apis/conversations_api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user from JWT
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract JWT token from Authorization header (remove "Bearer " prefix)
    const userJwt = authHeader.replace(/^Bearer\s+/i, '');

    // Route requests based on endpoint
    const url = new URL(req.url);
    const fullPath = url.pathname;
    // Support requests that include the function name in the path
    const fnMarker = '/openai-polyfill';
    const idx = fullPath.indexOf(fnMarker);
    const afterFn = idx >= 0 ? fullPath.slice(idx + fnMarker.length) || '/' : fullPath;
    // Normalize optional /v1 prefix
    const pathname = afterFn.replace(/^\/v1\//, '/');

    if (pathname.endsWith('/embeddings')) {
      // Handle OpenAI Embeddings API endpoint
      return await handleEmbeddingsRequest(req, supabaseClient, user.id, userJwt);
    } else if (pathname.includes('/vector_stores')) {
      // Handle OpenAI Vector Stores API endpoints
      return await handleVectorStoresRequest(req, supabaseClient, user.id, url.pathname, userJwt);
    } else if (pathname.includes('/uploads')) {
      // Handle OpenAI Uploads API endpoints (multipart uploads)
      return await handleUploadsRequest(req, supabaseClient, user.id, url.pathname);
    } else if (pathname.includes('/files')) {
      // Handle OpenAI Files API endpoints
      return await handleFilesRequest(req, supabaseClient, user.id, url.pathname, userJwt);
    } else if (pathname.startsWith('/conversations')) {
      // Handle OpenAI Conversations API endpoints
      return await handleConversationsRequest(req, user.id, pathname, supabaseClient);
    } else {
      // Return 404 for unknown endpoints
      return new Response(
        JSON.stringify({
          error:
            'Endpoint not found. Available endpoints: /embeddings, /vector_stores, /uploads, /files',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('[Traces] Error processing request:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
