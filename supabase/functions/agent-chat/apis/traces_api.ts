// Traces API for fetching trace data from the database
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

export async function handleTracesRequest(req: Request, supabaseClient: any, userId: string) {
  try {
    const url = new URL(req.url);
    const traceId = url.searchParams.get('traceId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (traceId) {
      // Get specific trace with its spans
      const { data: trace, error: traceError } = await supabaseClient
        .from('traces')
        .select('*')
        .eq('id', traceId)
        .eq('user_id', userId)
        .single();

      if (traceError) {
        return new Response(
          JSON.stringify({ error: 'Trace not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Get spans for this trace
      const { data: spans, error: spansError } = await supabaseClient
        .from('spans')
        .select('*')
        .eq('trace_id', traceId)
        .eq('user_id', userId)
        .order('start_time', { ascending: true });

      if (spansError) {
        console.error('[Traces] Error fetching spans:', spansError);
      }

      return new Response(
        JSON.stringify({
          trace,
          spans: spans || [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Get list of traces
      const { data: traces, error: tracesError } = await supabaseClient
        .from('traces')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (tracesError) {
        console.error('[Traces] Error fetching traces:', tracesError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch traces' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Enrich traces with handoff and tool counts from spans
      if (traces && traces.length > 0) {
        const traceIds = traces.map(t => t.id);
        
        // Get all spans for these traces
        const { data: spans, error: spansError } = await supabaseClient
          .from('spans')
          .select('trace_id, attributes, start_time, end_time')
          .in('trace_id', traceIds)
          .eq('user_id', userId);

        if (spansError) {
          console.error('[Traces] Error fetching spans for enrichment:', spansError);
        } else if (spans) {
          // Calculate handoff and tool counts for each trace
          const traceStats = new Map();
          
          for (const span of spans) {
            const traceId = span.trace_id;
            if (!traceStats.has(traceId)) {
              traceStats.set(traceId, { handoffs: new Set(), tools: new Set(), flow: null });
            }
            
            const stats = traceStats.get(traceId);
            const attrs = span.attributes || {};
            
            // Count actual handoff and tool usage
            if (attrs.span_type === 'handoff') {
              // Count actual handoff usage
              if (attrs.to_agent) {
                stats.handoffs.add(attrs.to_agent);
              }
            } else if (attrs.span_type === 'tool_call') {
              // Count actual tool usage
              if (attrs.tool_name) {
                stats.tools.add(attrs.tool_name);
              }
            } else if (attrs.span_type === 'agent') {
              // Set flow name from agent name
              if (attrs.agent_name && !stats.flow) {
                stats.flow = attrs.agent_name;
              }
            }
          }
          
          // Enrich traces with calculated stats and update durations
          for (const trace of traces) {
            const stats = traceStats.get(trace.id);
            if (stats) {
              const handoffs = Array.from(stats.handoffs);
              const tools = Array.from(stats.tools);
              
              console.log(`[Traces] Final counts for trace ${trace.id}:`, {
                handoffs,
                tools,
                flow: stats.flow
              });
              
              trace.metadata = {
                ...trace.metadata,
                handoffs,
                tools,
                flow: stats.flow
              };
            }
            
            // Update trace duration if it's 0 or missing
            if (trace.duration_ms === 0 || !trace.duration_ms) {
              const traceSpans = spans.filter(s => s.trace_id === trace.id);
              if (traceSpans.length > 0) {
                const startTimes = traceSpans.map(s => new Date(s.start_time).getTime());
                const endTimes = traceSpans.map(s => new Date(s.end_time).getTime());
                const earliestStart = Math.min(...startTimes);
                const latestEnd = Math.max(...endTimes);
                const durationMs = latestEnd - earliestStart;
                
                // Update the trace duration in the database
                await supabaseClient
                  .from('traces')
                  .update({ duration_ms: durationMs })
                  .eq('id', trace.id)
                  .eq('user_id', userId);
                
                // Update the trace object for the response
                trace.duration_ms = durationMs;
              }
            }
          }
        }
      }

      // Get total count for pagination
      const { count, error: countError } = await supabaseClient
        .from('traces')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        console.error('[Traces] Error fetching trace count:', countError);
      }

      return new Response(
        JSON.stringify({
          traces: traces || [],
          total: count || 0,
          limit,
          offset,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('[Traces] Error:', error);
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
