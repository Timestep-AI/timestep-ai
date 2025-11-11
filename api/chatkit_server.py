from typing import Any, AsyncIterator, TypedDict
import os
import logging
from fastapi import HTTPException
from agents import Agent, Runner, RunConfig, OpenAIProvider, StopAtTools, ModelSettings
from agents.memory import OpenAIConversationsSession
from openai import AsyncOpenAI
from chatkit.agents import simple_to_agent_input, stream_agent_response, AgentContext
from chatkit.server import ChatKitServer
from chatkit.types import ThreadMetadata, UserMessageItem, ThreadStreamEvent, ClientToolCallItem, ThreadItemDoneEvent, ThreadItemAddedEvent, AssistantMessageItem
from datetime import datetime
from chatkit.store import Store, AttachmentStore
from .stores import TContext
from .tools import switch_theme, get_weather, CLIENT_THEME_TOOL_NAME

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

    Points to the openai-polyfill Conversations API using the request's JWT.
    """
    supabase_url = os.environ.get("SUPABASE_URL")
    if not supabase_url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL is required")
    base_url = f"{supabase_url.rstrip('/')}/functions/v1/openai-polyfill"
    api_key = ctx.user_jwt or "anonymous"
    client = AsyncOpenAI(base_url=base_url, api_key=api_key)
    # Use a stable conversation_id per thread to retain history
    return OpenAIConversationsSession(conversation_id=thread_id, openai_client=client)

class MyChatKitServer(ChatKitServer):
    def __init__(
        self, data_store: Store, attachment_store: AttachmentStore | None = None
    ):
        super().__init__(data_store, attachment_store)

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
        
        # Create Conversations session bound to polyfill with per-request JWT
        session = get_session_for_thread(thread.id, context)
        
        # Convert input to agent format
        logger.info(f"[python-respond] input is: {input}")
        logger.info(f"[python-respond] input is None: {input is None}")
        agent_input = await simple_to_agent_input(input) if input else []
        logger.info(f"[python-respond] agent_input after conversion: {agent_input}")
        logger.info(f"[python-respond] agent_input length: {len(agent_input)}")
        logger.info(f"[python-respond] agent_input type: {type(agent_input)}")
        
        # When using session memory with list inputs, we need to provide a callback
        # that defines how to merge history items with new items.
        # The session automatically saves items after the run completes.
        def session_input_callback(history_items, new_items):
            """Merge conversation history with new input items.

            The session automatically:
            - Retrieves history_items from the conversation API before each run
            - Saves all items (user input + assistant responses) after each run
            This callback defines how to merge them and sanitizes items to remove
            fields that OpenAI doesn't accept (like created_at, id, type).

            CRITICAL: ClientToolCallItems must be converted to function_call + function_call_output
            format so the agent knows the tool was already called and can continue.
            """
            logger.info(f"[session_input_callback] ===== CALLBACK INVOKED ===== (Python)")
            logger.info(f"[session_input_callback] Called with {len(history_items)} history items and {len(new_items)} new items")
            logger.info(f"[session_input_callback] History items: {history_items}")
            logger.info(f"[session_input_callback] New items: {new_items}")
            logger.info(f"[session_input_callback] New items length: {len(new_items)}")
            logger.info(f"[session_input_callback] New items type: {type(new_items)}")

            def sanitize_item(item):
                """Remove fields that OpenAI Responses API doesn't accept.

                IMPORTANT: function_call and function_call_output items must be preserved
                with ALL their fields so the agent can see the complete tool call history.
                """
                if isinstance(item, dict):
                    item_type = item.get("type")

                    # Check if this is a ClientToolCallItem (type='client_tool_call')
                    # These need special handling - must NOT be stripped to just role/content
                    if item_type == "client_tool_call":
                        logger.info(f"[session_input_callback] Found client_tool_call item: status={item.get('status')}, name={item.get('name')}")
                        # Only include completed tool calls (skip pending ones)
                        if item.get("status") == "completed":
                            # Convert to the format the agent expects:
                            # First the function_call, then the function_call_output
                            result = [
                                {
                                    "type": "function_call",
                                    "call_id": item.get("call_id"),
                                    "name": item.get("name"),
                                    "arguments": item.get("arguments", {}),
                                },
                                {
                                    "type": "function_call_output",
                                    "call_id": item.get("call_id"),
                                    "output": item.get("output"),
                                }
                            ]
                            logger.info(f"[session_input_callback] Converted completed client_tool_call to: {result}")
                            return result
                        else:
                            # Pending tool calls should be filtered out
                            logger.info(f"[session_input_callback] Filtering out pending client_tool_call")
                            return None

                    # If this is already a function_call or function_call_output from the
                    # Conversations API, keep it as-is (don't strip fields!)
                    if item_type == "function_call" or item_type == "function_call_output":
                        logger.info(f"[session_input_callback] Preserving {item_type} item: {item}")
                        # Remove extra fields that OpenAI doesn't accept, but keep the essential ones
                        sanitized = {"type": item_type}
                        if item_type == "function_call":
                            sanitized["call_id"] = item.get("call_id")
                            sanitized["name"] = item.get("name")
                            sanitized["arguments"] = item.get("arguments", {})
                        else:  # function_call_output
                            sanitized["call_id"] = item.get("call_id")
                            sanitized["output"] = item.get("output")
                        return sanitized

                    # For regular messages, keep only role and content
                    # But ensure content is properly formatted for the Agents SDK
                    # For agent inputs, assistant messages should use input_text content (not output_text)
                    role = item.get("role")
                    content = item.get("content", [])
                    
                    if isinstance(content, list):
                        # Convert content items to the format Agents SDK expects
                        formatted_content = []
                        for c in content:
                            if isinstance(c, dict):
                                # Convert output_text to input_text for assistant messages (agent inputs use input_text)
                                content_type = c.get("type")
                                if content_type == "output_text":
                                    # Convert output_text to input_text for agent inputs
                                    formatted_content.append({
                                        "type": "input_text",
                                        "text": c.get("text", ""),
                                    })
                                elif content_type == "input_text":
                                    # Already correct format
                                    formatted_content.append({
                                        "type": "input_text",
                                        "text": c.get("text", ""),
                                    })
                                elif "text" in c:
                                    # Unknown type but has text, convert to input_text
                                    formatted_content.append({
                                        "type": "input_text",
                                        "text": c.get("text", ""),
                                    })
                                else:
                                    # Unknown format, try to preserve it
                                    formatted_content.append(c)
                            elif isinstance(c, str):
                                # Plain string, wrap in input_text
                                formatted_content.append({
                                    "type": "input_text",
                                    "text": c,
                                })
                            else:
                                formatted_content.append(c)
                        content = formatted_content
                    elif isinstance(content, str):
                        # Plain string, wrap in input_text array
                        content = [{"type": "input_text", "text": content}]
                    
                    return {
                        "role": role,
                        "content": content,
                    }
                return item

            # Sanitize history items (they come from the conversation API with extra fields)
            sanitized_history = []
            for item in history_items:
                result = sanitize_item(item)
                if result is not None:
                    # sanitize_item can return a list (for client tool calls) or a dict
                    if isinstance(result, list):
                        sanitized_history.extend(result)
                    else:
                        sanitized_history.append(result)

            # New items should already be clean, but sanitize them too just in case
            sanitized_new = []
            for item in new_items:
                result = sanitize_item(item)
                if result is not None:
                    if isinstance(result, list):
                        sanitized_new.extend(result)
                    else:
                        sanitized_new.append(result)

            merged = sanitized_history + sanitized_new
            logger.info(f"[session_input_callback] Returning {len(merged)} merged items: {merged}")
            logger.info(f"[session_input_callback] Merged items length: {len(merged)}")
            logger.info(f"[session_input_callback] Merged items type: {type(merged)}")
            return merged
        
        # Create RunConfig with session_input_callback
        # Set up multi-provider support
        from .utils.multi_model_provider import MultiModelProvider, MultiModelProviderMap
        from .utils.ollama_model_provider import OllamaModelProvider
        
        model_provider_map = MultiModelProviderMap()
        
        # Add Anthropic provider using OpenAI interface
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
        
        # Use MultiModelProvider for model selection - it will delegate to OpenAIProvider by default
        model_provider = MultiModelProvider(
            provider_map=model_provider_map,
            openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
            openai_use_responses=False,
        )
        
        # Create RunConfig with session_input_callback and model_provider
        run_config = RunConfig(
            session_input_callback=session_input_callback,
            model_provider=model_provider,
        )
        
        # Use the dynamically loaded agent instead of hardcoded self.assistant_agent
        logger.info(f"[python-respond] About to call Runner.run_streamed with agent_input: {agent_input}")
        logger.info(f"[python-respond] agent_input length: {len(agent_input)}")
        logger.info(f"[python-respond] agent_input type: {type(agent_input)}")
        logger.info(f"[python-respond] session is: {session}")
        logger.info(f"[python-respond] run_config has session_input_callback: {run_config.session_input_callback is not None}")
        result = Runner.run_streamed(
            agent,
            agent_input,
            context=agent_context,
            session=session,
            run_config=run_config,
        )
        logger.info(f"[python-respond] Runner.run_streamed returned, result type: {type(result)}")
        
        # Wrap stream_agent_response to fix __fake_id__ in ThreadItemAddedEvent and ThreadItemDoneEvent items
        # CRITICAL: If items are saved with __fake_id__, they will overwrite each other due to PRIMARY KEY constraint
        # CRITICAL: Both thread.item.added and thread.item.done must have the SAME ID so the frontend recognizes them as the same item
        # This ensures ChatKit items have proper IDs (defense-in-depth - add_thread_item also fixes IDs)
        async def fix_chatkit_event_ids(events):
            event_count = 0
            # Track IDs we've generated for items, so thread.item.added and thread.item.done use the same ID
            item_id_map: dict[str, str] = {}  # Maps original __fake_id__ to generated ID
            
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
                yield event
        
        # Stream events with fixed IDs
        async for event in fix_chatkit_event_ids(stream_agent_response(agent_context, result)):
            yield event

