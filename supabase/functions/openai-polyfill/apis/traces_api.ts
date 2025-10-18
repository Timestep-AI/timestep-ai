// OpenAI Traces API implementation

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
};

/**
 * Handle OpenAI Agents SDK trace ingest format
 * Expected format: { data: [ {...trace/span...}, ... ] }
 */
export async function handleIngestRequest(req: Request, supabaseClient: any, userId: string) {
  try {
    const body = await req.json();
    console.log('[Traces/Ingest] Received request with', body.data?.length || 0, 'items');

    if (!body.data || !Array.isArray(body.data)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request format. Expected { data: [...] }' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const traces: any[] = [];
    const spans: any[] = [];

    // Process each item (could be a trace or a span)
    for (const item of body.data) {
      // Extract thread_id if present
      const threadId = item.thread_id || null;

      if (item.type === 'trace' || item.spans) {
        // This is a trace object
        traces.push({
          id: item.id || item.traceId,
          user_id: userId,
          thread_id: threadId,
          name: item.name || 'unknown',
          status: item.status || 'unset',
          duration_ms: item.duration_ms || item.durationMs || 0,
          metadata: item.metadata || {},
          created_at: item.startedAt || item.created_at || new Date().toISOString(),
        });

        // If the trace includes spans, process them
        if (item.spans && Array.isArray(item.spans)) {
          for (const span of item.spans) {
            spans.push(processSpan(span, item.id || item.traceId, userId, threadId));
          }
        }
      } else {
        // This is a span object
        const traceId = item.traceId || item.trace_id || 'unknown';
        spans.push(processSpan(item, traceId, userId, threadId));
      }
    }

    // Insert traces
    if (traces.length > 0) {
      const { error: tracesError } = await supabaseClient
        .from('traces')
        .upsert(traces, { onConflict: 'id' });

      if (tracesError) {
        console.error('[Traces/Ingest] Error upserting traces:', tracesError);
      } else {
        console.log('[Traces/Ingest] Successfully upserted', traces.length, 'traces');
      }
    }

    // Insert spans
    if (spans.length > 0) {
      const { error: spansError } = await supabaseClient
        .from('spans')
        .upsert(spans, { onConflict: 'id' });

      if (spansError) {
        console.error('[Traces/Ingest] Error upserting spans:', spansError);
      } else {
        console.log('[Traces/Ingest] Successfully upserted', spans.length, 'spans');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tracesProcessed: traces.length,
        spansProcessed: spans.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Traces/Ingest] Error:', error);
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
 * Process a span object into database format
 */
function processSpan(span: any, traceId: string, userId: string, threadId: string | null) {
  return {
    id: span.id || span.spanId,
    trace_id: traceId,
    parent_span_id: span.parentSpanId || span.parent_span_id || null,
    user_id: userId,
    start_time: span.startedAt || span.start_time || new Date().toISOString(),
    end_time: span.endedAt || span.end_time || span.completedAt || new Date().toISOString(),
    duration_ms: span.duration_ms || span.durationMs || 0,
    name: span.name || 'unknown',
    kind: span.kind || 'internal',
    status: span.status || 'unset',
    status_message: span.statusMessage || span.status_message || null,
    attributes: span.attributes || {},
    events: span.events || [],
    links: span.links || [],
  };
}
