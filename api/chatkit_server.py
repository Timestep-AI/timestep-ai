from typing import Any, AsyncIterator, TypedDict
import os
import logging
import json
from fastapi import HTTPException
from agents import Agent, Runner, RunConfig, OpenAIProvider, StopAtTools, ModelSettings, RunState
from agents.memory import OpenAIConversationsSession
from openai import AsyncOpenAI
from chatkit.agents import simple_to_agent_input, stream_agent_response, AgentContext
from chatkit.server import ChatKitServer, stream_widget
from chatkit.types import ThreadMetadata, UserMessageItem, ThreadStreamEvent, ClientToolCallItem, ThreadItemDoneEvent, ThreadItemAddedEvent, ThreadItemUpdated, AssistantMessageItem
from datetime import datetime
from chatkit.store import Store, AttachmentStore
from .stores import TContext
from .tools import switch_theme, get_weather, CLIENT_THEME_TOOL_NAME
from .approval_widget import render_approval_widget, approval_widget_copy_text
from .utils.multi_model_provider import MultiModelProvider, MultiModelProviderMap
from .utils.ollama_model_provider import OllamaModelProvider

logger = logging.getLogger(__name__)

# Interface for agent record from database
class AgentRecord(TypedDict, total=False):
    id: str
    user_id: str
    name: str
    instructions: str
    tool_ids: list[str]
    handoff_ids: list[str]
    model: str | None
    model_settings: dict[str, Any]
    created_at: str | None
    updated_at: str | None

def get_agent_by_id(agent_id: str, ctx: TContext) -> AgentRecord | None:
    """Get an agent record from the database by ID.
    
    Returns None if not found.
    """
    if not ctx.user_id:
        return None
    
    supabase = ctx.supabase
    response = (
        supabase.table("agents")
        .select("*")
        .eq("id", agent_id)
        .eq("user_id", ctx.user_id)
        .execute()
    )
    
    # Check for Supabase errors
    if hasattr(response, "error") and response.error:
        # PGRST116 is "not found" in PostgREST - equivalent to empty result
        error_code = getattr(response.error, "code", None)
        if error_code == "PGRST116":
            # Not found - this is expected, return None
            return None
        # Other errors should be logged
        logger.error(f"[get_agent_by_id] Error fetching agent {agent_id}: {response.error}")
        return None
    
    if not response.data or len(response.data) == 0:
        return None
    
    return response.data[0]

def load_agent_from_database(agent_id: str, ctx: TContext) -> Agent[AgentContext]:
    """Load an agent from the database by ID.

    Returns an Agent configured with the database record's settings.
    """
    if not ctx.user_id:
        raise HTTPException(status_code=400, detail="user_id is required to load agents")

    agent_record = get_agent_by_id(agent_id, ctx)
    if not agent_record:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")

    tools = [switch_theme, get_weather]

    logger.info(f"Loading agent {agent_id} with model {agent_record['model']}, model_settings {agent_record['model_settings']}, and tools: {[t.__name__ if hasattr(t, '__name__') else str(t) for t in tools]}")

    agent = Agent[AgentContext](
        model=agent_record["model"],
        name=agent_record["name"],
        instructions=agent_record["instructions"],
        tools=tools,  # type: ignore[arg-type]
        tool_use_behavior=StopAtTools(stop_at_tool_names=[CLIENT_THEME_TOOL_NAME]),
        model_settings=ModelSettings(**agent_record["model_settings"]),
    )

    logger.info(f"Agent created with tools: {agent.tools}")
    return agent

def get_session_for_thread(thread_id: str, ctx: TContext) -> OpenAIConversationsSession:
    """Create or get an OpenAIConversationsSession for a given thread.

    Uses the real OpenAI API instead of polyfill (matching TypeScript version).
    """
    # TEMPORARY: Use real OpenAI API instead of polyfill to debug serialization issues
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    if not openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is required (temporary for testing without polyfill)")
    
    client = AsyncOpenAI(api_key=openai_api_key)
    # No baseURL - use real OpenAI API

    # Try to look up existing conversation ID from database
    existing_conversation_id: str | None = None
    try:
        supabase = ctx.supabase
        response = (
            supabase.table("thread_conversations")
            .select("conversation_id")
            .eq("thread_id", thread_id)
            .execute()
        )
        
        # Check for errors first
        if hasattr(response, "error") and response.error:
            error_code = getattr(response.error, "code", None)
            if error_code == "PGRST116":
                # Not found - this is expected
                logger.info(f"[get_session_for_thread] No existing conversation ID found for thread {thread_id}, will create new one")
            else:
                logger.error(f"[get_session_for_thread] Error looking up conversation ID: {response.error}")
        elif response and response.data and len(response.data) > 0:
            existing_conversation_id = response.data[0].get("conversation_id")
            logger.info(f"[get_session_for_thread] Found existing conversation ID {existing_conversation_id} for thread {thread_id}")
        else:
            logger.info(f"[get_session_for_thread] No existing conversation ID found for thread {thread_id}, will create new one")
    except Exception as error:
        logger.error(f"[get_session_for_thread] Exception looking up conversation ID: {error}")

    # Return a FixedIdSession that fixes FAKE_ID before items are saved
    # OpenAI Conversations API requires different prefixes for different item types (fc for function_call, msg for messages)
    class FixedIdSession(OpenAIConversationsSession):
        async def add_items(self, items: list[Any]) -> None:
            # Skip adding empty items (OpenAI Conversations API doesn't accept empty arrays)
            if not items or len(items) == 0:
                logger.info(f"[FixedIdSession] Skipping add_items - no items to add")
                return
            
            import secrets
            fixed_items = []
            for item in items:
                # Convert to dict if needed for easier manipulation
                if not isinstance(item, dict):
                    # Try to convert to dict
                    if hasattr(item, '__dict__'):
                        item_dict = item.__dict__.copy()
                    else:
                        item_dict = dict(item) if hasattr(item, 'keys') else {}
                    item = item_dict
                
                original_id = item.get("id")
                item_type = item.get("type", "unknown")
                
                # Remove fields that OpenAI Conversations API doesn't accept
                # The API might reject items with 'status' or other fields
                cleaned_item = {k: v for k, v in item.items() if k not in ('status',)}
                
                # Determine the correct prefix based on item type
                prefix = "msg"  # Default for messages
                if item_type in ("function_call", "function_call_output", "function_call_result"):
                    prefix = "fc"
                elif item_type in ("assistant_message", "user_message", "message", None, "unknown"):
                    prefix = "msg"

                if original_id in ("__fake_id__", "FAKE_ID", None, "N/A"):
                    # Generate a valid ID with the correct prefix
                    hex_str = secrets.token_hex(16)
                    cleaned_item["id"] = f"{prefix}_{hex_str}"
                elif not str(original_id).startswith("msg_") and not str(original_id).startswith("fc_"):
                    # Fix IDs that don't have the correct prefix
                    hex_str = secrets.token_hex(16)
                    cleaned_item["id"] = f"{prefix}_{hex_str}"
                elif (prefix == "fc" and not str(original_id).startswith("fc_")) or (prefix == "msg" and not str(original_id).startswith("msg_")):
                    # Wrong prefix for this item type
                    hex_str = secrets.token_hex(16)
                    cleaned_item["id"] = f"{prefix}_{hex_str}"
                else:
                    cleaned_item["id"] = original_id
                
                fixed_items.append(cleaned_item)
            
            # Skip adding items if the list is empty (already handled above, but double-check)
            if not fixed_items or len(fixed_items) == 0:
                logger.info(f"[FixedIdSession] No items to add after filtering")
                return
            
            try:
                return await super().add_items(fixed_items)
            except Exception as e:
                # Check if the error is "Item already in conversation" - this is expected when resuming
                error_str = str(e)
                if 'item_already_in_conversation' in error_str.lower() or 'already in conversation' in error_str.lower():
                    logger.warn(f"[FixedIdSession] Items already in conversation (expected when resuming from state), skipping: {[item.get('id', 'N/A') for item in fixed_items[:3]]}")
                    # Don't raise - this is expected when resuming from a saved state
                    return
                else:
                    logger.error(f"[FixedIdSession] Error adding items to OpenAI Conversations API: {e}")
                    logger.error(f"[FixedIdSession] Items being added: {[item.get('id', 'N/A') for item in fixed_items[:3]]}")
                    raise

        async def _get_session_id(self) -> str:
            session_id = await super()._get_session_id()

            # If we didn't have an existing conversation ID, save this one to the database
            if session_id and not existing_conversation_id:
                logger.info(f"[get_session_for_thread] Saving new conversation ID {session_id} for thread {thread_id}")
                try:
                    supabase = ctx.supabase
                    supabase.table("thread_conversations").upsert({
                        "thread_id": thread_id,
                        "conversation_id": session_id,
                    }, on_conflict="thread_id").execute()
                except Exception as error:
                    logger.error(f"[get_session_for_thread] Failed to save conversation ID: {error}")
            elif session_id:
                logger.info(f"[get_session_for_thread] Using existing conversation ID {session_id} for thread {thread_id}")

            return session_id

    return FixedIdSession(
        # Pass existing conversationId if we have one, otherwise let OpenAI create a new one
        conversation_id=existing_conversation_id,
        openai_client=client,
    )

async def save_run_state(thread_id: str, state: RunState, ctx: TContext) -> str | None:
    """Save a run state to the database.
    
    Args:
        thread_id: The thread ID
        state: The run state object (from result.to_state())
        ctx: Request context
        
    Returns:
        The ID of the saved run state, or None if saving failed
    """
    if not ctx.user_id:
        logger.warning("[save_run_state] No user_id in context, cannot save run state")
        return None
    
    try:
        # Serialize the state to JSON using the proper method
        # state.to_json() should return a fully serializable dict
        # Working example: state_json = state.to_json(); json.dump(state_json, f, indent=2)
        state_json = state.to_json()
        
        # Delete any existing run state for this thread
        supabase = ctx.supabase
        delete_response = (
            supabase.table("run_states")
            .delete()
            .eq("thread_id", thread_id)
            .eq("user_id", ctx.user_id)
            .execute()
        )
        
        # Insert new run state
        # Supabase JSONB columns can accept dicts directly, but we'll stringify to match TypeScript
        # Working example: state_json = state.to_json(); json.dump(state_json, f, indent=2)
        # state.to_json() should return a fully serializable dict
        # However, AgentContext contains ThreadMetadata which isn't JSON serializable
        # Use a default handler to serialize Pydantic models properly
        def json_serializer(obj):
            """JSON serializer for objects not serializable by default json code"""
            # Handle ChatKitDataStore - exclude from serialization
            from api.stores import ChatKitDataStore
            if isinstance(obj, ChatKitDataStore):
                return None  # Exclude store from serialization
            # Handle Supabase client - exclude from serialization
            obj_type = type(obj)
            obj_module = str(obj_type.__module__)
            # Check if it's a Supabase Client (could be from supabase._sync.client or supabase.client)
            if obj_type.__name__ == 'Client' and 'supabase' in obj_module:
                return None  # Exclude Supabase client from serialization
            # Also check by string representation as fallback
            if 'supabase' in str(obj_type) and 'Client' in str(obj_type):
                return None  # Exclude Supabase client from serialization
            # Handle Pydantic models (like AgentContext)
            if hasattr(obj, 'model_dump'):
                try:
                    return obj.model_dump(exclude={'thread', 'store', 'request_context', '_events'}, mode='json')
                except Exception as e:
                    # If model_dump fails, try to get a minimal representation
                    logger.warning(f"[save_run_state] model_dump failed for {type(obj)}: {e}, using minimal representation")
                    if hasattr(obj, '__dict__'):
                        # Return a minimal dict with only serializable values
                        result = {}
                        for k, v in obj.__dict__.items():
                            if k in ('thread', 'store', 'request_context', '_events'):
                                continue
                            try:
                                json.dumps(v, default=json_serializer)
                                result[k] = v
                            except:
                                pass
                        return result
                    return None
            # Handle other non-serializable types - return None to exclude them
            logger.warning(f"[save_run_state] Excluding non-serializable object of type {type(obj)} from state")
            return None
        
        state_json_string = json.dumps(state_json, default=json_serializer)
        
        insert_response = (
            supabase.table("run_states")
            .insert({
                "thread_id": thread_id,
                "user_id": ctx.user_id,
                "state_data": state_json_string,
            })
            .execute()
        )
        
        if insert_response.data and len(insert_response.data) > 0:
            run_state_id = insert_response.data[0].get("id")
            logger.info(f"[save_run_state] Saved run state {run_state_id} for thread {thread_id}")
            return run_state_id
        else:
            logger.error(f"[save_run_state] Failed to save run state: {insert_response}")
            return None
    except Exception as exc:
        logger.exception(f"[save_run_state] Error saving run state: {exc}")
        return None

async def load_run_state(thread_id: str, agent: Agent[AgentContext], ctx: TContext) -> RunState | None:
    """Load a run state from the database and reconstruct it.
    
    Args:
        thread_id: The thread ID
        agent: The agent to reconstruct the state for
        ctx: Request context
        
    Returns:
        The reconstructed RunState, or None if not found
    """
    if not ctx.user_id:
        logger.warning("[load_run_state] No user_id in context, cannot load run state")
        return None
    
    try:
        supabase = ctx.supabase
        response = (
            supabase.table("run_states")
            .select("*")
            .eq("thread_id", thread_id)
            .eq("user_id", ctx.user_id)
            .maybe_single()
            .execute()
        )
        
        if response and response.data and response.data.get("state_data"):
            state_data = response.data.get("state_data")
            # Working example: stored_state_json = json.load(f) (returns dict), then RunState.from_json(agent, stored_state_json)
            # Supabase JSONB might return a dict or string, so handle both cases
            if isinstance(state_data, str):
                state_json = json.loads(state_data)
            else:
                state_json = state_data
            state = await RunState.from_json(agent, state_json)
            logger.info(f"[load_run_state] Loaded and reconstructed run state for thread {thread_id}")
            return state
        
        return None
    except Exception as exc:
        logger.exception(f"[load_run_state] Error loading run state: {exc}")
        return None

async def delete_run_state(thread_id: str, ctx: TContext) -> None:
    """Delete a run state from the database.
    
    Args:
        thread_id: The thread ID
        ctx: Request context
    """
    if not ctx.user_id:
        return
    
    try:
        supabase = ctx.supabase
        (
            supabase.table("run_states")
            .delete()
            .eq("thread_id", thread_id)
            .eq("user_id", ctx.user_id)
            .execute()
        )
        logger.info(f"[delete_run_state] Deleted run state for thread {thread_id}")
    except Exception as exc:
        logger.exception(f"[delete_run_state] Error deleting run state: {exc}")

class MyChatKitServer(ChatKitServer):
    def __init__(
        self, data_store: Store, attachment_store: AttachmentStore | None = None
    ):
        super().__init__(data_store, attachment_store)

    async def action(
        self,
        thread: ThreadMetadata,
        action: Any,
        item: Any | None,
        context: Any,
    ) -> AsyncIterator[ThreadStreamEvent]:
        """Handle custom actions from widgets.
        
        This handles tool approval/rejection actions from approval widgets.
        """
        action_type = action.get("type") if isinstance(action, dict) else getattr(action, "type", None)
        action_payload = action.get("payload") if isinstance(action, dict) else getattr(action, "payload", {})
        
        logger.info(f"[python-action] Handling action type: {action_type}, payload: {action_payload}")
        
        if action_type == "tool_approval":
            approval_action = action_payload.get("action")  # "approve" or "reject"
            interruption_id = action_payload.get("interruption_id")
            
            logger.info(f"[python-action] Tool approval action: {approval_action} for interruption {interruption_id}")
            
            # Load the agent first (needed to reconstruct state)
            agent_id = context.agent_id
            if not agent_id:
                logger.error("[python-action] No agent_id in context")
                return
            
            agent = load_agent_from_database(agent_id, context)
            
            # Load and reconstruct the saved run state
            state = await load_run_state(thread.id, agent, context)
            if not state:
                logger.error(f"[python-action] No saved run state found for thread {thread.id}")
                return
            
            session = get_session_for_thread(thread.id, context)
            
            # Create agent context
            agent_context = AgentContext(
                thread=thread,
                store=self.store,
                request_context=context,
            )
            
            # Set up model provider
            from agents import Runner, RunConfig
            from .utils.multi_model_provider import MultiModelProvider, MultiModelProviderMap
            from .utils.ollama_model_provider import OllamaModelProvider
            
            model_provider_map = MultiModelProviderMap()
            
            if os.environ.get("ANTHROPIC_API_KEY"):
                model_provider_map.add_provider(
                    "anthropic",
                    OpenAIProvider(
                        api_key=os.environ.get("ANTHROPIC_API_KEY"),
                        base_url="https://api.anthropic.com/v1/",
                        use_responses=False,
                    )
                )
            
            if os.environ.get("HF_TOKEN"):
                model_provider_map.add_provider(
                    "hf_inference_endpoints",
                    OpenAIProvider(
                        api_key=os.environ.get("HF_TOKEN"),
                        base_url="https://bb8igs5dnyzb8gu1.us-east-1.aws.endpoints.huggingface.cloud/v1/",
                        use_responses=False,
                    )
                )
                model_provider_map.add_provider(
                    "hf_inference_providers",
                    OpenAIProvider(
                        api_key=os.environ.get("HF_TOKEN"),
                        base_url="https://router.huggingface.co/v1",
                        use_responses=False,
                    )
                )
            
            if os.environ.get("OLLAMA_API_KEY"):
                model_provider_map.add_provider(
                    "ollama",
                    OllamaModelProvider(api_key=os.environ.get("OLLAMA_API_KEY"))
                )
            
            model_provider = MultiModelProvider(
                provider_map=model_provider_map,
                openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
                openai_use_responses=False,
            )
            
            # NOTE: Don't use session_input_callback when resuming from saved state
            # The state already has valid originalInput from when it was first created
            # Session memory will still work automatically through the session object
            
            # Get interruptions directly from the loaded state (matches working example)
            # Python example uses: interruptions = state.get_interruptions()
            interruptions = []
            if hasattr(state, 'get_interruptions'):
                interruptions = state.get_interruptions()
            elif hasattr(state, 'interruptions'):
                interruptions = state.interruptions or []
            
            # Require interruption_id - no fallback logic
            if not interruption_id:
                logger.error(f"[python-action] Missing interruption_id in action payload. Cannot match interruption.")
                return
            
            # Find the matching interruption by call_id from raw_item
            matching_interruption = None
            for interruption in interruptions:
                if hasattr(interruption, 'raw_item'):
                    raw_item = interruption.raw_item
                    inter_id = getattr(raw_item, 'call_id', None)
                    if inter_id and str(inter_id) == str(interruption_id):
                        matching_interruption = interruption
                        break
            
            if not matching_interruption:
                logger.error(f"[python-action] No matching interruption found for ID {interruption_id}")
                return
            
            # Approve or reject the interruption
            if approval_action == "approve":
                logger.info(f"[python-action] Approving interruption {interruption_id}")
                state.approve(matching_interruption)
            elif approval_action == "reject":
                logger.info(f"[python-action] Rejecting interruption {interruption_id}")
                state.reject(matching_interruption)
            else:
                logger.error(f"[python-action] Unknown approval action: {approval_action}")
                return
            
            # Delete the saved state since we're resuming
            await delete_run_state(thread.id, context)
            
            # CRITICAL: Replace the loaded state's context with our new agent_context
            # The loaded state has a deserialized context that doesn't have methods like stream_widget
            # We need to replace it with our fresh agent_context that has all the methods
            # This matches TypeScript behavior - state._context.context = agentContext
            logger.info("[python-action] Replacing state context with fresh agent_context")
            if hasattr(state, '_context') and state._context:
                # Python's RunState has _context (RunContext) which has a context (AgentContext) property
                # Structure: state._context.context = agent_context
                if hasattr(state._context, 'context'):
                    state._context.context = agent_context
                    logger.info("[python-action] State context replaced successfully")
                else:
                    logger.warn("[python-action] State._context has no 'context' property")
            else:
                logger.warn("[python-action] State has no _context property, cannot replace context")
            
            # Resume execution with the updated state (after approve/reject)
            # Use Runner.run_streamed() to stream the response (required by directive)
            # Per directive: When resuming from a saved state, do NOT use the full sessionInputCallback.
            # However, we still need a minimal callback because session memory requires it for list inputs.
            # This minimal callback just returns the state's originalInput as-is.
            # When resuming from saved state, do NOT use session input callback
            # This matches how the respond method works when resuming
            def resume_session_input_callback(history_items, new_items):
                """Minimal callback for resume path: just return the state's originalInput as-is.

                When resuming from state, the state's originalInput already contains the full conversation history.
                We should NOT merge it with historyItems from the session, as that would create duplicates.
                Just return newItems (the state's originalInput) without any session history.
                This matches TypeScript's resumeSessionInputCallback behavior exactly.
                """
                logger.info(f"[resume_session_input_callback] historyItems count: {len(history_items)}, newItems count: {len(new_items)}")
                return new_items

            run_config = RunConfig(
                session_input_callback=resume_session_input_callback,
                model_provider=model_provider,
            )
            
            logger.info("[python-action] Resuming execution with updated state")
            # Pass the state object as input to resume execution, like TypeScript does
            # In TypeScript: runner.run(agent, state, options)
            # The resume_session_input_callback will handle deduplication automatically
            result = Runner.run_streamed(
                agent,
                state,  # Pass state object as input like TypeScript does
                context=agent_context,
                session=session,
                run_config=run_config,
            )
            
            logger.info(f"[python-action] Result type: {type(result)}")
            
            # Stream the response using stream_agent_response
            # CRITICAL: We must fully consume the stream before checking for interruptions
            # The stream_agent_response function consumes the result stream, and after it's done,
            # the result object should have interruptions and state available
            # stream_agent_response expects a RunResultStreaming object and calls stream_events() internally
            # Match TypeScript exactly: just iterate and yield events directly
            # CRITICAL: Deduplicate assistant message done events to prevent duplicate streaming
            # When resuming from state, the Python agents library may emit duplicate response.output_item.done events
            # TypeScript handles this by tracking producedItems and only emitting thread.item.done once per item ID
            logger.info(f"[python-action] Passing result to stream_agent_response: {type(result)}")
            # Track item IDs that have already emitted thread.item.done to prevent duplicates
            done_item_ids: set[str] = set()
            # Track IDs we've generated for items, so thread.item.added and thread.item.done use the same ID
            item_id_map: dict[str, str] = {}  # Maps original __fake_id__ to generated ID
            
            async for event in stream_agent_response(agent_context, result):
                # Fix __fake_id__ in ThreadItemAddedEvent items
                if isinstance(event, ThreadItemAddedEvent) and hasattr(event, 'item'):
                    item = event.item
                    original_id = item.id if hasattr(item, 'id') else 'N/A'
                    
                    if hasattr(item, 'id') and (item.id == '__fake_id__' or not item.id or item.id == 'N/A'):
                        # Check if we've already generated an ID for this item (from a previous event)
                        if original_id in item_id_map:
                            item.id = item_id_map[original_id]
                            logger.info(f"[python-action] Reusing ID for ThreadItemAddedEvent: {original_id} -> {item.id}")
                        else:
                            logger.error(f"[python-action] CRITICAL: Fixing __fake_id__ for {type(item).__name__} in ThreadItemAddedEvent (original_id={original_id})")
                            thread_meta = ThreadMetadata(id=thread.id, created_at=datetime.now())
                            if isinstance(item, ClientToolCallItem):
                                item_type_for_id = "tool_call"
                            elif isinstance(item, AssistantMessageItem):
                                item_type_for_id = "message"
                            elif isinstance(item, UserMessageItem):
                                item_type_for_id = "message"
                            else:
                                item_type_for_id = "message"
                            item.id = self.store.generate_item_id(item_type_for_id, thread_meta, context)
                            item_id_map[original_id] = item.id
                            logger.info(f"[python-action] Fixed ID in ThreadItemAddedEvent: {original_id} -> {item.id}")
                
                # Fix __fake_id__ in ThreadItemDoneEvent items before deduplication
                if isinstance(event, ThreadItemDoneEvent) and hasattr(event, 'item'):
                    item = event.item
                    original_id = item.id if hasattr(item, 'id') else 'N/A'
                    
                    # Fix __fake_id__ if needed
                    if hasattr(item, 'id') and (item.id == '__fake_id__' or not item.id or item.id == 'N/A'):
                        # Check if we've already generated an ID for this item (from thread.item.added)
                        if original_id in item_id_map:
                            item.id = item_id_map[original_id]
                            logger.info(f"[python-action] Reusing ID for ThreadItemDoneEvent: {original_id} -> {item.id}")
                        else:
                            logger.error(f"[python-action] CRITICAL: Fixing __fake_id__ for {type(item).__name__} in ThreadItemDoneEvent (original_id={original_id})")
                            thread_meta = ThreadMetadata(id=thread.id, created_at=datetime.now())
                            if isinstance(item, ClientToolCallItem):
                                item_type_for_id = "tool_call"
                            elif isinstance(item, AssistantMessageItem):
                                item_type_for_id = "message"
                            elif isinstance(item, UserMessageItem):
                                item_type_for_id = "message"
                            else:
                                item_type_for_id = "message"
                            item.id = self.store.generate_item_id(item_type_for_id, thread_meta, context)
                            item_id_map[original_id] = item.id
                            logger.info(f"[python-action] Fixed ID in ThreadItemDoneEvent: {original_id} -> {item.id}")
                    
                    # Deduplicate assistant message done events AFTER fixing the ID
                    if isinstance(item, AssistantMessageItem):
                        final_item_id = item.id if hasattr(item, 'id') else None
                        if final_item_id:
                            if final_item_id in done_item_ids:
                                logger.warn(f"[python-action] Skipping duplicate thread.item.done for assistant message with id={final_item_id} (original_id={original_id})")
                                continue
                            done_item_ids.add(final_item_id)
                            logger.info(f"[python-action] Added assistant message id={final_item_id} to done_item_ids set")
                
                yield event

        # After streaming completes, new interruptions and state should be available
        # In Python, RunResultStreaming doesn't have a 'completed' attribute like TypeScript,
        # but the interruptions are available immediately after the stream is consumed
        new_interruptions = getattr(result, 'interruptions', []) if hasattr(result, 'interruptions') else []

        # If there are new interruptions, save state and stream approval widgets
        # This matches the behavior in respond method
        if new_interruptions and len(new_interruptions) > 0:
            logger.info(f"[python-action] Found {len(new_interruptions)} new interruption(s), saving state and streaming approval widgets")

            # Get the state from the result
            state = result.to_state() if hasattr(result, 'to_state') else None
            if state:
                # Save the state to database
                await save_run_state(thread.id, state, context)

                # Stream approval widgets for each interruption
                for interruption in new_interruptions:
                    # Extract interruption details
                    if hasattr(interruption, 'agent'):
                        agent_name = getattr(interruption.agent, 'name', 'Unknown Agent')
                    else:
                        agent_name = 'Unknown Agent'

                    if hasattr(interruption, 'raw_item'):
                        raw_item = interruption.raw_item
                        tool_name = getattr(raw_item, 'name', 'unknown_tool')
                        tool_arguments = getattr(raw_item, 'arguments', {})

                        # Create approval widget
                        approval_widget = {
                            'key': f'approve_{tool_name}_{getattr(raw_item, "call_id", "unknown")}',
                            'type': 'Approval',
                            'action': 'tool_approval',
                            'title': f'Approve {tool_name}',
                            'description': f'Agent {agent_name} wants to use tool {tool_name} with arguments: {tool_arguments}',
                            'approveButton': {
                                'label': 'Approve',
                                'action': 'approve',
                                'interruption_id': getattr(raw_item, 'call_id', None),
                                'tool_name': tool_name,
                                'tool_arguments': tool_arguments,
                            },
                            'rejectButton': {
                                'label': 'Reject',
                                'action': 'reject',
                                'interruption_id': getattr(raw_item, 'call_id', None),
                                'tool_name': tool_name,
                                'tool_arguments': tool_arguments,
                            },
                        }

                        # Determine if copy text should be included
                        copy_text = f"Approve the use of {tool_name} with arguments {tool_arguments}"

                        # Stream the approval widget
                        async for event in stream_widget(thread, approval_widget, copy_text=copy_text):
                            yield event
    async def respond(
        self,
        thread: ThreadMetadata,
        input: UserMessageItem | None,
        context: Any,
    ) -> AsyncIterator[ThreadStreamEvent]:
        agent_context = AgentContext(
            thread=thread,
            store=self.store,
            request_context=context,
        )

        # NOTE: Removed early return for ClientToolCallItem
        # With StopAtTools, the agent naturally stops after calling the client tool,
        # and should not continue until explicitly resumed. The early return was
        # preventing the initial agent response from being generated.

        # Load agent from database using agent_id from context
        # agent_id is required - no fallbacks
        agent_id = context.agent_id
        if not agent_id:
            raise HTTPException(status_code=400, detail="agent_id is required in context")

        agent = load_agent_from_database(agent_id, context)

        # Set up model provider (matching action method setup)
        model_provider_map = MultiModelProviderMap()

        if os.environ.get("ANTHROPIC_API_KEY"):
            model_provider_map.add_provider(
                "anthropic",
                OpenAIProvider(
                    api_key=os.environ.get("ANTHROPIC_API_KEY"),
                    base_url="https://api.anthropic.com/v1/",
                    use_responses=False,
                )
            )

        if os.environ.get("HF_TOKEN"):
            model_provider_map.add_provider(
                "hf_inference_endpoints",
                OpenAIProvider(
                    api_key=os.environ.get("HF_TOKEN"),
                    base_url="https://bb8igs5dnyzb8gu1.us-east-1.aws.endpoints.huggingface.cloud/v1/",
                    use_responses=False,
                )
            )
            model_provider_map.add_provider(
                "hf_inference_providers",
                OpenAIProvider(
                    api_key=os.environ.get("HF_TOKEN"),
                    base_url="https://router.huggingface.co/v1",
                    use_responses=False,
                )
            )

        if os.environ.get("OLLAMA_API_KEY"):
            model_provider_map.add_provider(
                "ollama",
                OllamaModelProvider(api_key=os.environ.get("OLLAMA_API_KEY"))
            )

        model_provider = MultiModelProvider(
            provider_map=model_provider_map,
            openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
            openai_use_responses=False,
        )

        # Create Conversations session bound to real OpenAI API (matching TypeScript)
        session = get_session_for_thread(thread.id, context)

        # Convert input to agent format
        # Use empty list instead of None when input is None (Runner.run_streamed requires string or list)
        agent_input = await simple_to_agent_input(input) if input else []

        # Create RunConfig with session_input_callback
        # When resuming from saved state, use resumeSessionInputCallback that merges history with new items
        # This matches TypeScript behavior: resumeSessionInputCallback merges history with new items
        def session_input_callback(history_items, new_items):
            """Standard callback for respond method: merge history with new items.

            This matches TypeScript's standard sessionInputCallback behavior.
            """
            logger.info(f"[session_input_callback] historyItems count: {len(history_items)}, newItems count: {len(new_items)}")
            # Merge history with new items (same as working example)
            return history_items + new_items

        def resume_session_input_callback_respond(history_items, new_items):
            """Callback for resume path in respond method: merge history with new items.

            This matches TypeScript's resumeSessionInputCallback-respond behavior.
            """
            logger.info(f"[resume_session_input_callback-respond] historyItems count: {len(history_items)}, newItems count: {len(new_items)}")
            # Merge history with new items (same as working example)
            return history_items + new_items

        run_config_with_callback = RunConfig(
            session_input_callback=session_input_callback,
            model_provider=model_provider,
        )
        run_config_resume = RunConfig(
            session_input_callback=resume_session_input_callback_respond,
            model_provider=model_provider,
        )

        # Check for saved state (for resuming after interruptions)
        saved_state = None
        try:
            saved_state = await load_run_state(thread.id, agent, context)
            if saved_state:
                logger.info(f"[python-respond] Found saved state, will resume from it")
            else:
                logger.info(f"[python-respond] No saved state found, starting fresh")
        except Exception as e:
            logger.warning(f"[python-respond] Error loading saved state: {e}, starting fresh")

        # Use the dynamically loaded agent instead of hardcoded self.assistant_agent
        logger.info(f"[python-respond] About to call Runner.run_streamed")
        logger.info(f"[python-respond] session is: {session}")

        # When resuming from saved state, use resumeSessionInputCallback that merges history with new items
        # This matches TypeScript behavior exactly
        if saved_state:
            logger.info(f"[python-respond] Resuming from saved state WITH session and resumeSessionInputCallback")
            result = Runner.run_streamed(
                agent,
                saved_state,
                context=agent_context,
                session=session,
                run_config=run_config_resume,
            )
        else:
            logger.info(f"[python-respond] Using new input with sessionInputCallback")
            result = Runner.run_streamed(
                agent,
                agent_input,
                context=agent_context,
                session=session,
                run_config=run_config_with_callback,
            )
        logger.info(f"[python-respond] Runner.run_streamed returned, result type: {type(result)}")

        # Wrap stream_agent_response to fix __fake_id__ in ThreadItemAddedEvent and ThreadItemDoneEvent items
        # We'll check for interruptions after streaming completes
        # CRITICAL: If items are saved with __fake_id__, they will overwrite each other due to PRIMARY KEY constraint
        # CRITICAL: Both thread.item.added and thread.item.done must have the SAME ID so the frontend recognizes them as the same item
        # This ensures ChatKit items have proper IDs (defense-in-depth - add_thread_item also fixes IDs)
        async def fix_chatkit_event_ids(events):
            event_count = 0
            # Track IDs we've generated for items, so thread.item.added and thread.item.done use the same ID
            item_id_map: dict[str, str] = {}  # Maps original __fake_id__ to generated ID
            # Track item IDs that have already emitted thread.item.done to prevent duplicates
            done_item_ids: set[str] = set()
            
            async for event in events:
                event_count += 1
                event_type = event.type if hasattr(event, 'type') else type(event).__name__
                logger.info(f"[python-respond] Event #{event_count}: {event_type}")
                
                # Fix __fake_id__ in ThreadItemAddedEvent items
                if isinstance(event, ThreadItemAddedEvent) and hasattr(event, 'item'):
                    item = event.item
                    original_id = item.id if hasattr(item, 'id') else 'N/A'
                    item_type = item.type if hasattr(item, 'type') else type(item).__name__
                    content_preview = ""
                    content_length = 0
                    if isinstance(item, AssistantMessageItem) and item.content:
                        # Get first 50 chars of content for logging
                        first_content = item.content[0] if item.content else None
                        if first_content and hasattr(first_content, 'text'):
                            content_length = len(first_content.text)
                            content_preview = first_content.text[:50] + "..." if len(first_content.text) > 50 else first_content.text
                    logger.info(f"[python-respond] ThreadItemAddedEvent: type={item_type}, id={original_id}, content_length={content_length}, content_preview={content_preview}")
                    
                    if hasattr(item, 'id') and (item.id == '__fake_id__' or not item.id or item.id == 'N/A'):
                        # Check if we've already generated an ID for this item (from a previous event)
                        if original_id in item_id_map:
                            item.id = item_id_map[original_id]
                            logger.info(f"[python-respond] Reusing ID for ThreadItemAddedEvent: {original_id} -> {item.id}")
                        else:
                            logger.error(f"[python-respond] CRITICAL: Fixing __fake_id__ for {type(item).__name__} in ThreadItemAddedEvent (original_id={original_id})")
                            thread_meta = ThreadMetadata(id=thread.id, created_at=datetime.now())
                            if isinstance(item, ClientToolCallItem):
                                item_type_for_id = "tool_call"
                            elif isinstance(item, AssistantMessageItem):
                                item_type_for_id = "message"
                            elif isinstance(item, UserMessageItem):
                                item_type_for_id = "message"
                            else:
                                item_type_for_id = "message"
                            item.id = self.store.generate_item_id(item_type_for_id, thread_meta, context)
                            item_id_map[original_id] = item.id
                            logger.info(f"[python-respond] Fixed ID in ThreadItemAddedEvent: {original_id} -> {item.id}")
                    else:
                        logger.info(f"[python-respond] Item {type(item).__name__} already has valid ID: {original_id}")
                
                # Fix __fake_id__ in ThreadItemDoneEvent items before they're saved
                if isinstance(event, ThreadItemDoneEvent) and hasattr(event, 'item'):
                    item = event.item
                    original_id = item.id if hasattr(item, 'id') else 'N/A'
                    item_type = item.type if hasattr(item, 'type') else type(item).__name__
                    content_preview = ""
                    content_length = 0
                    if isinstance(item, AssistantMessageItem) and item.content:
                        # Get first 50 chars of content for logging
                        first_content = item.content[0] if item.content else None
                        if first_content and hasattr(first_content, 'text'):
                            content_length = len(first_content.text)
                            content_preview = first_content.text[:50] + "..." if len(first_content.text) > 50 else first_content.text
                    logger.info(f"[python-respond] ThreadItemDoneEvent: type={item_type}, id={original_id}, content_length={content_length}, content_preview={content_preview}")
                    
                    if hasattr(item, 'id') and (item.id == '__fake_id__' or not item.id or item.id == 'N/A'):
                        # Check if we've already generated an ID for this item (from thread.item.added)
                        if original_id in item_id_map:
                            item.id = item_id_map[original_id]
                            logger.info(f"[python-respond] Reusing ID for ThreadItemDoneEvent: {original_id} -> {item.id}")
                        else:
                            logger.error(f"[python-respond] CRITICAL: Fixing __fake_id__ for {type(item).__name__} in ThreadItemDoneEvent (original_id={original_id})")
                            thread_meta = ThreadMetadata(id=thread.id, created_at=datetime.now())
                            if isinstance(item, ClientToolCallItem):
                                item_type_for_id = "tool_call"
                            elif isinstance(item, AssistantMessageItem):
                                item_type_for_id = "message"
                            elif isinstance(item, UserMessageItem):
                                item_type_for_id = "message"
                            else:
                                item_type_for_id = "message"
                            item.id = self.store.generate_item_id(item_type_for_id, thread_meta, context)
                            item_id_map[original_id] = item.id
                            logger.info(f"[python-respond] Fixed ID in ThreadItemDoneEvent: {original_id} -> {item.id}")
                    else:
                        logger.info(f"[python-respond] Item {type(item).__name__} already has valid ID: {original_id}")
                    
                    # Deduplicate assistant message done events AFTER fixing the ID
                    # If we've already emitted thread.item.done for this item ID, skip it
                    final_item_id = item.id if hasattr(item, 'id') else None
                    if isinstance(item, AssistantMessageItem) and final_item_id:
                        if final_item_id in done_item_ids:
                            logger.warn(f"[python-respond] Skipping duplicate thread.item.done for assistant message with id={final_item_id} (original_id={original_id})")
                            continue
                        done_item_ids.add(final_item_id)
                        logger.info(f"[python-respond] Added assistant message id={final_item_id} to done_item_ids set")
                
                yield event
        
        # Stream events with fixed IDs
        # CRITICAL: We must fully consume the stream before checking for interruptions
        # The stream_agent_response function consumes the result stream, and after it's done,
        # the result object should have interruptions and state available
        events_stream = fix_chatkit_event_ids(stream_agent_response(agent_context, result))
        events_list = []
        async for event in events_stream:
            events_list.append(event)
            yield event
        
        # After streaming completes, interruptions and state should be available
        # In Python, RunResultStreaming doesn't have a 'completed' attribute like TypeScript,
        # but the interruptions are available immediately after the stream is consumed
        # After streaming completes, check for interruptions (human-in-the-loop)
        interruptions = getattr(result, 'interruptions', []) if hasattr(result, 'interruptions') else []
        logger.info(f"[python-respond] Checking for interruptions after streaming: {len(interruptions) if interruptions else 0}")
        
        # If there are interruptions, save state and stream approval widgets
        if interruptions and len(interruptions) > 0:
            logger.info(f"[python-respond] Found {len(interruptions)} interruption(s), saving state and streaming approval widgets")
            
            # Get the state from the result
            state = result.to_state() if hasattr(result, 'to_state') else None
            if state:
                # Save the state to database
                await save_run_state(thread.id, state, context)
                
                # Stream approval widgets for each interruption
                for interruption in interruptions:
                    # Extract interruption details
                    if hasattr(interruption, 'agent'):
                        agent_name = getattr(interruption.agent, 'name', 'Unknown Agent')
                    else:
                        agent_name = 'Unknown Agent'
                    
                    if hasattr(interruption, 'raw_item'):
                        raw_item = interruption.raw_item
                        tool_name = getattr(raw_item, 'name', 'unknown_tool')
                        tool_arguments = getattr(raw_item, 'arguments', {})
                        if isinstance(tool_arguments, str):
                            try:
                                tool_arguments = json.loads(tool_arguments)
                            except:
                                tool_arguments = {}
                        # Get call_id from raw_item, not from interruption
                        interruption_id = getattr(raw_item, 'call_id', None)
                    else:
                        tool_name = 'unknown_tool'
                        tool_arguments = {}
                        interruption_id = None
                    
                    if not interruption_id:
                        logger.error(f"[python-respond] Interruption missing call_id in raw_item. Cannot create approval widget. Interruption: {interruption}")
                        continue
                    
                    logger.info(f"[python-respond] Streaming approval widget for {tool_name} with args {tool_arguments}, interruption_id={interruption_id}")
                    
                    # Create and stream approval widget
                    approval_widget = render_approval_widget(
                        agent_name=agent_name,
                        tool_name=tool_name,
                        tool_arguments=tool_arguments,
                        interruption_id=str(interruption_id),
                    )
                    copy_text = approval_widget_copy_text(
                        agent_name=agent_name,
                        tool_name=tool_name,
                        tool_arguments=tool_arguments,
                    )
                    
                    # Stream the approval widget
                    async for event in stream_widget(thread, approval_widget, copy_text=copy_text):
                        yield event
        else:
            # No interruptions, clean up any saved state
            await delete_run_state(thread.id, context)

