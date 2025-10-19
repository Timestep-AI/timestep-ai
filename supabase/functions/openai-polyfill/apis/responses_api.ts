// OpenAI Responses API implementation

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
};

/**
 * Create a new response (POST /v1/responses)
 * Stores the full response data for later retrieval and trace enrichment
 */
export async function handleCreateResponse(req: Request, supabaseClient: any, userId: string) {
  try {
    console.log('[Responses/Create] Creating response for user:', userId);
    const body = await req.json();

    // Extract response data from the request
    const responseId = body.id;
    if (!responseId) {
      return new Response(
        JSON.stringify({ error: 'Response ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Responses/Create] Storing response:', responseId, 'for user:', userId);

    // Store the response data in the database
    const { data, error } = await supabaseClient
      .from('responses')
      .upsert({
        id: responseId,
        user_id: userId,
        thread_id: body.thread_id || null,
        model: body.model || null,
        instructions: body.instructions || null,
        usage: body.usage || null,
        tools: body.tools || null,
        messages: body.messages || null,
        output: body.output || null,
        output_type: body.output_type || body.text?.format?.type || 'text',
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.error('[Responses/Create] Error storing response:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to store response', details: error }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Responses/Create] ✅ Successfully stored response:', responseId, 'data returned:', data);

    // Return the response data (echo back what was sent)
    return new Response(
      JSON.stringify(body),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Responses/Create] Error:', error);
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
}

/**
 * Retrieve a response by ID (GET /v1/responses/:id)
 */
export async function handleRetrieveResponse(responseId: string, supabaseClient: any, userId: string) {
  try {
    console.log('[Responses/Retrieve] Fetching response:', responseId, 'for user:', userId);

    const { data, error } = await supabaseClient
      .from('responses')
      .select('*')
      .eq('id', responseId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.warn('[Responses/Retrieve] Response not found:', responseId, error);
      return new Response(
        JSON.stringify({ error: 'Response not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Responses/Retrieve] ✅ Found response:', responseId);

    // Convert database format back to OpenAI format
    const response = {
      id: data.id,
      object: 'response',
      model: data.model,
      instructions: data.instructions,
      usage: data.usage,
      tools: data.tools,
      output: data.output,
      text: {
        format: {
          type: data.output_type || 'text',
        },
      },
      metadata: data.metadata,
      created_at: Math.floor(new Date(data.created_at).getTime() / 1000),
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Responses/Retrieve] Error:', error);
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
}

/**
 * Delete a response by ID (DELETE /v1/responses/:id)
 */
export async function handleDeleteResponse(responseId: string, supabaseClient: any, userId: string) {
  try {
    console.log('[Responses/Delete] Deleting response:', responseId, 'for user:', userId);

    const { error } = await supabaseClient
      .from('responses')
      .delete()
      .eq('id', responseId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Responses/Delete] Error deleting response:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to delete response', details: error }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Responses/Delete] ✅ Successfully deleted response:', responseId);

    return new Response(
      null,
      {
        status: 204,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error('[Responses/Delete] Error:', error);
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
}
