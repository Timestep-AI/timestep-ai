// Simplified tracing service - extends OpenAI's TracingExporter to point to our endpoint
import { OpenAITracingExporter } from '@openai/agents-openai';
import { BatchTraceProcessor, addTraceProcessor } from '@openai/agents-core';

/**
 * A tracing exporter that extends OpenAI's exporter but points to our Timestep AI edge function.
 * Simply changes the endpoint from OpenAI's API to our /openai-polyfill/traces/ingest endpoint.
 */
export class TimestepAITracingExporter extends OpenAITracingExporter {
  constructor(supabaseUrl: string, userJwt: string) {
    super({
      endpoint: `${supabaseUrl}/functions/v1/openai-polyfill/traces/ingest`,
      apiKey: userJwt,
      organization: '',
      project: '',
    });
    
    console.log(`[TimestepAITracingExporter] Created with endpoint: ${supabaseUrl}/functions/v1/openai-polyfill/traces/ingest`);
  }
}

// Track added processors to avoid duplicates
const addedProcessors = new Set<string>();

/**
 * Adds the Timestep AI Tracing exporter with a BatchTraceProcessor to handle traces.
 * This sends traces to our Timestep AI edge function instead of OpenAI.
 */
export function addTimestepAITraceProcessor(supabaseUrl: string, userJwt: string): void {
  const processorKey = `${supabaseUrl}-${userJwt}`;
  
  if (addedProcessors.has(processorKey)) {
    console.log(`[TracingService] Trace processor already added for this user, skipping`);
    return;
  }

  const exporter = new TimestepAITracingExporter(supabaseUrl, userJwt);
  const processor = new BatchTraceProcessor(exporter);
  addTraceProcessor(processor);
  
  addedProcessors.add(processorKey);

  console.log(`[TracingService] ✅ Timestep AI trace processor added for user`);
  console.log(`[TracingService] Traces will be sent to: ${supabaseUrl}/functions/v1/openai-polyfill/traces/ingest`);
}
