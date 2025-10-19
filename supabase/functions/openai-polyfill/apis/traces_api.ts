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
    console.log('[Traces/Ingest] 🔥 Received trace ingest request for user:', userId);
    const body = await req.json();
    console.log('[Traces/Ingest] Request body keys:', Object.keys(body));
    console.log('[Traces/Ingest] Received request with', body.data?.length || 0, 'items');
    
    // Debug: Log the first item to see its structure
    if (body.data && body.data.length > 0) {
      console.log('[Traces/Ingest] First item type:', body.data[0].type);
      console.log('[Traces/Ingest] First item keys:', Object.keys(body.data[0]));
      console.log('[Traces/Ingest] First item full structure:', JSON.stringify(body.data[0], null, 2));
    }

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
    const traceIds = new Set<string>();
    // Collect inferred thread_ids from spans (e.g., via associated responses)
    const inferredThreadIdByTrace = new Map<string, string>();

    // Process each item (could be a trace or a span)
    for (let i = 0; i < body.data.length; i++) {
      const item = body.data[i];
      console.log(`[Traces/Ingest] Processing item ${i}:`, JSON.stringify(item, null, 2));
      
      // Extract thread_id if present (from item.thread_id or item.metadata.thread_id)
      console.log(`[Traces/Ingest] Item ${i} thread_id extraction:`);
      console.log(`  - item.thread_id: ${item.thread_id}`);
      console.log(`  - item.metadata: ${JSON.stringify(item.metadata)}`);
      console.log(`  - item.metadata?.thread_id: ${item.metadata?.thread_id}`);
      const threadId = item.thread_id || item.metadata?.thread_id || null;
      console.log(`  - Final threadId: ${threadId}`);

          if (item.type === 'trace' || item.object === 'trace' || item.spans) {
        // This is a trace object
        const traceId = item.id || item.traceId;
        traces.push({
          id: traceId,
          user_id: userId,
          thread_id: threadId,
          name: item.workflow_name || item.name || 'unknown',
          status: item.status || 'unset',
          duration_ms: item.duration_ms || item.durationMs || 0,
          metadata: item.metadata || {},
          created_at: item.startedAt || item.created_at || new Date().toISOString(),
        });
        traceIds.add(traceId);

        // If the trace includes spans, process them
        if (item.spans && Array.isArray(item.spans)) {
          for (const span of item.spans) {
            spans.push(await processSpan(span, traceId, userId, threadId, supabaseClient, inferredThreadIdByTrace));
          }
        }
          } else if (item.object === 'trace.span') {
            // This is a span object
            const traceId = item.trace_id || item.traceId || 'unknown';
            console.log('[Traces/Ingest] Processing span - item.trace_id:', item.trace_id, 'item.traceId:', item.traceId, '-> resolved traceId:', traceId);
            spans.push(await processSpan(item, traceId, userId, threadId, supabaseClient, inferredThreadIdByTrace));
            if (traceId !== 'unknown') {
              traceIds.add(traceId);
            }
          } else {
            // This looks like metadata (workflow, group, etc.) - skip it
            console.log('[Traces/Ingest] Skipping non-span item with keys:', Object.keys(item));
          }
    }

    // Apply inferred thread_id to any traces we already have in memory
    for (const t of traces) {
      if (!t.thread_id && inferredThreadIdByTrace.has(t.id)) {
        t.thread_id = inferredThreadIdByTrace.get(t.id);
      }
    }

    // Create trace records for any trace IDs that don't have explicit trace records
    for (const traceId of traceIds) {
      if (!traces.find(t => t.id === traceId)) {
        // Create a minimal trace record
        traces.push({
          id: traceId,
          user_id: userId,
          thread_id: inferredThreadIdByTrace.get(traceId) || null, // Use inferred thread when available
          name: 'Agent Workflow',
          status: 'ok',
          duration_ms: 0,
          metadata: {},
          created_at: new Date().toISOString(),
        });
      }
    }

    // Insert traces first
    if (traces.length > 0) {
      console.log('[Traces/Ingest] Inserting', traces.length, 'traces...');
      console.log('[Traces/Ingest] Trace IDs:', traces.map(t => t.id));
      const { error: tracesError } = await supabaseClient
        .from('traces')
        .upsert(traces, { onConflict: 'id' });

      if (tracesError) {
        console.error('[Traces/Ingest] Error upserting traces:', tracesError);
        return new Response(
          JSON.stringify({ error: 'Failed to insert traces', details: tracesError }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        console.log('[Traces/Ingest] ✅ Successfully upserted', traces.length, 'traces');
        // As a fallback, update any traces that still have null thread_id but we inferred one
        for (const [traceId, inferredThreadId] of inferredThreadIdByTrace.entries()) {
          const needsUpdate = !traces.find(t => t.id === traceId && t.thread_id);
          if (needsUpdate && inferredThreadId) {
            const { error: updateThreadError } = await supabaseClient
              .from('traces')
              .update({ thread_id: inferredThreadId })
              .eq('id', traceId)
              .eq('user_id', userId);
            if (updateThreadError) {
              console.warn('[Traces/Ingest] Could not backfill thread_id for trace', traceId, updateThreadError);
            } else {
              console.log(`[Traces/Ingest] Backfilled thread_id for trace ${traceId} -> ${inferredThreadId}`);
            }
          }
        }
      }
    }

        // Insert spans only after traces are successfully inserted
        if (spans.length > 0) {
          console.log('[Traces/Ingest] Inserting', spans.length, 'spans...');
          console.log('[Traces/Ingest] Span trace IDs:', spans.map(s => s.trace_id));
          
            // Sort spans to ensure parent spans are inserted before child spans
            const sortedSpans = sortSpansByDependency(spans);
            console.log('[Traces/Ingest] Sorted spans for insertion:', sortedSpans.map((s: any) => ({ 
              id: s.id, 
              name: s.name,
              parent_span_id: s.parent_span_id,
              span_type: s.attributes?.span_type 
            })));
  
            // Create placeholder spans for missing parents
            const missingParentIds = new Set<string>();
            sortedSpans.forEach(span => {
              if (span.parent_span_id && !spans.find((s) => s.id === span.parent_span_id)) {
                missingParentIds.add(span.parent_span_id);
              }
            });

            // Add placeholder spans for missing parents
            const placeholderSpans = Array.from(missingParentIds).map(parentId => ({
              id: parentId,
              trace_id: spans[0]?.trace_id,
              parent_span_id: null, // Will be fixed when we get the real parent
              name: 'Processing...',
              status: 'unset',
              start_time: new Date().toISOString(),
              end_time: null,
              duration_ms: 0,
              user_id: userId, // Add user_id for RLS
              attributes: {
                span_type: 'placeholder',
                is_placeholder: true
              }
            }));

            // Insert placeholder spans first, then the real spans
            if (placeholderSpans.length > 0) {
              console.log(`[Traces/Ingest] Creating ${placeholderSpans.length} placeholder spans for missing parents`);
              const { error: placeholderError } = await supabaseClient
                .from('spans')
                .upsert(placeholderSpans, { onConflict: 'id' });
              
              if (placeholderError) {
                console.error('[Traces/Ingest] Error upserting placeholder spans:', placeholderError);
                return new Response(
                  JSON.stringify({ error: 'Failed to insert placeholder spans', details: placeholderError }),
                  { 
                    status: 500, 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                  }
                );
              }
            }
  
            const { error: spansError } = await supabaseClient
              .from('spans')
              .upsert(sortedSpans, { onConflict: 'id' });


          if (spansError) {
            console.error('[Traces/Ingest] Error upserting spans:', spansError);
            return new Response(
              JSON.stringify({ error: 'Failed to insert spans', details: spansError }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          } else {
            console.log('[Traces/Ingest] ✅ Successfully upserted', spans.length, 'spans');
            
            // Update trace durations based on spans
            for (const traceId of traceIds) {
              const { data: traceSpans, error: spansError } = await supabaseClient
                .from('spans')
                .select('start_time, end_time')
                .eq('trace_id', traceId)
                .eq('user_id', userId);

              if (!spansError && traceSpans && traceSpans.length > 0) {
                // Calculate trace duration from earliest start to latest end
                const startTimes = traceSpans.map((s: { start_time: string }) => new Date(s.start_time).getTime());
                const endTimes = traceSpans.map((s: { end_time: string }) => new Date(s.end_time).getTime());
                const earliestStart = Math.min(...startTimes);
                const latestEnd = Math.max(...endTimes);
                const durationMs = latestEnd - earliestStart;

                // Update the trace with calculated duration
                const { error: updateError } = await supabaseClient
                  .from('traces')
                  .update({ duration_ms: durationMs })
                  .eq('id', traceId)
                  .eq('user_id', userId);

                if (updateError) {
                  console.error('[Traces/Ingest] Error updating trace duration:', updateError);
                } else {
                  console.log(`[Traces/Ingest] Updated trace ${traceId} duration to ${durationMs}ms`);
                }
              }
            }
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
 * Update parent relationships for spans that were previously missing their parents
 */
async function updateMissingParentRelationships(newSpans: any[], userId: string, supabaseClient: any) {
  const newSpanIds = new Set(newSpans.map(span => span.id));
  
  // Find all spans that have original_parent_id set (orphaned spans)
  const { data: orphanedSpans, error } = await supabaseClient
    .from('spans')
    .select('id, parent_span_id, original_parent_id, attributes')
    .eq('user_id', userId)
    .not('original_parent_id', 'is', null);
    
  if (error) {
    console.error('[Traces/Ingest] Error fetching orphaned spans:', error);
    return;
  }
  
  if (!orphanedSpans || orphanedSpans.length === 0) {
    return;
  }
  
  console.log('[Traces/Ingest] Found', orphanedSpans.length, 'orphaned spans to check');
  
  // Check if any of the newly inserted spans match the original_parent_id
  for (const orphanedSpan of orphanedSpans) {
    if (newSpanIds.has(orphanedSpan.original_parent_id)) {
      console.log(`[Traces/Ingest] Updating parent relationship: ${orphanedSpan.id} -> ${orphanedSpan.original_parent_id}`);
      
      const { error: updateError } = await supabaseClient
        .from('spans')
        .update({ 
          parent_span_id: orphanedSpan.original_parent_id,
          original_parent_id: null // Clear the original_parent_id since we've fixed the relationship
        })
        .eq('id', orphanedSpan.id)
        .eq('user_id', userId);
        
      if (updateError) {
        console.error('[Traces/Ingest] Error updating parent relationship:', updateError);
      } else {
        console.log(`[Traces/Ingest] ✅ Successfully updated parent relationship: ${orphanedSpan.id} -> ${orphanedSpan.original_parent_id}`);
      }
    }
  }
}

/**
 * Determine if a span should be the parent of another span based on their attributes
 */
function shouldBeParent(parentAttrs: any, childAttrs: any): boolean {
  // If the child is a response span and the parent is a handoff span, they should be related
  if (childAttrs.span_type === 'response' && parentAttrs.span_type === 'handoff') {
    return true;
  }
  
  // If the child is a response span and the parent is an agent span, they should be related
  if (childAttrs.span_type === 'response' && parentAttrs.span_type === 'agent') {
    return true;
  }
  
  // Add more relationship logic as needed
  return false;
}

/**
 * Sort spans by dependency order to ensure parent spans are inserted before child spans
 */
function sortSpansByDependency(spans: any[]): any[] {
  const spanMap = new Map(spans.map(span => [span.id, span]));
  const sorted: any[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(spanId: string) {
    if (visiting.has(spanId)) {
      console.warn(`[Traces/Ingest] Circular dependency detected for span: ${spanId}`);
      return;
    }
    if (visited.has(spanId)) {
      return;
    }

    visiting.add(spanId);
    const span = spanMap.get(spanId);
    
    if (span && span.parent_span_id) {
      // Only visit parent if it exists in our current batch
      if (spanMap.has(span.parent_span_id)) {
        visit(span.parent_span_id);
      } else {
        console.warn(`[Traces/Ingest] Parent span ${span.parent_span_id} not found in current batch for span ${spanId}, will be inserted as orphaned`);
        // Don't set parent to null - keep the original parent_id for later relationship fixing
      }
    }
    
    visiting.delete(spanId);
    visited.add(spanId);
    
    if (span) {
      sorted.push(span);
    }
  }

  // Visit all spans
  for (const span of spans) {
    if (!visited.has(span.id)) {
      visit(span.id);
    }
  }

  return sorted;
}

/**
 * Process a span object into database format
 */
async function processSpan(span: any, traceId: string, userId: string, threadId: string | null, supabaseClient: any, inferredThreadIdByTrace?: Map<string, string>) {
  // Debug: Log the full span structure to see what we're actually getting
  console.log(`[Traces/Ingest] Processing span ${span.id}:`, {
    id: span.id,
    parent_id: span.parent_id,
    parentSpanId: span.parentSpanId,
    parent_span_id: span.parent_span_id,
    span_data: span.span_data
  });
  
  
  // Calculate duration from start/end times
  const startTime = new Date(span.started_at || span.startedAt || span.start_time || new Date().toISOString());
  const endTime = new Date(span.ended_at || span.endedAt || span.end_time || span.completedAt || new Date().toISOString());
  const durationMs = endTime.getTime() - startTime.getTime();

  // Extract name from span_data if available
  let name = 'unknown';
  if (span.span_data) {
    if (span.span_data.type === 'agent') {
      name = `Agent: ${span.span_data.name || 'Unknown'}`;
    } else if (span.span_data.type === 'response') {
      name = `POST /v1/responses`;
    } else if (span.span_data.type === 'handoff') {
      name = `Handoff > ${span.span_data.to_agent || 'Unknown'}`;
    } else {
      name = span.span_data.type || 'unknown';
    }
  } else {
    name = span.name || 'unknown';
  }

  // Extract detailed information from span_data OR directly from span attributes
  let spanType = 'unknown';
  let responseId = null;
  let agentName = null;
  let tools = [];
  let handoffs = [];
  let outputType = null;
  let fromAgent = null;
  let toAgent = null;

  // Response-specific data
  let model = null;
  let tokens = null;
  let instructions = null;
  let input = null;
  let output = null;
  let functions = [];

  // Try to extract from span_data first (OpenAI TracingExporter format)
  if (span.span_data) {
    console.log(`[Traces/Ingest] Found span_data with type: ${span.span_data.type}`);
    console.log(`[Traces/Ingest] span_data keys:`, Object.keys(span.span_data));

    spanType = span.span_data.type || 'unknown';

    // For response spans, look up the full response data using response_id
    if (span.span_data.type === 'response') {
      // Log the complete span_data for debugging
      console.log(`[Traces/Ingest] Response span_data:`, JSON.stringify(span.span_data, null, 2));

      responseId = span.span_data.response_id || span.span_data.id || null;

      // Look up the full response data from the responses table
      if (responseId && supabaseClient) {
        console.log(`[Traces/Ingest] 🔍 Looking up response data for: ${responseId} with user_id: ${userId}`);
        try {
          const { data: responseData, error: responseError } = await supabaseClient
            .from('responses')
            .select('*')
            .eq('id', responseId)
            .eq('user_id', userId)
            .single();

          if (responseError) {
            console.warn(`[Traces/Ingest] Response data not found for ${responseId} (user: ${userId}):`, responseError);
          } else if (responseData) {
            console.log(`[Traces/Ingest] ✅ Found response data:`, {
              model: responseData.model,
              hasInstructions: !!responseData.instructions,
              hasUsage: !!responseData.usage,
              hasTools: !!responseData.tools,
              hasOutput: !!responseData.output,
            });

            // Extract data from the stored response
            model = responseData.model || null;
            instructions = responseData.instructions || null;
            outputType = responseData.output_type || null;

            // Extract token usage
            if (responseData.usage) {
              tokens = responseData.usage.total_tokens ||
                       (responseData.usage.input_tokens || 0) + (responseData.usage.output_tokens || 0);
            }

            // Extract tools/functions
            if (responseData.tools && Array.isArray(responseData.tools)) {
              // Convert tool objects to just function names for the UI
              functions = responseData.tools.map((tool: any) => tool.name || tool);
              tools = responseData.tools;
            }

            // If the response has a thread_id, capture it so we can backfill trace.thread_id
            if (!threadId && responseData.thread_id && inferredThreadIdByTrace) {
              inferredThreadIdByTrace.set(traceId, responseData.thread_id);
              console.log(`[Traces/Ingest] Inferred thread_id ${responseData.thread_id} for trace ${traceId} from response ${responseId}`);
            }

            // Extract messages for input (if available)
            if (responseData.messages && Array.isArray(responseData.messages)) {
              input = responseData.messages
                .filter((msg: any) => msg.role === 'user')
                .map((msg: any) => {
                  if (typeof msg.content === 'string') return msg.content;
                  if (Array.isArray(msg.content)) {
                    // Handle both Agents SDK format [{type: 'input_text', text: '...'}]
                    // and OpenAI format [{type: 'text', text: '...'}]
                    return msg.content.map((c: any) => c.text || c.content || '').join('\n');
                  }
                  return '';
                })
                .join('\n');
            }

            // Extract output from response
            if (responseData.output && Array.isArray(responseData.output)) {
              output = responseData.output.map((item: any) => {
                if (typeof item === 'string') return item;
                if (item.content && Array.isArray(item.content)) {
                  return item.content.map((c: any) => c.text || c.content || '').join('\n');
                }
                if (item.content && typeof item.content === 'string') return item.content;
                if (item.text) return item.text;
                return '';
              }).join('\n');
            }
          }
        } catch (error) {
          console.error(`[Traces/Ingest] Error looking up response data:`, error);
        }
      }
    }
    // For agent spans
    else if (span.span_data.type === 'agent') {
      agentName = span.span_data.name || null;
      tools = span.span_data.tools || [];
      handoffs = span.span_data.handoffs || [];
    }
    // For handoff spans
    else if (span.span_data.type === 'handoff') {
      fromAgent = span.span_data.from_agent || null;
      toAgent = span.span_data.to_agent || null;
    }
  }

  // Also try to extract from span.attributes (OpenAI format)
  if (span.attributes) {
    // OpenAI SDK might send data directly in attributes
    spanType = span.attributes.span_type || span.attributes.type || spanType;
    responseId = span.attributes.response_id || responseId;
    agentName = span.attributes.agent_name || span.attributes.name || agentName;
    model = span.attributes.model || model;

    // Token usage might be nested
    if (span.attributes.usage) {
      tokens = span.attributes.usage.total_tokens || span.attributes.usage.total || tokens;
    } else if (span.attributes.tokens) {
      tokens = span.attributes.tokens;
    }

    // Instructions might be in different places
    instructions = span.attributes.instructions || span.attributes.system || instructions;

    // Input/Output might be nested in messages or content
    if (span.attributes.input) {
      if (typeof span.attributes.input === 'string') {
        input = span.attributes.input;
      } else if (Array.isArray(span.attributes.input)) {
        // Extract text from message array
        input = span.attributes.input.map((msg: unknown) =>
          typeof msg === 'string' ? msg : ((msg as Record<string, unknown>).content || (msg as Record<string, unknown>).text || '')
        ).join('\n');
      }
    }

    if (span.attributes.output) {
      if (typeof span.attributes.output === 'string') {
        output = span.attributes.output;
      } else if (Array.isArray(span.attributes.output)) {
        // Extract text from response array
        output = span.attributes.output.map((msg: unknown) =>
          typeof msg === 'string' ? msg : ((msg as Record<string, unknown>).content || (msg as Record<string, unknown>).text || '')
        ).join('\n');
      } else if ((span.attributes.output as Record<string, unknown>).content) {
        output = (span.attributes.output as Record<string, unknown>).content as string;
      }
    }

    // Functions/tools
    if (span.attributes.functions) {
      functions = Array.isArray(span.attributes.functions) ? span.attributes.functions : [span.attributes.functions];
    }
    if (span.attributes.tools) {
      tools = Array.isArray(span.attributes.tools) ? span.attributes.tools : [span.attributes.tools];
    }
  }

  console.log(`[Traces/Ingest] Response span data extracted:`, {
    model, tokens, instructions, input, output, functions,
    spanType, responseId, agentName
  });

  return {
    id: span.id || span.spanId,
    trace_id: traceId,
    parent_span_id: span.parent_id || span.parentSpanId || span.parent_span_id || null,
    user_id: userId,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration_ms: Math.max(0, durationMs),
    name: name,
    kind: span.kind || 'internal',
    status: span.error ? 'error' : (span.status || 'ok'),
    status_message: span.error ? span.error.message || span.error : (span.statusMessage || span.status_message || null),
    attributes: {
      ...span.attributes,
      span_type: spanType,
      response_id: responseId,
      // Include thread_id if we know it (directly or inferred)
      thread_id: threadId || (inferredThreadIdByTrace ? inferredThreadIdByTrace.get(traceId) || null : null),
      agent_name: agentName,
      tools: tools,
      handoffs: handoffs,
      output_type: outputType,
      from_agent: fromAgent,
      to_agent: toAgent,
      // Response-specific attributes
      model: model,
      tokens: tokens,
      instructions: instructions,
      input: input,
      output: output,
      functions: functions,
      span_data: span.span_data // Keep original span_data for reference
    },
    events: span.events || [],
    links: span.links || [],
    created_at: new Date().toISOString(),
  };
}
