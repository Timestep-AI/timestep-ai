import { OpenAIConversationsSession } from '@openai/agents-openai';
import type { Store, AttachmentStore, StoreItemType } from '../_shared/chatkit/store.ts';
import type { ThreadMetadata, ThreadStreamEvent, UserMessageItem, WidgetItem } from '../_shared/chatkit/types.ts';
import { ChatKitServer, stream_widget } from '../_shared/chatkit/server.ts';
import { AgentContext, simple_to_agent_input as simpleToAgentInput, stream_agent_response as streamAgentResponse } from '../_shared/chatkit/agents.ts';
import { Agent, Runner, RunState } from '@openai/agents-core';
import type { ModelSettings } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';
import OpenAI from 'openai';
import type { TContext } from '../_shared/stores.ts';
import { switchTheme, getWeather, CLIENT_THEME_TOOL_NAME } from './tools.ts';
import { logger } from '../_shared/chatkit/logger.ts';
import { renderApprovalWidget, approvalWidgetCopyText } from './approval_widget.ts';

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
    logger.error(`[getAgentById] Error fetching agent ${agentId}:`, error);
    return null;
  }
  
  return agentData as AgentRecord | null;
}

/**
 * Load an agent from the database by ID
 */
async function loadAgentFromDatabase(agentId: string, ctx: TContext): Promise<Agent> {
  if (!ctx.user_id) {
    throw new Error('user_id is required to load agents');
  }

  const agentRecord = await getAgentById(agentId, ctx);
  if (!agentRecord) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const tools = [switchTheme, getWeather];

  logger.info(`Loading agent ${agentId} with model ${agentRecord.model}, model_settings ${JSON.stringify(agentRecord.model_settings)}, and tools: ${tools.map((t: any) => t.name || 'unknown')}`);

  const agent = new Agent({
    model: agentRecord.model,
    name: agentRecord.name,
    instructions: agentRecord.instructions,
    tools: tools,
    toolUseBehavior: { stopAtToolNames: [CLIENT_THEME_TOOL_NAME] },
    modelSettings: agentRecord.model_settings as ModelSettings,
  });
  logger.info(`Agent created with tools: ${tools.map((t: any) => t.name || 'unknown').join(', ')}`);

  return agent;
}

async function getSessionForThread(thread: ThreadMetadata, ctx: TContext): Promise<OpenAIConversationsSession> {
  /**Create or get an OpenAIConversationsSession for a given thread.

  Points to the openai-polyfill Conversations API using the request's JWT.
  */
  // Use polyfill endpoint instead of real OpenAI API
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required');
  }
  const baseUrl = `${supabaseUrl}/functions/v1/openai-polyfill`;
  const apiKey = ctx.user_jwt;
  if (!apiKey) {
    throw new Error('user_jwt is required in context');
  }
  
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
    defaultHeaders: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  // Try to look up existing conversation ID from database
  let existingConversationId: string | undefined;
  try {
    const { data, error } = await ctx.supabase
      .from('thread_conversations')
      .select('conversation_id')
      .eq('thread_id', thread.id)
      .maybeSingle();

    if (error) {
      logger.error(`[getSessionForThread] Error looking up conversation ID: ${error.message}`);
    } else if (data) {
      existingConversationId = data.conversation_id;
      logger.info(`[getSessionForThread] Found existing conversation ID ${existingConversationId} for thread ${thread.id}`);
    } else {
      logger.info(`[getSessionForThread] No existing conversation ID found for thread ${thread.id}, will create new one`);
    }
  } catch (error) {
    logger.error(`[getSessionForThread] Exception looking up conversation ID: ${error}`);
  }

  // Return a FixedIdSession that fixes FAKE_ID before items are saved
  // OpenAI Conversations API requires different prefixes for different item types (fc for function_call, msg for messages)
  class FixedIdSession extends OpenAIConversationsSession {
    async addItems(items: any[]): Promise<void> {
      const fixedItems = items.map((item: any, index: number) => {
        const originalId = item.id;
        const itemType = item.type || 'unknown';

        // Determine the correct prefix based on item type
        let prefix = 'msg'; // Default for messages
        if (itemType === 'function_call' || itemType === 'function_call_output' || itemType === 'function_call_result') {
          prefix = 'fc';
        } else if (itemType === 'assistant_message' || itemType === 'user_message' || itemType === 'message' || !itemType || itemType === 'unknown') {
          prefix = 'msg';
        }

        if (originalId === '__fake_id__' || originalId === 'FAKE_ID' || !originalId || originalId === 'N/A') {
          // Generate a valid ID with the correct prefix
          const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          item.id = `${prefix}_${hex}`;
        } else if (!originalId.startsWith('msg_') && !originalId.startsWith('fc_')) {
          // Fix IDs that don't have the correct prefix
          const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          item.id = `${prefix}_${hex}`;
        } else if ((prefix === 'fc' && !originalId.startsWith('fc_')) || (prefix === 'msg' && !originalId.startsWith('msg_'))) {
          // Wrong prefix for this item type
          const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          item.id = `${prefix}_${hex}`;
        }
        return item;
      });
      return super.addItems(fixedItems);
    }

    // Override getSessionId to save the conversation ID to database
    async getSessionId(): Promise<string> {
      const sessionId = await super.getSessionId();

      // If we didn't have an existing conversation ID, save this one to the database
      if (sessionId && !existingConversationId) {
        logger.info(`[getSessionForThread] Saving new conversation ID ${sessionId} for thread ${thread.id}`);
        try {
          await ctx.supabase
            .from('thread_conversations')
            .upsert({
              thread_id: thread.id,
              conversation_id: sessionId,
            }, {
              onConflict: 'thread_id'
            });
        } catch (error) {
          logger.error(`[getSessionForThread] Failed to save conversation ID: ${error}`);
        }
      } else if (sessionId) {
        logger.info(`[getSessionForThread] Using existing conversation ID ${sessionId} for thread ${thread.id}`);
      }

      return sessionId;
    }
  }

  return new FixedIdSession({
    // Pass existing conversationId if we have one, otherwise let OpenAI create a new one
    conversationId: existingConversationId,
    client: client,
  });
}

/**
 * Save a run state to the database.
 * Matches Python save_run_state implementation
 */
async function saveRunState(threadId: string, state: any, ctx: TContext): Promise<string | null> {
  if (!ctx.user_id) {
    logger.warn('[saveRunState] No user_id in context, cannot save run state');
    return null;
  }

  try {
    logger.info(`[saveRunState] START - saving state for thread ${threadId}`);

    if (!state) {
      logger.warn('[saveRunState] State is null or undefined');
      return null;
    }

    // CRITICAL FIX: Patch RunContext.toJSON() to call AgentContext.toJSON()
    // RunContext.toJSON() returns { context: this.context } where this.context is an AgentContext
    // But it doesn't call AgentContext.toJSON(), causing validation error "expected record, received AgentContext"
    interface StateWithContext {
      _context?: unknown;
      toJSON?: () => unknown;
    }
    const stateObj = state as StateWithContext;

    if (stateObj?._context && typeof stateObj._context === 'object' && 'toJSON' in stateObj._context && typeof stateObj._context.toJSON === 'function') {
      logger.info('[saveRunState] Patching _context.toJSON to properly serialize AgentContext');
      const originalToJSON = stateObj._context.toJSON.bind(stateObj._context);
      stateObj._context.toJSON = function() {
        const result = originalToJSON();
        // If context.context is an AgentContext with toJSON(), call it
        if (result && typeof result === 'object' && 'context' in result && result.context && typeof result.context === 'object' && 'toJSON' in result.context && typeof result.context.toJSON === 'function') {
          result.context = result.context.toJSON();
        }
        return result;
      };
    }

    // Serialize state
    let stateJsonString: string;
    try {
      logger.info(`[saveRunState] Attempting to serialize state...`);

      // Log originalInput to debug validation failure
      if (state && typeof state === 'object') {
        const origInput = (state as any).originalInput || (state as any)._originalInput;
        if (origInput && Array.isArray(origInput)) {
          logger.info(`[saveRunState] originalInput has ${origInput.length} items`);
          // Log items at indices that were failing (5 and 9)
          for (let i = 0; i < origInput.length; i++) {
            if (i === 5 || i === 9 || i < 3 || i === origInput.length - 1) {
              const item = origInput[i];
              logger.info(`[saveRunState] originalInput[${i}]: type=${item?.type}, role=${item?.role}, hasContent=${!!item?.content}, contentLength=${Array.isArray(item?.content) ? item.content.length : 'N/A'}`);
              if (item && Array.isArray(item.content) && item.content.length > 0) {
                const firstContent = item.content[0];
                logger.info(`[saveRunState] originalInput[${i}].content[0]: type=${firstContent?.type}, hasText=${!!firstContent?.text}`);
              }
            }
          }
        }
      }

      let stateJson: any;
      if (typeof state.toJSON === 'function') {
        logger.info(`[saveRunState] Calling state.toJSON() explicitly`);
        stateJson = state.toJSON();
        logger.info(`[saveRunState] toJSON() returned successfully`);
        stateJsonString = JSON.stringify(stateJson, null, 2);
      } else {
        logger.info(`[saveRunState] State has no toJSON method, using JSON.stringify directly`);
        stateJsonString = JSON.stringify(state);
      }
      logger.info(`[saveRunState] State serialized successfully, length: ${stateJsonString.length}`);
    } catch (error: any) {
      logger.error(`[saveRunState] ========== SERIALIZATION ERROR START ==========`);
      logger.error(`[saveRunState] Error type: ${error?.constructor?.name}`);
      logger.error(`[saveRunState] Error message: ${error?.message}`);
      logger.error(`[saveRunState] Error keys: ${Object.keys(error || {}).join(', ')}`);
      logger.error(`[saveRunState] Full error object: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);

      // Check for issues in various possible locations
      const issues = error?.issues || error?.cause?.issues || (error?.cause && Array.isArray(error.cause) ? error.cause : null);
      if (issues) {
        logger.error(`[saveRunState] Found ${issues.length} validation issues`);
        logger.error(`[saveRunState] Issues (first 50): ${JSON.stringify(issues.slice(0, 50), null, 2)}`);
        issues.forEach((issue: any, idx: number) => {
          logger.error(`[saveRunState] Issue ${idx}: ${JSON.stringify(issue, null, 2)}`);
        });
      } else {
        logger.error(`[saveRunState] No issues array found in error object`);
      }
      
      logger.error(`[saveRunState] ========== SERIALIZATION ERROR END ==========`);
      throw error;
    }
    
    // Delete any existing run state for this thread
    await ctx.supabase
      .from('run_states')
      .delete()
      .eq('thread_id', threadId)
      .eq('user_id', ctx.user_id);
    
    // Insert new run state
    // Store as JSON string (Supabase JSONB will handle it)
    const { data, error } = await ctx.supabase
      .from('run_states')
      .insert({
        thread_id: threadId,
        user_id: ctx.user_id,
        state_data: stateJsonString,
      })
      .select()
      .single();
    
    if (error) {
      logger.error(`[saveRunState] Failed to save run state:`, error);
      return null;
    }
    
    if (data && data.id) {
      logger.info(`[saveRunState] Saved run state ${data.id} for thread ${threadId}`);
      return data.id;
    }
    
    return null;
  } catch (error) {
    logger.error(`[saveRunState] Error saving run state:`, error);
    return null;
  }
}

/**
 * Load a run state from the database and reconstruct it.
 * Matches Python load_run_state implementation
 */
async function loadRunState(threadId: string, agent: Agent<any, any>, ctx: TContext): Promise<any | null> {
  if (!ctx.user_id) {
    logger.warn('[loadRunState] No user_id in context, cannot load run state');
    return null;
  }
  
  try {
    const { data, error } = await ctx.supabase
      .from('run_states')
      .select('*')
      .eq('thread_id', threadId)
      .eq('user_id', ctx.user_id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      logger.error(`[loadRunState] Error loading run state:`, error);
      return null;
    }
    
    if (data && data.state_data) {
      // Working example uses: RunState.fromString(agent, storedState) where storedState is a JSON string
      // Supabase JSONB might return an object or string, so handle both cases
      const stateData = typeof data.state_data === 'string' 
        ? data.state_data 
        : JSON.stringify(data.state_data);
      const state = await RunState.fromString(agent, stateData);
      logger.info(`[loadRunState] Loaded and reconstructed run state for thread ${threadId}`);
      return state;
    }
    
    return null;
  } catch (error) {
    logger.error(`[loadRunState] Error loading run state:`, error);
    return null;
  }
}

/**
 * Delete a run state from the database.
 * Matches Python delete_run_state implementation
 */
async function deleteRunState(threadId: string, ctx: TContext): Promise<void> {
  if (!ctx.user_id) {
    return;
  }
  
  try {
    await ctx.supabase
      .from('run_states')
      .delete()
      .eq('thread_id', threadId)
      .eq('user_id', ctx.user_id);
    logger.info(`[deleteRunState] Deleted run state for thread ${threadId}`);
  } catch (error) {
    logger.error(`[deleteRunState] Error deleting run state:`, error);
  }
}

class MyChatKitServer extends ChatKitServer {
  constructor(dataStore: Store<TContext>, attachmentStore?: AttachmentStore<TContext> | null) {
    super(dataStore, attachmentStore ?? null);
  }

  async *action(
    thread: ThreadMetadata,
    action: any,
    item: WidgetItem | null,
    context: TContext,
  ): AsyncIterable<ThreadStreamEvent> {
    /** Handle custom actions from widgets.
     * 
     * This handles tool approval/rejection actions from approval widgets.
     * Matches Python action implementation
     */
    const actionType = action?.type || (typeof action === 'object' && action.type);
    const actionPayload = action?.payload || (typeof action === 'object' && action.payload) || {};
    
    logger.info(`[agents-action] Handling action type: ${actionType}, payload:`, actionPayload);
    
    if (actionType === 'tool_approval') {
      const approvalAction = actionPayload.action; // "approve" or "reject"
      const interruptionId = actionPayload.interruption_id;
      
      logger.info(`[agents-action] Tool approval action: ${approvalAction} for interruption ${interruptionId}`);
      
      // Load the agent first (needed to reconstruct state)
      const agentId = context.agent_id;
      if (!agentId) {
        logger.error('[agents-action] No agent_id in context');
        return;
      }
      
      const agent = await loadAgentFromDatabase(agentId, context);
      
      // Load and reconstruct the saved run state
      const state = await loadRunState(thread.id, agent, context);
      if (!state) {
        logger.error(`[agents-action] No saved run state found for thread ${thread.id}`);
        return;
      }
      
      // Set up model provider and session
      const session = await getSessionForThread(thread, context);
      const { OllamaModelProvider } = await import('./utils/ollama_model_provider.ts');
      const { MultiModelProvider, MultiModelProviderMap } = await import('./utils/multi_model_provider.ts');
      
      const modelProviderMap = new MultiModelProviderMap();
      
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
      
      const modelProvider = new MultiModelProvider({
        provider_map: modelProviderMap,
        openai_api_key: Deno.env.get('OPENAI_API_KEY') || '',
        openai_use_responses: false,
      });
      
      // Create agent context
      const agentContext = new AgentContext(thread, this.store, context);
      
      // Create sessionInputCallback (same as in respond method)
      // This is required when using session memory with state that contains list inputs
      // When resuming from a saved state, the state's originalInput is already merged,
      // but we still need to sanitize it to ensure all items have valid type fields
      const sessionInputCallback = async (historyItems: any[], newItems: any[]): Promise<any[]> => {
        logger.info(`[agents-action] sessionInputCallback called with ${historyItems.length} history items and ${newItems.length} new items`);
        
        function sanitizeItem(item: any): any | any[] | null {
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return item;
          }
          
          const itemType = item.type;
          
          if (itemType === 'client_tool_call') {
            if (item.status === 'completed') {
              return [
                {
                  type: 'function_call',
                  callId: item.callId || item.call_id,
                  name: item.name,
                  arguments: item.arguments || {},
                },
                {
                  type: 'function_call_result',
                  callId: item.callId || item.call_id,
                  output: item.output,
                  status: 'completed',
                }
              ];
            }
            return null;
          }
          
          if (itemType === 'function_call') {
            return {
              type: 'function_call',
              callId: item.callId || item.call_id,
              name: item.name,
              arguments: item.arguments || {},
              status: item.status,
            };
          }
          
          if (itemType === 'function_call_output' || itemType === 'function_call_result') {
            return {
              type: 'function_call_result',
              callId: item.callId || item.call_id,
              output: item.output,
              status: item.status || 'completed',
            };
          }
          
          // If item has a type field that doesn't match any expected type, filter it out
          if (itemType && !['message', 'function_call', 'function_call_result', 'function_call_output', 'client_tool_call'].includes(itemType)) {
            logger.warn(`[agents-action] sessionInputCallback: Skipping item with unknown type "${itemType}":`, item);
            return null;
          }
          
          // IMPORTANT: RunState validation requires a 'type' field to discriminate between union types
          // Skip items that don't have a valid role (required for message type)
          const role = item.role;
          const content = item.content || [];
          
          if (!role || typeof role !== 'string') {
            logger.warn(`[agents-action] sessionInputCallback: Skipping item without valid role:`, item);
            return null;
          }
          
          // If item has a type field that's not 'message', we've already handled it above
          // This should not happen, but just in case, filter it out
          if (itemType && itemType !== 'message') {
            logger.warn(`[agents-action] sessionInputCallback: Skipping item with non-message type "${itemType}" in message handler:`, item);
            return null;
          }
          
          // Ensure content is an array (required for message type)
          const contentArray = Array.isArray(content) ? content : (content ? [content] : []);
          
          // Keep content as-is - the SDK knows how to handle it properly
          return {
            type: 'message',
            role: role,
            content: contentArray,
          };
        }
        
        const sanitizedHistory: any[] = [];
        for (const item of historyItems) {
          const result = sanitizeItem(item);
          if (result !== null) {
            if (Array.isArray(result)) {
              sanitizedHistory.push(...result);
            } else {
              sanitizedHistory.push(result);
            }
          }
        }
        
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
        
        // Final validation: ensure all items have required fields for their type
        // This is critical because RunState.toJSON() validates the entire state including originalInput
        const validateItems = (items: any[]): any[] => {
          const validated: any[] = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
              logger.warn(`[agents-action] sessionInputCallback: Skipping invalid item at index ${i}: not an object`);
              continue;
            }
            
            const itemType = item.type;
            if (!itemType || typeof itemType !== 'string') {
              logger.warn(`[agents-action] sessionInputCallback: Skipping item at index ${i}: missing or invalid type field. Item:`, JSON.stringify(item));
              continue;
            }
            
            // Only allow known types
            if (!['message', 'function_call', 'function_call_result'].includes(itemType)) {
              logger.warn(`[agents-action] sessionInputCallback: Skipping item at index ${i}: unknown type "${itemType}". Item:`, JSON.stringify(item));
              continue;
            }
            
            // Validate based on type
            if (itemType === 'message') {
              if (!item.role || typeof item.role !== 'string') {
                logger.warn(`[agents-action] sessionInputCallback: Skipping message item at index ${i}: missing or invalid role`);
                continue;
              }
              if (!Array.isArray(item.content)) {
                logger.warn(`[agents-action] sessionInputCallback: Skipping message item at index ${i}: content is not an array`);
                continue;
              }
              // Pass content as-is, no conversion needed
              // Assistant messages have output_text, user messages have input_text
              validated.push({
                type: 'message',
                role: item.role,
                content: item.content,
              });
            } else if (itemType === 'function_call') {
              if (!item.callId && !item.call_id) {
                logger.warn(`[agents-action] sessionInputCallback: Skipping function_call item at index ${i}: missing callId`);
                continue;
              }
              if (!item.name || typeof item.name !== 'string') {
                logger.warn(`[agents-action] sessionInputCallback: Skipping function_call item at index ${i}: missing or invalid name`);
                continue;
              }
              validated.push({
                type: 'function_call',
                callId: item.callId || item.call_id,
                name: item.name,
                arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments || {}),
              });
            } else if (itemType === 'function_call_result') {
              if (!item.callId && !item.call_id) {
                logger.warn(`[agents-action] sessionInputCallback: Skipping function_call_result item at index ${i}: missing callId`);
                continue;
              }
              // Validate output field - it can be string, object, or array
              const output = item.output;
              if (output === undefined || output === null) {
                logger.warn(`[agents-action] sessionInputCallback: Skipping function_call_result item at index ${i}: missing output`);
                continue;
              }
              // Validate status field
              const status = item.status;
              if (status && !['in_progress', 'completed', 'incomplete'].includes(status)) {
                logger.warn(`[agents-action] sessionInputCallback: Skipping function_call_result item at index ${i}: invalid status "${status}"`);
                continue;
              }
              validated.push({
                type: 'function_call_result',
                callId: item.callId || item.call_id,
                output: output,
                status: status || 'completed',
              });
            } else {
              logger.warn(`[agents-action] sessionInputCallback: Skipping item at index ${i}: unknown type "${itemType}"`);
              continue;
            }
          }
          return validated;
        };
        
        // REMOVED: The logic that returned newItems as-is for large lists
        // This was causing the agent to lose conversation context after approval
        // The correct approach is to always merge and sanitize properly
        // When resuming from a saved state, the state's originalInput already contains the full history,
        // so we merge it with any new history items from the session (which should be minimal or empty)
        const merged = [...sanitizedHistory, ...sanitizedNew];
        return validateItems(merged);
      };
      
      // Get interruptions from the loaded state using the getInterruptions() method
      const interruptions = state.getInterruptions();
      logger.info(`[agents-action] Got ${interruptions.length} interruptions from state.getInterruptions()`);

      if (!state || !interruptions || interruptions.length === 0) {
        logger.error('[agents-action] No state or interruptions found');
        logger.error(`[agents-action] state exists: ${!!state}, interruptions length: ${interruptions.length}`);
        return;
      }
      
      // Require interruptionId - no fallback logic
      if (!interruptionId) {
        logger.error('[agents-action] Missing interruption_id in action payload. Cannot match interruption.');
        return;
      }
      
      // Find the matching interruption by callId from rawItem
      let matchingInterruption = null;
      for (const interruption of interruptions) {
        const rawItem = interruption.raw_item || interruption.rawItem;
        const interId = rawItem?.callId || rawItem?.call_id;
        if (interId && String(interId) === String(interruptionId)) {
          matchingInterruption = interruption;
          break;
        }
      }
      
      if (!matchingInterruption) {
        logger.error(`[agents-action] No matching interruption found for ID ${interruptionId}`);
        return;
      }
      
      // Approve or reject the interruption
      if (approvalAction === 'approve') {
        logger.info(`[agents-action] Approving interruption ${interruptionId}`);
        state.approve(matchingInterruption);
      } else if (approvalAction === 'reject') {
        logger.info(`[agents-action] Rejecting interruption ${interruptionId}`);
        state.reject(matchingInterruption);
      } else {
        logger.error(`[agents-action] Unknown approval action: ${approvalAction}`);
        return;
      }
      
      // Delete the saved state since we're resuming
      await deleteRunState(thread.id, context);

      // Resume execution with the updated state
      // Use runner.run() with stream: true to stream the response (required by directive)
      // Per directive: When resuming from a saved state, do NOT use the full sessionInputCallback.
      // However, we still need a minimal callback because session memory requires it for list inputs.
      // This minimal callback just merges history and new items without transformations.
      const resumeSessionInputCallback = async (historyItems: any[], newItems: any[]): Promise<any[]> => {
        /** Minimal callback for resume path: just return the state's originalInput as-is.
         *
         * When resuming from state, the state's originalInput already contains the full conversation history.
         * We should NOT merge it with historyItems from the session, as that would create duplicates.
         * Just return newItems (the state's originalInput) without any session history.
         */
        logger.info(`[resumeSessionInputCallback] historyItems count: ${historyItems.length}, newItems count: ${newItems.length}`);
        return newItems;
      };
      
      // CRITICAL: Replace the loaded state's context with our new agentContext
      // The loaded state has a deserialized context that doesn't have methods like stream_widget
      // We need to replace it with our fresh agentContext that has all the methods
      // The structure is: state._context.context = agentContext (NOT _context._context)
      logger.info('[agents-action] Replacing state context with fresh agentContext');
      const stateWithContext = state as { _context?: { context?: unknown } };
      if (stateWithContext._context) {
        stateWithContext._context.context = agentContext;
      } else {
        logger.warn('[agents-action] State has no _context property, cannot replace context');
      }

      logger.info('[agents-action] Resuming execution with updated state');
      const runner = new Runner({ modelProvider: modelProvider } as any);
      const resumedResult = await runner.run(agent, state, {
        context: agentContext,
        stream: true,
        session: session,
        sessionInputCallback: resumeSessionInputCallback as any,
      } as any);

      // Stream the response using streamAgentResponse
      if (!resumedResult || typeof resumedResult !== 'object' || !(Symbol.asyncIterator in resumedResult)) {
        throw new Error(`[agents-action] Result is not an AsyncIterable`);
      }
      const streamToIterate = resumedResult as AsyncIterable<any>;
      
      // Stream events
      for await (const event of streamAgentResponse(agentContext, streamToIterate)) {
        yield event;
      }

      // After streaming completes, check for interruptions
      // CRITICAL: Based on the streaming HITL example, we must await stream.completed
      // before accessing stream.interruptions and stream.state
      if ((resumedResult as any).completed) {
        logger.info(`[agents-action] Awaiting stream.completed before checking interruptions`);
        try {
          await (resumedResult as any).completed;
          logger.info(`[agents-action] stream.completed resolved successfully`);
        } catch (e) {
          logger.error(`[agents-action] Error awaiting stream.completed:`, e);
        }
      }
      
      const newInterruptions = (resumedResult as any).interruptions || [];
      logger.info(`[agents-action] Checking for new interruptions after resuming: ${newInterruptions.length}`);
      if (newInterruptions && newInterruptions.length > 0) {
        logger.info(`[agents-action] Found ${newInterruptions.length} new interruption(s) after resuming`);
        // Get the state from the result - directly accessible as stream.state
        const newState = (resumedResult as any).state || null;
        logger.info(`[agents-action] State after resuming: ${newState ? 'available' : 'null'}`);
        if (newState) {
          await saveRunState(thread.id, newState, context);
          for (const interruption of newInterruptions) {
            const agentName = interruption.agent?.name || 'Unknown Agent';
            const rawItem = interruption.raw_item || interruption.rawItem;
            const toolName = rawItem?.name || 'unknown_tool';
            let toolArguments = rawItem?.arguments || {};
            if (typeof toolArguments === 'string') {
              try {
                toolArguments = JSON.parse(toolArguments);
              } catch {
                toolArguments = {};
              }
            }
            // Get callId from rawItem, not from interruption
            const interruptionIdNew = rawItem?.callId || rawItem?.call_id;
            
            if (!interruptionIdNew) {
              logger.error(`[agents-action] New interruption missing callId in rawItem. Cannot create approval widget. Interruption:`, interruption);
              continue;
            }
            
            const approvalWidget = renderApprovalWidget(
              agentName,
              toolName,
              toolArguments,
              String(interruptionIdNew),
            );
            const copyText = approvalWidgetCopyText(agentName, toolName, toolArguments);
            
            for await (const event of stream_widget(thread, approvalWidget, copyText)) {
              yield event;
            }
          }
        }
      } else {
        // No more interruptions, clean up
        await deleteRunState(thread.id, context);
      }
    } else {
      // Unknown action type, call parent implementation
      for await (const event of super.action(thread, action, item, context)) {
        yield event;
      }
    }
  }

  async *respond(
    thread: ThreadMetadata,
    input: UserMessageItem | null,
    context: TContext
  ): AsyncIterable<ThreadStreamEvent> {
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

    const agent = await loadAgentFromDatabase(agent_id, context);
    
    // Create Conversations session bound to polyfill with per-request JWT
    const session = await getSessionForThread(thread, context);
    
      // Check if there's a saved run state to resume from
      // If input is null and there's a saved state, we're resuming from an interruption
      let savedState: any = null;
      if (!input) {
        // Need agent to reconstruct state
        const agentId = context.agent_id;
        if (agentId) {
          const agentForState = await loadAgentFromDatabase(agentId, context);
          savedState = await loadRunState(thread.id, agentForState, context);
          if (savedState) {
            logger.info(`[agents] Resuming from saved run state for thread ${thread.id}`);
          }
        }
      }
    
    // Convert input to agent format (only if we don't have a saved state)
    const agentInput = savedState ? [] : (input ? await simpleToAgentInput(input) : []);
    
    // When using session memory with list inputs, we need to provide a callback
    // that defines how to merge history items with new items.
    // The session automatically saves items after the run completes.
    const sessionInputCallback = async (historyItems: any[], newItems: any[]): Promise<any[]> => {
      logger.info(`[session_input_callback] Called with ${historyItems.length} history items and ${newItems.length} new items`);
      // SIMPLIFIED: Just merge history with new items like the working test file
      return [...historyItems, ...newItems];
    };
    
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
      runner = new Runner({
        modelProvider: modelProvider,
      } as any);
    } catch (error) {
      logger.error('[agents] Error creating Runner:', error);
      throw error;
    }
    
    // In JavaScript, runner.run() with stream: true returns the stream directly
    // Use the dynamically loaded agent instead of hardcoded this.assistantAgent
    // According to docs: "When you pass an array of AgentInputItems as the run input, 
    // provide a sessionInputCallback to merge them with stored history deterministically."
    // When resuming from saved state, do NOT use sessionInputCallback (pass state directly)
    try {
      // When passing array input with session, sessionInputCallback is REQUIRED
      // But when resuming from saved state, do NOT use sessionInputCallback
      // Use the complex sessionInputCallback that handles client_tool_call conversion
      logger.info(`[agents] About to call runner.run() with agentInput: ${JSON.stringify(agentInput)}`);
      logger.info(`[agents] agentInput length: ${agentInput.length}`);
      logger.info(`[agents] agentInput type: ${typeof agentInput}`);
      logger.info(`[agents] session is: ${session}`);
      logger.info(`[agents] savedState exists: ${!!savedState}`);
      
      // Define sessionInputCallback for resume path - matches the working example
      // The working example uses the same callback for both initial and resume
      const resumeSessionInputCallback = async (historyItems: any[], newItems: any[]): Promise<any[]> => {
        logger.info(`[resumeSessionInputCallback-respond] historyItems count: ${historyItems.length}, newItems count: ${newItems.length}`);
        // Merge history with new items (same as working example)
        return [...historyItems, ...newItems];
      };

      // Use Runner.run() with stream: true - it returns an AsyncIterable
      // We need to track state and interruptions ourselves during iteration
      let result: any;
      if (savedState) {
        logger.info(`[agents] Resuming from saved state WITH session and resumeSessionInputCallback`);
        result = await runner.run(agent, savedState, {
          context: agentContext,
          stream: true,
          session: session,
          sessionInputCallback: resumeSessionInputCallback as any,
        } as any);
      } else {
        logger.info(`[agents] Using new input with sessionInputCallback`);
        result = await runner.run(agent, agentInput, {
          context: agentContext,
          stream: true,
          session: session,
          sessionInputCallback: sessionInputCallback as any,
        } as any);
      }
      logger.info(`[agents] runner.run() returned, result type: ${typeof result}`);
      logger.info(`[agents] Result is AsyncIterable: ${result && typeof result === 'object' && Symbol.asyncIterator in result}`);
      logger.info(`[agents] Result properties: ${result && typeof result === 'object' ? Object.keys(result).join(', ') : 'N/A'}`);
      logger.info(`[agents] Result has state: ${!!(result as any)?.state}`);
      logger.info(`[agents] Result has interruptions: ${!!(result as any)?.interruptions}`);
      logger.info(`[agents] Result has completed: ${!!(result as any)?.completed}`);
      
      // result implements AsyncIterable directly, so use result directly
      // StreamedRunResult implements AsyncIterable directly, so we iterate it directly
      if (!result || typeof result !== 'object' || !(Symbol.asyncIterator in result)) {
        throw new Error(`[agents] Result is not an AsyncIterable`);
      }
      const streamToIterate = result as AsyncIterable<any>;
      
      // The session automatically saves items after the run completes
      // No need to manually save items - the Runner handles it
      
      // Wrap streamAgentResponse to fix __fake_id__ in thread.item.added and thread.item.done events
      // CRITICAL: If items are saved with __fake_id__, they will overwrite each other due to PRIMARY KEY constraint
      // CRITICAL: Both thread.item.added and thread.item.done must have the SAME ID so the frontend recognizes them as the same item
      // This ensures ChatKit items have proper IDs (defense-in-depth - add_thread_item also fixes IDs)
      const store = this.store; // Capture store reference for use in nested function
      async function* fixChatKitEventIds(events: AsyncIterable<ThreadStreamEvent>): AsyncIterable<ThreadStreamEvent> {
        // Track IDs we've generated for items, so thread.item.added and thread.item.done use the same ID
        const itemIdMap: Map<string, string> = new Map(); // Maps original __fake_id__ to generated ID
        let eventCount = 0;
        
        for await (const event of events) {
          eventCount++;
          const eventType = event.type || 'unknown';
          logger.info(`[agents] Event #${eventCount}: ${eventType}`);
          
          // Fix __fake_id__ in thread.item.added events
          if (event.type === 'thread.item.added' && (event as any).item) {
            const item = (event as any).item;
            const originalId = item.id || 'N/A';
            const itemType = item.type || 'unknown';
            let contentPreview = '';
            let contentLength = 0;
            if (item.type === 'assistant_message' && item.content && Array.isArray(item.content) && item.content.length > 0) {
              // Get first 50 chars of content for logging
              const firstContent = item.content[0];
              if (firstContent && firstContent.text) {
                contentLength = firstContent.text.length;
                contentPreview = firstContent.text.length > 50 ? firstContent.text.substring(0, 50) + '...' : firstContent.text;
              }
            }
            logger.info(`[agents] ThreadItemAddedEvent: type=${itemType}, id=${originalId}, content_length=${contentLength}, content_preview=${contentPreview}`);
            
            if (originalId === '__fake_id__' || !originalId || originalId === 'N/A') {
              // Check if we've already generated an ID for this item (from a previous event)
              if (itemIdMap.has(originalId)) {
                item.id = itemIdMap.get(originalId)!;
                logger.info(`[agents] Reusing ID for ThreadItemAddedEvent: ${originalId} -> ${item.id}`);
              } else {
                logger.error(`[agents] CRITICAL: Fixing __fake_id__ for ${itemType} in ThreadItemAddedEvent (original_id=${originalId})`);
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
                logger.info(`[agents] Fixed ID in ThreadItemAddedEvent: ${originalId} -> ${item.id}`);
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
            let contentPreview = '';
            let contentLength = 0;
            if (item.type === 'assistant_message' && item.content && Array.isArray(item.content) && item.content.length > 0) {
              // Get first 50 chars of content for logging
              const firstContent = item.content[0];
              if (firstContent && firstContent.text) {
                contentLength = firstContent.text.length;
                contentPreview = firstContent.text.length > 50 ? firstContent.text.substring(0, 50) + '...' : firstContent.text;
              }
            }
            logger.info(`[agents] ThreadItemDoneEvent: type=${itemType}, id=${originalId}, content_length=${contentLength}, content_preview=${contentPreview}`);
            
            if (originalId === '__fake_id__' || !originalId || originalId === 'N/A') {
              // Check if we've already generated an ID for this item (from thread.item.added)
              if (itemIdMap.has(originalId)) {
                item.id = itemIdMap.get(originalId)!;
                logger.info(`[agents] Reusing ID for ThreadItemDoneEvent: ${originalId} -> ${item.id}`);
              } else {
                logger.error(`[agents] CRITICAL: Fixing __fake_id__ for ${itemType} in ThreadItemDoneEvent (original_id=${originalId})`);
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
                logger.info(`[agents] Fixed ID in ThreadItemDoneEvent: ${originalId} -> ${item.id}`);
              }
            } else {
              logger.info(`[agents] Item ${itemType} already has valid ID: ${originalId}`);
            }
          }
          
          yield event;
        }
      }
      
      // We need to consume the stream completely before accessing state/interruptions
      // IMPORTANT: For Runner.run() with stream: true, result is an AsyncIterable that also has state/interruptions properties
      // We need to iterate through it completely, wrapping events and yielding them
      // But we must keep a reference to the original result object to access state/interruptions after iteration
      const eventsList: ThreadStreamEvent[] = [];

      // Iterate through the stream, wrapping and yielding events
      // IMPORTANT: result is the object with state/interruptions/completed properties
      // We iterate it through the wrapper, but result itself should still have those properties
      // Make sure we're consuming the stream completely
      let eventCount = 0;
      for await (const event of fixChatKitEventIds(streamAgentResponse(agentContext, streamToIterate))) {
        eventCount++;
        eventsList.push(event);
        yield event;
      }
      logger.info(`[agents] Consumed ${eventCount} events from stream`);

      // CRITICAL: After consuming the stream, we must await result.completed before accessing state/interruptions
      // Runner.run() with stream: true returns an object with state, interruptions, and completed properties
      logger.info(`[agents] After stream consumption, checking result properties`);
      logger.info(`[agents] Result type: ${typeof result}`);
      logger.info(`[agents] Result is object: ${result && typeof result === 'object'}`);
      if (result && typeof result === 'object') {
        logger.info(`[agents] Result properties: ${Object.keys(result).join(', ')}`);
        logger.info(`[agents] Result has state: ${!!(result as any).state}`);
        logger.info(`[agents] Result has interruptions: ${!!(result as any).interruptions}`);
        logger.info(`[agents] Result has completed: ${!!(result as any).completed}`);
      }

      if ((result as any).completed) {
        logger.info(`[agents] Awaiting result.completed before checking interruptions`);
        try {
          await (result as any).completed;
          logger.info(`[agents] result.completed resolved successfully`);
        } catch (e) {
          logger.error(`[agents] Error awaiting result.completed:`, e);
        }
      } else {
        logger.warn(`[agents] result.completed does not exist, cannot await it`);
      }

      logger.info(`[agents] After completion check, result properties: ${result && typeof result === 'object' ? Object.keys(result).join(', ') : 'N/A'}`);

      // After awaiting result.completed, interruptions and state should be available
      // Runner.run() with stream: true returns an object with state, interruptions, and completed properties
      const interruptions = (result as any).interruptions || [];
      logger.info(`[agents] Checking for interruptions after streaming: ${interruptions.length}`);
      logger.info(`[agents] result.interruptions exists: ${(result as any).interruptions !== undefined}`);
      logger.info(`[agents] result.state exists: ${(result as any).state !== undefined}`);

      // If there are interruptions, save state and stream approval widgets
      if (interruptions && interruptions.length > 0) {
        logger.info(`[agents] Found ${interruptions.length} interruption(s), saving state and streaming approval widgets`);

        // Get the state from the result object - Runner.run() returns object with state property
        // IMPORTANT: In the test file, result.state is available after awaiting result.completed
        // Make sure we're accessing it correctly
        let state = (result as any).state;
        
        logger.info(`[agents] Direct state access: ${state ? 'available' : 'null/undefined'}`);
        logger.info(`[agents] State type: ${typeof state}`);
        logger.info(`[agents] State is null: ${state === null}`);
        logger.info(`[agents] State is undefined: ${state === undefined}`);
        
        // If state is not available, try accessing it differently
        if (!state && (result as any).toState && typeof (result as any).toState === 'function') {
          logger.info(`[agents] Trying toState() method`);
          state = (result as any).toState();
        }
        
        if (!state && (result as any).to_state && typeof (result as any).to_state === 'function') {
          logger.info(`[agents] Trying to_state() method`);
          state = (result as any).to_state();
        }

        logger.info(`[agents] State after all attempts: ${state ? 'available' : 'null'}`);
        if (state && typeof state === 'object') {
          const stateKeys = Object.keys(state);
          logger.info(`[agents] State object has ${stateKeys.length} keys: ${stateKeys.slice(0, 10).join(', ')}${stateKeys.length > 10 ? '...' : ''}`);
        }

        if (state) {
          logger.info(`[agents] Saving run state for thread ${thread.id}`);
          logger.info(`[agents] State type before saveRunState: ${typeof state}`);
          logger.info(`[agents] State is null: ${state === null}`);
          logger.info(`[agents] State is undefined: ${state === undefined}`);
          // Save the state to database (saveRunState will call toJSON() if needed)
          const savedStateId = await saveRunState(thread.id, state, context);
          if (savedStateId) {
            logger.info(`[agents] State saved successfully with ID: ${savedStateId}`);
          } else {
            logger.error(`[agents] Failed to save run state for thread ${thread.id}`);
          }
          
          // Stream approval widgets for each interruption
          for (const interruption of interruptions) {
            // Extract interruption details
            const agentName = interruption.agent?.name || 'Unknown Agent';
            const rawItem = interruption.raw_item || interruption.rawItem;
            const toolName = rawItem?.name || 'unknown_tool';
            let toolArguments = rawItem?.arguments || {};
            if (typeof toolArguments === 'string') {
              try {
                toolArguments = JSON.parse(toolArguments);
              } catch {
                toolArguments = {};
              }
            }
            // Get callId from rawItem, not from interruption
            const interruptionId = rawItem?.callId || rawItem?.call_id;
            
            if (!interruptionId) {
              logger.error(`[agents] Interruption missing callId in rawItem. Cannot create approval widget. Interruption:`, interruption);
              continue;
            }
            
            logger.info(`[agents] Streaming approval widget for ${toolName} with args`, toolArguments, `interruption_id=${interruptionId}`);
            
            // Create and stream approval widget
            const approvalWidget = renderApprovalWidget(
              agentName,
              toolName,
              toolArguments,
              String(interruptionId),
            );
            const copyText = approvalWidgetCopyText(agentName, toolName, toolArguments);
            
            // Stream the approval widget
            for await (const event of stream_widget(thread, approvalWidget, copyText)) {
              yield event;
            }
          }
        }
      } else {
        // No interruptions, clean up any saved state
        await deleteRunState(thread.id, context);
      }
    } catch (error) {
      logger.error('[agents] Error in runner.run():', error);
      throw error;
    }
  }
}

export { MyChatKitServer, loadAgentFromDatabase, getSessionForThread };


