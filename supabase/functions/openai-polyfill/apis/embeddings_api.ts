// OpenAI Embeddings API implementation
import OpenAI from 'openai';

// TypeScript interfaces for Embeddings API (from OpenAI OpenAPI spec)
export interface CreateEmbeddingRequest {
  input: string | string[] | number[] | number[][];
  model: string;
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}

export interface Embedding {
  index: number;
  embedding: number[];
  object: 'embedding';
}

export interface CreateEmbeddingResponse {
  data: Embedding[];
  model: string;
  object: 'list';
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
};

/**
 * Handle OpenAI Embeddings API endpoint
 * POST /embeddings
 * Creates vector embeddings from input text using Hugging Face endpoint
 */
export async function handleEmbeddingsRequest(req: Request, _supabaseClient: any, _userId: string) {
  try {
    const body: CreateEmbeddingRequest = await req.json();
    console.log('[Embeddings] Received request for model:', body.model);

    // Validate required fields
    if (!body.input) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Missing required field: input',
            type: 'invalid_request_error',
            param: 'input',
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!body.model) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Missing required field: model',
            type: 'invalid_request_error',
            param: 'model',
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get Hugging Face token from environment
    const hfToken = Deno.env.get('HF_TOKEN');
    if (!hfToken) {
      console.error('[Embeddings] HF_TOKEN not found in environment');
      return new Response(
        JSON.stringify({
          error: {
            message: 'Hugging Face token not configured',
            type: 'api_error',
            param: null,
            code: null,
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize OpenAI client with Hugging Face endpoint
    const client = new OpenAI({
      baseURL: 'https://uguyltc82r1ecuz4.us-east-1.aws.endpoints.huggingface.cloud',
      apiKey: hfToken,
    });

    console.log('[Embeddings] Creating embeddings with Hugging Face endpoint...');

    // Call the Hugging Face endpoint using OpenAI client
    const embeddingResponse = await client.embeddings.create({
      input: body.input,
      model: body.model,
      encoding_format: body.encoding_format,
      dimensions: body.dimensions,
      user: body.user,
    } as any); // Cast to any to allow all fields through

    console.log('[Embeddings] Successfully generated', embeddingResponse.data.length, 'embeddings');

    // Return the response from Hugging Face
    return new Response(
      JSON.stringify(embeddingResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Embeddings] Error:', error);

    // Handle OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      return new Response(
        JSON.stringify({
          error: {
            message: error.message,
            type: error.type || 'api_error',
            param: (error as any).param || null,
            code: error.code || null,
          }
        }),
        {
          status: error.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle generic errors
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'api_error',
          param: null,
          code: null,
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
