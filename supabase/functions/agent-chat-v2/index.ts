// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { setDefaultOpenAIKey, setDefaultOpenAITracingExporter } from '@openai/agents-openai';
import { OpenAIConversationsSession } from '@openai/agents-openai';

// Configure OpenAI API key and tracing exporter
// This must be called before any agents-core usage
const DEFAULT_OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
if (DEFAULT_OPENAI_API_KEY) {
  setDefaultOpenAIKey(DEFAULT_OPENAI_API_KEY);
}

// Configure HTTP exporter to send traces to OpenAI's servers
setDefaultOpenAITracingExporter();
import { ChatKitDataStore, ChatKitAttachmentStore, type TContext } from './stores.ts';
import type { Store, AttachmentStore } from './chatkit/store.ts';
import type { ThreadMetadata, ThreadStreamEvent, UserMessageItem } from './chatkit/types.ts';
import { ChatKitServer, StreamingResult } from './chatkit/server.ts';
import { AgentContext, simple_to_agent_input as simpleToAgentInput, stream_agent_response as streamAgentResponse, type ClientToolCall } from './chatkit/agents.ts';
import { Agent, Runner, tool } from '@openai/agents-core';
import type { ModelSettings } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';
import OpenAI from 'openai';
import type { RunConfig } from '@openai/agents-core';

// Constants for theme switching
const SUPPORTED_COLOR_SCHEMES = new Set(['light', 'dark']);
const CLIENT_THEME_TOOL_NAME = 'switch_theme';

/**
 * Normalize color scheme input to 'light' or 'dark'
 */
function normalizeColorScheme(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (SUPPORTED_COLOR_SCHEMES.has(normalized)) {
    return normalized;
  }
  if (normalized.includes('dark')) {
    return 'dark';
  }
  if (normalized.includes('light')) {
    return 'light';
  }
  throw new Error("Theme must be either 'light' or 'dark'.");
}

// Interface for agent record from database
interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  instructions: string;
  tool_ids: string[];
  handoff_ids: string[];
  model: string | null;
  model_settings: any;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Get an agent record from the database by ID
 * Returns null if not found
 */
async function getAgentById(agentId: string, ctx: TContext): Promise<AgentRecord | null> {
  if (!ctx.user_id) {
    return null;
  }
  
  const { data: agentData, error } = await ctx.supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('user_id', ctx.user_id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('[agent-chat-v2] Error fetching agent:', error);
    return null;
  }
  
  return agentData as AgentRecord | null;
}

/**
 * Ensure the default MCP server exists for the user
 * Matches Python ensure_default_mcp_server implementation
 */
async function ensureDefaultMcpServer(ctx: TContext): Promise<void> {
  if (!ctx.user_id) {
    return;
  }
  
  const defaultServerId = '00000000-0000-0000-0000-000000000000';
  
  // Check if it exists
  const { data: existing } = await ctx.supabase
    .from('mcp_servers')
    .select('*')
    .eq('id', defaultServerId)
    .eq('user_id', ctx.user_id)
    .single();
  
  if (existing) {
    return; // Already exists
  }
  
  // Create it
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    return; // Skip if URL not available
  }
  
  const { error } = await ctx.supabase.from('mcp_servers').insert({
    id: defaultServerId,
    user_id: ctx.user_id,
    name: 'MCP Environment Server',
    url: `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mcp-env/mcp`,
  });
  
  // Ignore duplicate key errors (23505) - means another process created it
  if (error && error.code !== '23505') {
    console.warn('[agent-chat-v2] Error creating default MCP server:', error);
  }
}

/**
 * Switch the theme between light and dark mode.
 * This is a client tool that triggers a theme change in the frontend.
 *
 * Matches Python switch_theme implementation
 *
 * NOTE: Using JSON Schema directly instead of Zod because:
 * - Zod schemas require strict: true in the agents SDK
 * - The zodResponsesFunction helper may not be available in Deno/npm environment
 * - JSON Schema is universally supported by all model providers
 */
const switchTheme = tool({
  name: 'switch_theme',
  description: 'Switch the chat interface between light and dark color schemes.',
  parameters: {
    type: 'object',
    properties: {
      theme: {
        type: 'string',
        description: 'The theme to switch to: "light" or "dark"',
        enum: ['light', 'dark'],
      },
    },
    required: ['theme'],
    additionalProperties: false,
  },
  strict: false, // Using JSON Schema directly, not Zod
  execute: ({ theme }: { theme: string }, ctx: { context?: AgentContext }) => {
    console.log('[agent-chat-v2] switch_theme tool called with theme:', theme);
    console.log('[agent-chat-v2] Context type:', typeof ctx, 'ctx:', ctx);
    try {
      const requested = normalizeColorScheme(theme);
      console.log('[agent-chat-v2] Normalized theme to:', requested);

      // The tool receives a RunContext that wraps our AgentContext in the 'context' property
      const agentContext = ctx.context as AgentContext;
      if (!agentContext) {
        console.error('[agent-chat-v2] No AgentContext found in RunContext');
        return null;
      }

      agentContext.client_tool_call = {
        name: CLIENT_THEME_TOOL_NAME,
        arguments: { theme: requested },
      };
      console.log('[agent-chat-v2] Set client_tool_call:', agentContext.client_tool_call);
      return { theme: requested };
    } catch (error) {
      console.error('[agent-chat-v2] Failed to switch theme:', error);
      return null;
    }
  },
});

/**
 * Ensure default agents exist for the user
 * Matches Python ensure_default_agents_exist implementation
 */
async function ensureDefaultAgentsExist(ctx: TContext): Promise<void> {
  if (!ctx.user_id) {
    return;
  }
  
  const defaultModel = Deno.env.get('DEFAULT_AGENT_MODEL') || 'gpt-4o';
  const defaultModelSettings = {
    temperature: 0.0,
    toolChoice: 'auto',
    reasoning: { effort: null }
  };
  
  // Default Personal Assistant
  const personalAssistantId = '00000000-0000-0000-0000-000000000000';
  if (!(await getAgentById(personalAssistantId, ctx))) {
    const { error } = await ctx.supabase.from('agents').insert({
      id: personalAssistantId,
      user_id: ctx.user_id,
      name: 'Personal Assistant',
      instructions: `# System context
You are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstraction: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named \`transfer_to_<agent_name>\`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.
You are an AI agent acting as a personal assistant.`,
      tool_ids: ['00000000-0000-0000-0000-000000000000.think'],
      handoff_ids: ['ffffffff-ffff-ffff-ffff-ffffffffffff'],
      model: defaultModel,
      model_settings: defaultModelSettings,
    });
    
    // Ignore duplicate key errors
    if (error && error.code !== '23505') {
      console.warn('[agent-chat-v2] Error creating default Personal Assistant:', error);
    }
  }
  
  // Default Weather Assistant
  const weatherAssistantId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  if (!(await getAgentById(weatherAssistantId, ctx))) {
    const { error } = await ctx.supabase.from('agents').insert({
      id: weatherAssistantId,
      user_id: ctx.user_id,
      name: 'Weather Assistant',
      instructions: 'You are a helpful AI assistant that can answer questions about weather. When asked about weather, you MUST use the get_weather tool to get accurate, real-time weather information.',
      tool_ids: [
        '00000000-0000-0000-0000-000000000000.get_weather',
        '00000000-0000-0000-0000-000000000000.think',
      ],
      handoff_ids: [],
      model: defaultModel,
      model_settings: defaultModelSettings,
    });
    
    // Ignore duplicate key errors
    if (error && error.code !== '23505') {
      console.warn('[agent-chat-v2] Error creating default Weather Assistant:', error);
    }
  }
}

/**
 * Load an agent from the database by ID
 * Matches Python implementation: queries agents table with RLS
 */
async function loadAgentFromDatabase(agentId: string, ctx: TContext): Promise<Agent> {
  console.log('[agent-chat-v2] loadAgentFromDatabase called for agent:', agentId);
  if (!ctx.user_id) {
    throw new Error('user_id is required to load agents');
  }

  console.log('[agent-chat-v2] Getting agent from database...');
  const agentRecord = await getAgentById(agentId, ctx);
  console.log('[agent-chat-v2] Got agent record:', agentRecord ? 'found' : 'NOT FOUND');
  if (!agentRecord) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const tools = [switchTheme];

  console.log(`[agent-chat-v2] Loading agent ${agentId} with model ${agentRecord.model}, model_settings ${JSON.stringify(agentRecord.model_settings)}, and tools: ${tools.map((t: any) => t.name || 'unknown')}`);

  const agent = new Agent({
    model: agentRecord.model,
    name: agentRecord.name,
    instructions: agentRecord.instructions,
    tools: tools,
    toolUseBehavior: { stopAtToolNames: [CLIENT_THEME_TOOL_NAME] },
    modelSettings: agentRecord.model_settings as ModelSettings,
  });
  console.log('[agent-chat-v2] Agent created:', agentRecord.name);

  return agent;
}

function getSessionForThread(threadId: string, ctx: TContext): OpenAIConversationsSession {
  /**Create or get an OpenAIConversationsSession for a given thread.
  
  Points to the openai-polyfill Conversations API using the request's JWT.
  Matches Python version: OpenAIConversationsSession(conversation_id=thread_id, openai_client=client)
  */
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required');
  }
  const baseUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/openai-polyfill`;
  const apiKey = ctx.user_jwt || 'anonymous';
  const client = new OpenAI({
    baseURL: baseUrl,
    apiKey: apiKey,
  });
  // Use a stable conversation_id per thread to retain history
  // Return an actual OpenAIConversationsSession instance that implements Session
  return new OpenAIConversationsSession({
    conversationId: threadId,
    client: client,
  });
}

class MyChatKitServer extends ChatKitServer {
  constructor(dataStore: Store<TContext>, attachmentStore?: AttachmentStore<TContext> | null) {
    super(dataStore, attachmentStore ?? null);
  }


  async *respond(
    thread: ThreadMetadata,
    input: UserMessageItem | null,
    context: TContext
  ): AsyncIterable<ThreadStreamEvent> {
    console.log('[agent-chat-v2] respond() called for thread:', thread.id, 'agent:', context.agent_id);
    const agentContext = new AgentContext(thread, this.store, context);

    // NOTE: Removed early return for ClientToolCallItem
    // With StopAtTools, the agent naturally stops after calling the client tool,
    // and should not continue until explicitly resumed. The early return was
    // preventing the initial agent response from being generated.

    // Load agent from database using agent_id from context
    // agent_id is required - no fallbacks
    const agent_id = context.agent_id;
    if (!agent_id) {
      throw new Error('agent_id is required in context');
    }

    console.log('[agent-chat-v2] About to call loadAgentFromDatabase');
    const agent = await loadAgentFromDatabase(agent_id, context);
    console.log('[agent-chat-v2] loadAgentFromDatabase returned successfully');
    
    // Create Conversations session bound to polyfill with per-request JWT
    const session = getSessionForThread(thread.id, context);
    
    // Convert input to agent format
    const agentInput = input ? await simpleToAgentInput(input) : [];
    console.log(`[agent-chat-v2] agentInput:`, JSON.stringify(agentInput, null, 2));
    
    // When using session memory with list inputs, we need to provide a callback
    // that defines how to merge history items with new items.
    // The session automatically saves items after the run completes.
    const sessionInputCallback = async (historyItems: any[], newItems: any[]): Promise<any[]> => {
      console.log(`[session_input_callback] sessionInputCallback called with historyItems length:`, historyItems.length, `and newItems length:`, newItems.length);
      try {
        console.log(`[session_input_callback] ===== CALLBACK INVOKED =====`);
        console.log(`[session_input_callback] Called with ${historyItems.length} history items and ${newItems.length} new items`);
        console.log(`[session_input_callback] History items:`, JSON.stringify(historyItems, null, 2));
        console.log(`[session_input_callback] New items:`, JSON.stringify(newItems, null, 2));

      /**
       * Remove fields that OpenAI Responses API doesn't accept.
       * 
       * IMPORTANT: function_call and function_call_output items must be preserved
       * with ALL their fields so the agent can see the complete tool call history.
       * 
       * CRITICAL: ClientToolCallItems must be converted to function_call + function_call_output
       * format so the agent knows the tool was already called and can continue.
       */
      function sanitizeItem(item: any): any | any[] | null {
        console.log(`[session_input_callback] sanitizeItem called with item:`, item);
        // Match Python: if isinstance(item, dict): - only process dicts/objects (not arrays)
        // Python's isinstance(item, dict) returns False for arrays, so we need to exclude arrays too
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          console.log(`[session_input_callback] sanitizeItem: item is not a dict/object (or is array):`, item);
          return item;
        }

        // Match Python: item_type = item.get("type")
        const itemType = item.type;
        console.log(`[session_input_callback] sanitizeItem: itemType="${itemType}"`);

        // Check if this is a ClientToolCallItem (type='client_tool_call')
        // These need special handling - must NOT be stripped to just role/content
        if (itemType === 'client_tool_call') {
          console.log(`[session_input_callback] Found client_tool_call item: status=${item.status}, name=${item.name}`);
          // Only include completed tool calls (skip pending ones)
          if (item.status === 'completed') {
            // Convert to the format the agent expects:
            // First the function_call, then the function_call_output
            const result = [
              {
                type: 'function_call',
                call_id: item.call_id,
                name: item.name,
                arguments: item.arguments || {},
              },
              {
                type: 'function_call_output',
                call_id: item.call_id,
                output: item.output,
              }
            ];
            console.log(`[session_input_callback] Converted completed client_tool_call to:`, result);
            return result;
          } else {
            // Pending tool calls should be filtered out
            console.log(`[session_input_callback] Filtering out pending client_tool_call`);
            return null;
          }
        }

        // Handle function_call_result from Conversations API
        // TypeScript Agents SDK accepts function_call_result and converts it to function_call_output internally
        if (itemType === 'function_call_result') {
          console.log(`[session_input_callback] Preserving function_call_result item:`, item);
          // TypeScript Agents SDK expects function_call_result format (not function_call_output)
          const sanitized: any = {
            type: 'function_call_result',
            // Support both camelCase (callId) and snake_case (call_id) from Conversations API
            callId: item.callId || item.call_id,
            output: item.output,
            status: item.status,
          };
          return sanitized;
        }

        // If this is already a function_call from the Conversations API, keep it as-is
        if (itemType === 'function_call') {
          console.log(`[session_input_callback] Preserving function_call item:`, item);
          // Remove extra fields that OpenAI doesn't accept, but keep the essential ones
          const sanitized: any = {
            type: 'function_call',
            // Support both camelCase (callId) and snake_case (call_id) from Conversations API
            callId: item.callId || item.call_id,
            name: item.name,
            arguments: item.arguments || {},
            status: item.status,
          };
          return sanitized;
        }

        // Convert function_call_output to function_call_result format
        // TypeScript Agents SDK expects function_call_result (not function_call_output) in input
        if (itemType === 'function_call_output') {
          console.log(`[session_input_callback] Converting function_call_output to function_call_result:`, item);
          const sanitized: any = {
            type: 'function_call_result',
            // Support both camelCase (callId) and snake_case (call_id) from Conversations API
            callId: item.callId || item.call_id,
            output: item.output,
            status: item.status || 'completed',
          };
          return sanitized;
        }

        // For regular messages, keep only role and content
        // Match Python: always return { role, content } - do NOT add type field
        // The Agent SDK will handle the content format correctly
        const sanitized: any = {
          role: item.role,
          content: item.content,
        };
        console.log(`[session_input_callback] Sanitized message item:`, sanitized);
        return sanitized;
      }

      // Sanitize history items (they come from the conversation API with extra fields)
      const sanitizedHistory: any[] = [];
      for (const item of historyItems) {
        const result = sanitizeItem(item);
        if (result !== null) {
          // sanitizeItem can return a list (for client tool calls) or a dict
          if (Array.isArray(result)) {
            sanitizedHistory.push(...result);
          } else {
            sanitizedHistory.push(result);
          }
        }
      }

      // New items should already be clean, but sanitize them too just in case
      const sanitizedNew: any[] = [];
      for (const item of newItems) {
        const result = sanitizeItem(item);
        if (result !== null) {
          if (Array.isArray(result)) {
            sanitizedNew.push(...result);
          } else {
            sanitizedNew.push(result);
          }
        }
      }

      const merged = [...sanitizedHistory, ...sanitizedNew];
      
      // Sort items to ensure function_call always comes before function_call_result
      // This is required by the Chat Completions API: tool messages must follow assistant messages with tool_calls
      // The SDK converts function_call to assistant message with tool_calls, and function_call_result to tool message
      // We need to ensure that for each callId, function_call comes before function_call_result
      // NOTE: Both Python and TypeScript SDKs handle ordering the same way (accumulate tool calls, flush on output),
      // but if items come from the Conversations API in the wrong order (function_call_result before function_call),
      // the SDK will create a tool message without a corresponding assistant message with tool_calls, which violates
      // the Chat Completions API. The Python version might not need this if history items are already in the correct
      // order, but we need to sort items here to ensure they're in the correct order before passing them to the SDK.
      // First, assign original indices to preserve order
      const itemsWithIndices = merged.map((item, index) => ({ item, originalIndex: index }));
      
      const sorted = itemsWithIndices.sort((a, b) => {
        const aItem = a.item;
        const bItem = b.item;
        const aType = aItem.type;
        const bType = bItem.type;
        const aCallId = aItem.callId || aItem.call_id;
        const bCallId = bItem.callId || bItem.call_id;
        
        // If both items have the same callId, ensure function_call comes before function_call_result
        if (aCallId && bCallId && aCallId === bCallId) {
          if (aType === 'function_call' && bType === 'function_call_result') {
            return -1; // function_call comes before function_call_result
          }
          if (aType === 'function_call_result' && bType === 'function_call') {
            return 1; // function_call comes before function_call_result
          }
        }
        
        // Otherwise, preserve original order
        return a.originalIndex - b.originalIndex;
      });

      const sortedItems = sorted.map(({ item }) => item);
      console.log(`[session_input_callback] Returning ${sortedItems.length} merged items (sorted):`, sortedItems);
      return sortedItems;
      } catch (error) {
        console.error(`[session_input_callback] ERROR in callback:`, error);
        throw error;
      }
    };
    
    console.log(`[agent-chat-v2] sessionInputCallback defined, type:`, typeof sessionInputCallback, `is function:`, typeof sessionInputCallback === 'function');
    
    // Match Python: Runner.run_streamed(agent, agent_input, context=agent_context, session=session, run_config=run_config)
    // The session contains the OpenAI client configured to use the polyfill for conversation history
    // The Runner uses the multi-provider for actual model calls
    // Create Runner with multi-provider support
    // Match agent-chat implementation - wire up multi-provider directly
    let runner: Runner;
    try {
      // Dynamically import multi-provider components only when needed
      const { OllamaModelProvider } = await import('./utils/ollama_model_provider.ts');
      const { MultiModelProvider, MultiModelProviderMap } = await import('./utils/multi_model_provider.ts');

      const modelProviderMap = new MultiModelProviderMap();

      // Add Anthropic provider using OpenAI interface
      if (Deno.env.get('ANTHROPIC_API_KEY')) {
        modelProviderMap.addProvider(
          'anthropic',
          new OpenAIProvider({
            apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
            baseURL: 'https://api.anthropic.com/v1/',
            useResponses: false,
          })
        );
      }

      if (Deno.env.get('HF_TOKEN')) {
        modelProviderMap.addProvider(
          'hf_inference_endpoints',
          new OpenAIProvider({
            apiKey: Deno.env.get('HF_TOKEN'),
            baseURL: 'https://bb8igs5dnyzb8gu1.us-east-1.aws.endpoints.huggingface.cloud/v1/',
            useResponses: false,
          })
        );

        modelProviderMap.addProvider(
          'hf_inference_providers',
          new OpenAIProvider({
            apiKey: Deno.env.get('HF_TOKEN'),
            baseURL: 'https://router.huggingface.co/v1',
            useResponses: false,
          })
        );
      }

      if (Deno.env.get('OLLAMA_API_KEY')) {
        modelProviderMap.addProvider(
          'ollama',
          new OllamaModelProvider({
            apiKey: Deno.env.get('OLLAMA_API_KEY'),
          })
        );
      }

      // Use MultiModelProvider for model selection - it will delegate to OpenAIProvider by default
      const modelProvider = new MultiModelProvider({
        provider_map: modelProviderMap,
        openai_api_key: DEFAULT_OPENAI_API_KEY || '',
        openai_use_responses: false,
      });
      
      // Match Python: RunConfig contains model_provider (not sessionInputCallback per TypeScript library docs)
      // sessionInputCallback goes in run() options when using array input
      // Match Python: RunConfig(session_input_callback=session_input_callback, model_provider=model_provider)
      // Note: Only modelProvider goes in Runner constructor; sessionInputCallback goes in run() options
      console.log(`[agent-chat-v2] Creating Runner with modelProvider in constructor RunConfig`);
      runner = new Runner({
        modelProvider: modelProvider,
      } as any);
      console.log(`[agent-chat-v2] Runner created`);
    } catch (error) {
      console.error('[agent-chat-v2] Error creating Runner:', error);
      throw error;
    }
    
    // Match Python: Runner.run_streamed returns an AsyncIterator directly
    // In JavaScript, runner.run() with stream: true returns the stream directly
    // Use the dynamically loaded agent instead of hardcoded this.assistantAgent
    // According to docs: "When you pass an array of AgentInputItems as the run input, 
    // provide a sessionInputCallback to merge them with stored history deterministically."
    // Match Python: RunConfig contains both session_input_callback and model_provider
    // So both should be in runner.run() options
    try {
      // Match Python: Runner.run_streamed takes session separately and RunConfig
      // TypeScript library: sessionInputCallback goes in run() options (not RunConfig per docs)
      // Required when passing array input per docs: "provide a sessionInputCallback to merge them with stored history"
      console.log(`[agent-chat-v2] About to call runner.run() with session:`, !!session, `agentInput length:`, agentInput.length);
      console.log(`[agent-chat-v2] agentInput:`, JSON.stringify(agentInput, null, 2));
      console.log(`[agent-chat-v2] sessionInputCallback defined:`, typeof sessionInputCallback, `is function:`, typeof sessionInputCallback === 'function');
      const result = await runner.run(agent, agentInput, {
        context: agentContext,
        stream: true,
        session: session,
        sessionInputCallback: sessionInputCallback as any, // Required for array input, not in RunConfig per TypeScript library
      } as any);
      console.log(`[agent-chat-v2] runner.run() returned, result type:`, typeof result);
      console.log(`[agent-chat-v2] result is AsyncIterable:`, result && typeof result[Symbol.asyncIterator] === 'function');
      
      // Log the input property of the result to see what the Runner actually received after preparation
      if (result && typeof result === 'object' && 'input' in result) {
        const resultInput = (result as any).input;
        console.log(`[agent-chat-v2] result.input after Runner preparation:`, {
          length: Array.isArray(resultInput) ? resultInput.length : 'not array',
          type: typeof resultInput,
          isArray: Array.isArray(resultInput),
          value: JSON.stringify(resultInput, null, 2),
        });
      }
      
      // Match Python: async for event in _merge_generators(result.stream_events(), queue_iterator):
      // TypeScript: result implements AsyncIterable directly, so use result directly
      // Python's stream_events() waits for _run_impl_task in finally block, ensuring background task completes
      // TypeScript's StreamedRunResult implements AsyncIterable directly, so we iterate it directly
      if (!result || typeof result !== 'object' || !(Symbol.asyncIterator in result)) {
        throw new Error(`[agent-chat-v2] Result is not an AsyncIterable`);
      }
      const streamToIterate = result as AsyncIterable<any>;
      
      // Match Python: The session automatically saves items after the run completes
      // No need to manually save items - the Runner handles it
      let eventCount = 0;
      console.log(`[agent-chat-v2] Starting to iterate streamAgentResponse...`);
      // Python's stream_events() actively pulls from _event_queue and waits for _run_impl_task in finally block
      // TypeScript's StreamedRunResult implements AsyncIterable directly - ReadableStream starts when we iterate
      // CRITICAL: When agentInput is empty but result.input has merged history, we MUST iterate
      // the stream to start the ReadableStream, which allows the stream loop to enqueue items
      // The stream loop runs asynchronously and enqueues items to #readableController when available
      
      // Wrap streamAgentResponse to fix __fake_id__ in thread.item.added and thread.item.done events
      // CRITICAL: If items are saved with __fake_id__, they will overwrite each other due to PRIMARY KEY constraint
      // CRITICAL: Both thread.item.added and thread.item.done must have the SAME ID so the frontend recognizes them as the same item
      // This ensures ChatKit items have proper IDs (defense-in-depth - add_thread_item also fixes IDs)
      async function* fixChatKitEventIds(events: AsyncIterable<ThreadStreamEvent>): AsyncIterable<ThreadStreamEvent> {
        // Track IDs we've generated for items, so thread.item.added and thread.item.done use the same ID
        const itemIdMap: Map<string, string> = new Map(); // Maps original __fake_id__ to generated ID
        
        for await (const event of events) {
          // Fix __fake_id__ in thread.item.added events
          if (event.type === 'thread.item.added' && (event as any).item) {
            const item = (event as any).item;
            const originalId = item.id || 'N/A';
            const itemType = item.type || 'unknown';
            const contentLength = item.content && Array.isArray(item.content) && item.content.length > 0
              ? (item.content[0].text || '').length
              : 0;
            const contentPreview = item.content && Array.isArray(item.content) && item.content.length > 0
              ? ((item.content[0].text || '').substring(0, 50) + ((item.content[0].text || '').length > 50 ? '...' : ''))
              : '';
            console.log(`[agent-chat-v2] thread.item.added: type=${itemType}, id=${originalId}, content_length=${contentLength}, content_preview=${contentPreview}`);
            
            if (originalId === '__fake_id__' || !originalId || originalId === 'N/A') {
              // Check if we've already generated an ID for this item (from a previous event)
              if (itemIdMap.has(originalId)) {
                item.id = itemIdMap.get(originalId)!;
                console.log(`[agent-chat-v2] Reusing ID for thread.item.added: ${originalId} -> ${item.id}`);
              } else {
                console.error(`[agent-chat-v2] CRITICAL: Fixing __fake_id__ for ${itemType} in thread.item.added (original_id=${originalId})`);
                let itemTypeForId: string;
                if (itemType === 'client_tool_call') {
                  itemTypeForId = 'tool_call';
                } else if (itemType === 'assistant_message' || itemType === 'user_message') {
                  itemTypeForId = 'message';
                } else {
                  itemTypeForId = 'message'; // Default fallback
                }
                item.id = data_store.generate_item_id(itemTypeForId, thread, context);
                itemIdMap.set(originalId, item.id);
                console.log(`[agent-chat-v2] Fixed ID in thread.item.added: ${originalId} -> ${item.id}`);
              }
            } else {
              console.log(`[agent-chat-v2] Item ${itemType} already has valid ID: ${originalId}`);
            }
          }
          
          // Fix __fake_id__ in thread.item.done events before they're saved
          if (event.type === 'thread.item.done' && (event as any).item) {
            const item = (event as any).item;
            const originalId = item.id || 'N/A';
            const itemType = item.type || 'unknown';
            const contentLength = item.content && Array.isArray(item.content) && item.content.length > 0
              ? (item.content[0].text || '').length
              : 0;
            const contentPreview = item.content && Array.isArray(item.content) && item.content.length > 0
              ? ((item.content[0].text || '').substring(0, 50) + ((item.content[0].text || '').length > 50 ? '...' : ''))
              : '';
            console.log(`[agent-chat-v2] thread.item.done: type=${itemType}, id=${originalId}, content_length=${contentLength}, content_preview=${contentPreview}`);
            
            if (originalId === '__fake_id__' || !originalId || originalId === 'N/A') {
              // Check if we've already generated an ID for this item (from thread.item.added)
              if (itemIdMap.has(originalId)) {
                item.id = itemIdMap.get(originalId)!;
                console.log(`[agent-chat-v2] Reusing ID for thread.item.done: ${originalId} -> ${item.id}`);
              } else {
                console.error(`[agent-chat-v2] CRITICAL: Fixing __fake_id__ for ${itemType} in thread.item.done (original_id=${originalId})`);
                let itemTypeForId: string;
                if (itemType === 'client_tool_call') {
                  itemTypeForId = 'tool_call';
                } else if (itemType === 'assistant_message' || itemType === 'user_message') {
                  itemTypeForId = 'message';
                } else {
                  itemTypeForId = 'message'; // Default fallback
                }
                item.id = data_store.generate_item_id(itemTypeForId, thread, context);
                itemIdMap.set(originalId, item.id);
                console.log(`[agent-chat-v2] Fixed ID in thread.item.done: ${originalId} -> ${item.id}`);
              }
            } else {
              console.log(`[agent-chat-v2] Item ${itemType} already has valid ID: ${originalId}`);
            }
          }
          
          yield event;
        }
      }
      
      for await (const event of fixChatKitEventIds(streamAgentResponse(agentContext, streamToIterate))) {
        eventCount++;
        console.log(`[agent-chat-v2] Stream event ${eventCount}:`, JSON.stringify(event, null, 2));
        yield event;
      }
      console.log(`[agent-chat-v2] Stream ended after ${eventCount} events`);
      const isEmptyInput = Array.isArray(agentInput) ? agentInput.length === 0 : agentInput === "";
      if (eventCount === 0 && isEmptyInput) {
        console.log(`[agent-chat-v2] WARNING: Empty stream with empty agentInput - Runner may not be generating response from history`);
      }
    } catch (error) {
      console.error('[agent-chat-v2] Error in runner.run():', error);
      throw error;
    }
  }
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1];
  return null;
}

function decodeJwtSub(jwtToken: string): string | null {
  try {
    const parts = jwtToken.split('.');
    if (parts.length < 2) return null;
    const payloadB64 = parts[1];
    // Base64url decode with padding
    const padding = '='.repeat((-payloadB64.length % 4 + 4) % 4);
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/') + padding);
    const payload = JSON.parse(payloadJson);
    return payload.sub || payload.user_id || null;
  } catch {
    return null;
  }
}

function buildRequestContext(request: Request, agentId?: string | null): TContext {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }
  const token = extractBearerToken(request);
  const client = createClient(supabaseUrl, supabaseKey, { 
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} } 
  });
  // Apply per-request RLS via JWT if present
  if (token && client.postgrest) {
    (client.postgrest as any).auth(token);
  }
  
  let user_id = request.headers.get('x-user-id') || request.headers.get('X-User-Id') || null;
  if (!user_id && token) {
    user_id = decodeJwtSub(token);
  }
  
  return { supabase: client, user_id, user_jwt: token, agent_id: agentId || null };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

// Initialize stores and server
const data_store = new ChatKitDataStore();
const attachment_store = new ChatKitAttachmentStore(data_store);
const server = new MyChatKitServer(data_store, attachment_store);

Deno.serve(async (request: Request) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle /agents/{agent_id}/chatkit endpoint
    const chatkitMatch = path.match(/\/agents\/([^\/]+)\/chatkit/);
    if (chatkitMatch) {
      const agentId = chatkitMatch[1];
      console.log('[agent-chat-v2] Processing chatkit request for agent:', agentId);
      // Build context with agent_id included
      const ctx = buildRequestContext(request, agentId);
      console.log('[agent-chat-v2] Context built:', { user_id: ctx.user_id, agent_id: ctx.agent_id });
      const body = new Uint8Array(await request.arrayBuffer());
      console.log('[agent-chat-v2] Body received, calling server.process');
      const result = await server.process(body, ctx);
      console.log('[agent-chat-v2] server.process completed, result type:', result instanceof StreamingResult ? 'StreamingResult' : 'other');
      if (result instanceof StreamingResult) {
        console.log('[agent-chat-v2] Creating ReadableStream from result.json_events');
        // Convert AsyncIterable<Uint8Array> to ReadableStream
        const stream = new ReadableStream({
          async start(controller) {
            console.log('[agent-chat-v2] ReadableStream start() called');
            try {
              console.log('[agent-chat-v2] Beginning to iterate through json_events');
              for await (const chunk of result.json_events) {
                console.log('[agent-chat-v2] Got chunk from json_events, length:', chunk.length);
                controller.enqueue(chunk);
              }
              console.log('[agent-chat-v2] Finished iterating through json_events, closing stream');
              controller.close();
            } catch (error) {
              console.error('[agent-chat-v2] Error in ReadableStream:', error);
              controller.error(error);
            }
          },
        });
        console.log('[agent-chat-v2] Returning Response with stream');
        return new Response(stream, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        return new Response(result.json, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // Handle /threads/list endpoint
    if (path === '/threads/list' || path.endsWith('/threads/list')) {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const after = url.searchParams.get('after') || null;
      const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';

      const ctx = buildRequestContext(request);
      const page = await data_store.load_threads(limit, after, order, ctx);

      // Convert ThreadMetadata to JSON-friendly dicts (matching Python implementation)
      const jsonData = page.data.map((t: ThreadMetadata) => {
        let statusValue = t.status;
        if (!statusValue || typeof statusValue !== 'object') {
          if (statusValue && typeof statusValue === 'object' && 'type' in statusValue) {
            statusValue = { type: (statusValue as any).type };
          } else {
            statusValue = { type: String(statusValue || 'active') };
          }
        }

        return {
          id: t.id,
          title: t.title || 'New Chat',
          created_at: Math.floor((t.created_at instanceof Date ? t.created_at : new Date(t.created_at)).getTime() / 1000),
          status: statusValue,
          metadata: t.metadata || {},
        };
      });

      return new Response(
        JSON.stringify({
          data: jsonData,
          has_more: page.has_more,
          after: page.after,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Handle /agents endpoint (GET and POST)
    if (path === '/agents' || path.endsWith('/agents')) {
      const ctx = buildRequestContext(request);
      
      if (!ctx.user_id) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      try {
        // Ensure default agents exist first
        await ensureDefaultAgentsExist(ctx);
        await ensureDefaultMcpServer(ctx);

        // Fetch all agents for the user
        const { data: agents, error } = await ctx.supabase
          .from('agents')
          .select('*')
          .eq('user_id', ctx.user_id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('[agent-chat-v2] Error fetching agents:', error);
          throw new Error(`Failed to fetch agents: ${error.message}`);
        }

        return new Response(
          JSON.stringify(agents || []),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        console.error('[agent-chat-v2] Error in /agents endpoint:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch agents',
            detail: error && typeof error === 'object' && 'message' in error ? String((error as any).message) : String(error),
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Default response for root path
    return new Response(
      JSON.stringify({ message: 'agent-chat-v2 ChatKit Server' }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : String(e);
    const detail = e && typeof e === 'object' && 'stack' in e ? String((e as any).stack) : undefined;
    console.error('Error in agent-chat-v2:', e);
    return new Response(
      JSON.stringify({
        error: msg,
        detail: detail,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

