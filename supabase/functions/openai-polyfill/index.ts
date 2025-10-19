// Supabase Edge Function to polyfill OpenAI API endpoints
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleEmbeddingsRequest } from './apis/embeddings_api.ts';
import { handleIngestRequest } from './apis/traces_api.ts';
import { handleVectorStoresRequest } from './apis/vector_stores_api.ts';
import { handleFilesRequest } from './apis/files_api.ts';
import { handleUploadsRequest } from './apis/uploads_api.ts';
import { handleCreateResponse, handleRetrieveResponse, handleDeleteResponse } from './apis/responses_api.ts';

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
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract JWT token from Authorization header (remove "Bearer " prefix)
    const userJwt = authHeader.replace(/^Bearer\s+/i, '');

    // Route requests based on endpoint
    const url = new URL(req.url);

    if (url.pathname.endsWith('/embeddings')) {
      // Handle OpenAI Embeddings API endpoint
      return await handleEmbeddingsRequest(req, supabaseClient, user.id, userJwt);
    } else if (url.pathname.endsWith('/ingest')) {
      // Handle OpenAI Agents SDK format: { data: [ {...trace/span...}, ... ] }
      return await handleIngestRequest(req, supabaseClient, user.id);
    } else if (url.pathname.includes('/vector_stores')) {
      // Handle OpenAI Vector Stores API endpoints
      return await handleVectorStoresRequest(req, supabaseClient, user.id, url.pathname, userJwt);
    } else if (url.pathname.includes('/uploads')) {
      // Handle OpenAI Uploads API endpoints (multipart uploads)
      return await handleUploadsRequest(req, supabaseClient, user.id, url.pathname);
    } else if (url.pathname.includes('/files')) {
      // Handle OpenAI Files API endpoints
      return await handleFilesRequest(req, supabaseClient, user.id, url.pathname, userJwt);
    } else if (url.pathname.includes('/responses')) {
      // Handle OpenAI Responses API endpoints
      const pathParts = url.pathname.split('/');
      const responsesIndex = pathParts.findIndex(part => part === 'responses');
      const responseId = pathParts[responsesIndex + 1];

      if (req.method === 'POST' && !responseId) {
        // POST /v1/responses - Create response
        return await handleCreateResponse(req, supabaseClient, user.id);
      } else if (req.method === 'GET' && responseId) {
        // GET /v1/responses/:id - Retrieve response
        return await handleRetrieveResponse(responseId, supabaseClient, user.id);
      } else if (req.method === 'DELETE' && responseId) {
        // DELETE /v1/responses/:id - Delete response
        return await handleDeleteResponse(responseId, supabaseClient, user.id);
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid responses endpoint' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      // Return 404 for unknown endpoints
      return new Response(
        JSON.stringify({
          error: 'Endpoint not found. Available endpoints: /embeddings, /traces/ingest, /vector_stores, /uploads, /files, /responses'
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
