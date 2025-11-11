import { OpenAIConversationsSession } from '@openai/agents-openai';
import type { Store, AttachmentStore, StoreItemType } from '../_shared/chatkit/store.ts';
import type { ThreadMetadata, ThreadStreamEvent, UserMessageItem } from '../_shared/chatkit/types.ts';
import { ChatKitServer } from '../_shared/chatkit/server.ts';
import { AgentContext, simple_to_agent_input as simpleToAgentInput, stream_agent_response as streamAgentResponse } from '../_shared/chatkit/agents.ts';
import { Agent, Runner } from '@openai/agents-core';
import type { ModelSettings } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';
import OpenAI from 'openai';
import type { TContext } from '../_shared/stores.ts';
import { switchTheme, getWeather, CLIENT_THEME_TOOL_NAME } from './tools.ts';
import { logger } from '../_shared/chatkit/logger.ts';

// Interface for agent record from database
export interface AgentRecord {
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
export async function getAgentById(agentId: string, ctx: TContext): Promise<AgentRecord | null> {
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
    logger.error('[agents] Error fetching agent:', error);
    return null;
  }
  
  return agentData as AgentRecord | null;
}

/**
 * Load an agent from the database by ID
 */
async function loadAgentFromDatabase(agentId: string, ctx: TContext): Promise<Agent> {
  logger.info('[agents] loadAgentFromDatabase called for agent:', agentId);
  if (!ctx.user_id) {
    throw new Error('user_id is required to load agents');
  }

  logger.info('[agents] Getting agent from database...');
  const agentRecord = await getAgentById(agentId, ctx);
  logger.info('[agents] Got agent record:', agentRecord ? 'found' : 'NOT FOUND');
  if (!agentRecord) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const tools = [switchTheme, getWeather];

  logger.info(`[agents] Loading agent ${agentId} with model ${agentRecord.model}, model_settings ${JSON.stringify(agentRecord.model_settings)}, and tools: ${tools.map((t: any) => t.name || 'unknown')}`);

  const agent = new Agent({
    model: agentRecord.model,
    name: agentRecord.name,
    instructions: agentRecord.instructions,
    tools: tools,
    toolUseBehavior: { stopAtToolNames: [CLIENT_THEME_TOOL_NAME] },
    modelSettings: agentRecord.model_settings as ModelSettings,
  });
  logger.info('[agents] Agent created:', agentRecord.name);

  return agent;
}

function getSessionForThread(threadId: string, ctx: TContext): OpenAIConversationsSession {
  /**Create or get an OpenAIConversationsSession for a given thread.
  
  Points to the openai-polyfill Conversations API using the request's JWT.
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
    logger.info('[agents] respond() called for thread:', thread.id, 'agent:', context.agent_id);
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

    logger.info('[agents] About to call loadAgentFromDatabase');
    const agent = await loadAgentFromDatabase(agent_id, context);
    logger.info('[agents] loadAgentFromDatabase returned successfully');
    
    // Create Conversations session bound to polyfill with per-request JWT
    const session = getSessionForThread(thread.id, context);
    
    // Convert input to agent format
    const agentInput = input ? await simpleToAgentInput(input) : [];
    logger.info(`[agents] agentInput:`, JSON.stringify(agentInput, null, 2));
    
    // When using session memory with list inputs, we need to provide a callback
    // that defines how to merge history items with new items.
    // The session automatically saves items after the run completes.
    const sessionInputCallback = async (historyItems: any[], newItems: any[]): Promise<any[]> => {
      logger.info(`[session_input_callback] sessionInputCallback called with historyItems length:`, historyItems.length, `and newItems length:`, newItems.length);
      try {
        logger.info(`[session_input_callback] ===== CALLBACK INVOKED =====`);
        logger.info(`[session_input_callback] Called with ${historyItems.length} history items and ${newItems.length} new items`);
        logger.info(`[session_input_callback] History items:`, JSON.stringify(historyItems, null, 2));
        logger.info(`[session_input_callback] New items:`, JSON.stringify(newItems, null, 2));

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
        logger.info(`[session_input_callback] sanitizeItem called with item:`, item);
        // Only process dicts/objects (not arrays)
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          logger.info(`[session_input_callback] sanitizeItem: item is not a dict/object (or is array):`, item);
          return item;
        }

        const itemType = item.type;
        logger.info(`[session_input_callback] sanitizeItem: itemType="${itemType}"`);

        // Check if this is a ClientToolCallItem (type='client_tool_call')
        // These need special handling - must NOT be stripped to just role/content
        if (itemType === 'client_tool_call') {
          logger.info(`[session_input_callback] Found client_tool_call item: status=${item.status}, name=${item.name}`);
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
            logger.info(`[session_input_callback] Converted completed client_tool_call to:`, result);
            return result;
          } else {
            // Pending tool calls should be filtered out
            logger.info(`[session_input_callback] Filtering out pending client_tool_call`);
            return null;
          }
        }

        // Handle function_call_result from Conversations API
        // TypeScript Agents SDK accepts function_call_result and converts it to function_call_output internally
        if (itemType === 'function_call_result') {
          logger.info(`[session_input_callback] Preserving function_call_result item:`, item);
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
          logger.info(`[session_input_callback] Preserving function_call item:`, item);
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
          logger.info(`[session_input_callback] Converting function_call_output to function_call_result:`, item);
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
        // The Agent SDK will handle the content format correctly
        const sanitized: any = {
          role: item.role,
          content: item.content,
        };
        logger.info(`[session_input_callback] Sanitized message item:`, sanitized);
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
      logger.info(`[session_input_callback] Returning ${sortedItems.length} merged items (sorted):`, sortedItems);
      return sortedItems;
      } catch (error) {
        logger.error(`[session_input_callback] ERROR in callback:`, error);
        throw error;
      }
    };
    
    logger.info(`[agents] sessionInputCallback defined, type:`, typeof sessionInputCallback, `is function:`, typeof sessionInputCallback === 'function');
    
    // The session contains the OpenAI client configured to use the polyfill for conversation history
    // The Runner uses the multi-provider for actual model calls
    // Create Runner with multi-provider support
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
      const DEFAULT_OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
      const modelProvider = new MultiModelProvider({
        provider_map: modelProviderMap,
        openai_api_key: DEFAULT_OPENAI_API_KEY || '',
        openai_use_responses: false,
      });
      
      // sessionInputCallback goes in run() options when using array input
      // Note: Only modelProvider goes in Runner constructor; sessionInputCallback goes in run() options
      logger.info(`[agents] Creating Runner with modelProvider in constructor RunConfig`);
      runner = new Runner({
        modelProvider: modelProvider,
      } as any);
      logger.info(`[agents] Runner created`);
    } catch (error) {
      logger.error('[agents] Error creating Runner:', error);
      throw error;
    }
    
    // In JavaScript, runner.run() with stream: true returns the stream directly
    // Use the dynamically loaded agent instead of hardcoded this.assistantAgent
    // According to docs: "When you pass an array of AgentInputItems as the run input, 
    // provide a sessionInputCallback to merge them with stored history deterministically."
    try {
      // TypeScript library: sessionInputCallback goes in run() options (not RunConfig per docs)
      // Required when passing array input per docs: "provide a sessionInputCallback to merge them with stored history"
      logger.info(`[agents] About to call runner.run() with session:`, !!session, `agentInput length:`, agentInput.length);
      logger.info(`[agents] agentInput:`, JSON.stringify(agentInput, null, 2));
      logger.info(`[agents] sessionInputCallback defined:`, typeof sessionInputCallback, `is function:`, typeof sessionInputCallback === 'function');
      const result = await runner.run(agent, agentInput, {
        context: agentContext,
        stream: true,
        session: session,
        sessionInputCallback: sessionInputCallback as any, // Required for array input, not in RunConfig per TypeScript library
      } as any);
      logger.info(`[agents] runner.run() returned, result type:`, typeof result);
      logger.info(`[agents] result is AsyncIterable:`, result && typeof result[Symbol.asyncIterator] === 'function');
      
      // Log the input property of the result to see what the Runner actually received after preparation
      if (result && typeof result === 'object' && 'input' in result) {
        const resultInput = (result as any).input;
        logger.info(`[agents] result.input after Runner preparation:`, {
          length: Array.isArray(resultInput) ? resultInput.length : 'not array',
          type: typeof resultInput,
          isArray: Array.isArray(resultInput),
          value: JSON.stringify(resultInput, null, 2),
        });
      }
      
      // result implements AsyncIterable directly, so use result directly
      // StreamedRunResult implements AsyncIterable directly, so we iterate it directly
      if (!result || typeof result !== 'object' || !(Symbol.asyncIterator in result)) {
        throw new Error(`[agents] Result is not an AsyncIterable`);
      }
      const streamToIterate = result as AsyncIterable<any>;
      
      // The session automatically saves items after the run completes
      // No need to manually save items - the Runner handles it
      let eventCount = 0;
      logger.info(`[agents] Starting to iterate streamAgentResponse...`);
      // StreamedRunResult implements AsyncIterable directly - ReadableStream starts when we iterate
      // CRITICAL: When agentInput is empty but result.input has merged history, we MUST iterate
      // the stream to start the ReadableStream, which allows the stream loop to enqueue items
      // The stream loop runs asynchronously and enqueues items to #readableController when available
      
      // Wrap streamAgentResponse to fix __fake_id__ in thread.item.added and thread.item.done events
      // CRITICAL: If items are saved with __fake_id__, they will overwrite each other due to PRIMARY KEY constraint
      // CRITICAL: Both thread.item.added and thread.item.done must have the SAME ID so the frontend recognizes them as the same item
      // This ensures ChatKit items have proper IDs (defense-in-depth - add_thread_item also fixes IDs)
      const store = this.store; // Capture store reference for use in nested function
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
            logger.info(`[agents] thread.item.added: type=${itemType}, id=${originalId}, content_length=${contentLength}, content_preview=${contentPreview}`);
            
            if (originalId === '__fake_id__' || !originalId || originalId === 'N/A') {
              // Check if we've already generated an ID for this item (from a previous event)
              if (itemIdMap.has(originalId)) {
                item.id = itemIdMap.get(originalId)!;
                logger.info(`[agents] Reusing ID for thread.item.added: ${originalId} -> ${item.id}`);
              } else {
                logger.error(`[agents] CRITICAL: Fixing __fake_id__ for ${itemType} in thread.item.added (original_id=${originalId})`);
                let itemTypeForId: StoreItemType;
                if (itemType === 'client_tool_call') {
                  itemTypeForId = 'tool_call';
                } else if (itemType === 'assistant_message' || itemType === 'user_message') {
                  itemTypeForId = 'message';
                } else {
                  itemTypeForId = 'message'; // Default fallback
                }
                item.id = store.generate_item_id(itemTypeForId, thread, context);
                itemIdMap.set(originalId, item.id);
                logger.info(`[agents] Fixed ID in thread.item.added: ${originalId} -> ${item.id}`);
              }
            } else {
              logger.info(`[agents] Item ${itemType} already has valid ID: ${originalId}`);
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
            logger.info(`[agents] thread.item.done: type=${itemType}, id=${originalId}, content_length=${contentLength}, content_preview=${contentPreview}`);
            
            if (originalId === '__fake_id__' || !originalId || originalId === 'N/A') {
              // Check if we've already generated an ID for this item (from thread.item.added)
              if (itemIdMap.has(originalId)) {
                item.id = itemIdMap.get(originalId)!;
                logger.info(`[agents] Reusing ID for thread.item.done: ${originalId} -> ${item.id}`);
              } else {
                logger.error(`[agents] CRITICAL: Fixing __fake_id__ for ${itemType} in thread.item.done (original_id=${originalId})`);
                let itemTypeForId: StoreItemType;
                if (itemType === 'client_tool_call') {
                  itemTypeForId = 'tool_call';
                } else if (itemType === 'assistant_message' || itemType === 'user_message') {
                  itemTypeForId = 'message';
                } else {
                  itemTypeForId = 'message'; // Default fallback
                }
                item.id = store.generate_item_id(itemTypeForId, thread, context);
                itemIdMap.set(originalId, item.id);
                logger.info(`[agents] Fixed ID in thread.item.done: ${originalId} -> ${item.id}`);
              }
            } else {
              logger.info(`[agents] Item ${itemType} already has valid ID: ${originalId}`);
            }
          }
          
          yield event;
        }
      }
      
      for await (const event of fixChatKitEventIds(streamAgentResponse(agentContext, streamToIterate))) {
        eventCount++;
        logger.info(`[agents] Stream event ${eventCount}:`, JSON.stringify(event, null, 2));
        yield event;
      }
      logger.info(`[agents] Stream ended after ${eventCount} events`);
      const isEmptyInput = Array.isArray(agentInput) ? agentInput.length === 0 : agentInput === "";
      if (eventCount === 0 && isEmptyInput) {
        logger.warning(`[agents] WARNING: Empty stream with empty agentInput - Runner may not be generating response from history`);
      }
    } catch (error) {
      logger.error('[agents] Error in runner.run():', error);
      throw error;
    }
  }
}

export { MyChatKitServer, loadAgentFromDatabase, getSessionForThread };

