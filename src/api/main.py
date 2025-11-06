from typing import Any, AsyncIterator, TypedDict, Final
import os
import json
import base64
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
import logging
from agents import Agent, Runner, RunConfig, OpenAIProvider, function_tool, RunContextWrapper, StopAtTools
from agents.memory import OpenAIConversationsSession
from openai import AsyncOpenAI
from chatkit.agents import simple_to_agent_input, stream_agent_response, AgentContext, ClientToolCall
from chatkit.server import StreamingResult, ChatKitServer
from chatkit.types import ThreadMetadata, UserMessageItem, ThreadStreamEvent, UserMessageTextContent, ClientToolCallItem, ThreadsAddClientToolOutputReq, StreamingReq, ThreadItemDoneEvent, ThreadItemAddedEvent, AssistantMessageItem
from datetime import datetime
from chatkit.store import Store, AttachmentStore
from chatkit.server import DEFAULT_PAGE_SIZE
from supabase import create_client, Client
from .stores import ChatKitDataStore, ChatKitAttachmentStore, TContext

# Constants for theme switching
SUPPORTED_COLOR_SCHEMES: Final[frozenset[str]] = frozenset({"light", "dark"})
CLIENT_THEME_TOOL_NAME: Final[str] = "switch_theme"

def _normalize_color_scheme(value: str) -> str:
    """Normalize color scheme input to 'light' or 'dark'."""
    normalized = str(value).strip().lower()
    if normalized in SUPPORTED_COLOR_SCHEMES:
        return normalized
    if "dark" in normalized:
        return "dark"
    if "light" in normalized:
        return "light"
    raise ValueError("Theme must be either 'light' or 'dark'.")

def _is_tool_completion_item(item: Any) -> bool:
    """Check if a thread item is a ClientToolCallItem."""
    return isinstance(item, ClientToolCallItem)

# Interface for agent record from database
# Matches TypeScript AgentRecord interface
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

app = FastAPI()

# Add CORS middleware to handle OPTIONS preflight requests
# IMPORTANT: CORS middleware must be added before exception handlers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Exception handler to ensure CORS headers are always included
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "detail": traceback.format_exc() if logger.level <= logging.DEBUG else None
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

data_store = ChatKitDataStore()
attachment_store = ChatKitAttachmentStore(data_store)

def _construct_supabase_db_url() -> str:
    """Construct Supabase database connection URL from available environment variables.
    
    Priority:
    1. Use SUPABASE_DB_URL if explicitly provided
    2. Construct from SUPABASE_URL and SUPABASE_DB_PASSWORD
    3. For local development (127.0.0.1 or localhost), use default local connection
    
    Returns connection string in format: postgresql+asyncpg://[user]:[password]@[host]:[port]/[database]
    """
    # First, check if explicit DB URL is provided
    db_url = os.environ.get("SUPABASE_DB_URL")
    if db_url:
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif not db_url.startswith("postgresql+asyncpg://"):
            db_url = f"postgresql+asyncpg://{db_url}"
        return db_url
    
    # Otherwise, construct from SUPABASE_URL
    supabase_url = os.environ.get("SUPABASE_URL")
    if not supabase_url:
        raise HTTPException(
            status_code=500,
            detail="Either SUPABASE_DB_URL or SUPABASE_URL environment variable is required"
        )
    
    # For local development (Supabase local)
    if "127.0.0.1" in supabase_url or "localhost" in supabase_url:
        # Local Supabase defaults
        db_password = os.environ.get("SUPABASE_DB_PASSWORD", "postgres")
        return f"postgresql+asyncpg://postgres:{db_password}@127.0.0.1:54322/postgres"
    
    # For production/cloud Supabase, extract project reference from URL
    # SUPABASE_URL format: https://[project-ref].supabase.co
    try:
        from urllib.parse import urlparse
        parsed = urlparse(supabase_url)
        hostname = parsed.hostname or ""
        
        # Extract project reference (everything before .supabase.co)
        if ".supabase.co" in hostname:
            project_ref = hostname.replace(".supabase.co", "")
        else:
            raise ValueError(f"Cannot extract project reference from {supabase_url}")
        
        # Get database password (required for cloud Supabase)
        db_password = os.environ.get("SUPABASE_DB_PASSWORD")
        if not db_password:
            raise HTTPException(
                status_code=500,
                detail="SUPABASE_DB_PASSWORD environment variable is required for cloud Supabase. "
                       "Alternatively, set SUPABASE_DB_URL with the full connection string."
            )
        
        # Construct connection string for cloud Supabase
        # Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
        # For now, use the direct connection format (simpler)
        # Note: This may need adjustment based on your Supabase region
        return f"postgresql+asyncpg://postgres.{project_ref}:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to construct database URL from SUPABASE_URL: {e}. "
                   "Either provide SUPABASE_DB_URL or SUPABASE_DB_PASSWORD"
        )

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
    
    if not response.data or len(response.data) == 0:
        return None
    
    return response.data[0]

def ensure_default_mcp_server(ctx: TContext) -> None:
    """Ensure the default MCP server exists for the user.
    
    Matches TypeScript McpServerStore.createDefaultMcpServer implementation.
    """
    if not ctx.user_id:
        return
    
    default_server_id = "00000000-0000-0000-0000-000000000000"
    supabase = ctx.supabase
    
    # Check if it exists
    response = (
        supabase.table("mcp_servers")
        .select("*")
        .eq("id", default_server_id)
        .eq("user_id", ctx.user_id)
        .execute()
    )
    
    if response.data and len(response.data) > 0:
        return  # Already exists
    
    # Create it
    supabase_url = os.environ.get("SUPABASE_URL")
    if not supabase_url:
        return  # Skip if URL not available
    
    insert_response = (
        supabase.table("mcp_servers")
        .insert({
            "id": default_server_id,
            "user_id": ctx.user_id,
            "name": "MCP Environment Server",
            "url": f"{supabase_url.rstrip('/')}/functions/v1/mcp-env/mcp",
        })
        .execute()
    )
    
    # Ignore duplicate key errors (23505) - means another process created it
    if insert_response.data is None and hasattr(insert_response, "error"):
        error_code = getattr(insert_response.error, "code", None)
        if error_code != "23505":
            logger.warning(f"Error creating default MCP server: {insert_response.error}")

@function_tool(
    description_override="Switch the chat interface between light and dark color schemes."
)
async def switch_theme(
    ctx: RunContextWrapper[AgentContext],
    theme: str,
) -> dict[str, str] | None:
    """Switch the theme between light and dark mode.

    This is a client tool that triggers a theme change in the frontend.
    """
    try:
        requested = _normalize_color_scheme(theme)
        ctx.context.client_tool_call = ClientToolCall(
            name=CLIENT_THEME_TOOL_NAME,
            arguments={"theme": requested},
        )
        return {"theme": requested}
    except Exception:
        logger.exception("Failed to switch theme")
        return None

def ensure_default_agents_exist(ctx: TContext) -> None:
    """Ensure default agents exist for the user.
    
    Matches TypeScript AgentStore.ensureDefaultAgentsExist implementation.
    """
    if not ctx.user_id:
        return
    
    default_model = os.environ.get("DEFAULT_AGENT_MODEL", "gpt-4o")
    default_model_settings = {
        "temperature": 0.0,
        "toolChoice": "auto",
        "reasoning": {"effort": None}
    }
    
    # Default Personal Assistant
    personal_assistant_id = "00000000-0000-0000-0000-000000000000"
    if not get_agent_by_id(personal_assistant_id, ctx):
        supabase = ctx.supabase
        insert_response = (
            supabase.table("agents")
            .insert({
                "id": personal_assistant_id,
                "user_id": ctx.user_id,
                "name": "Personal Assistant",
                "instructions": """# System context
You are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstraction: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named `transfer_to_<agent_name>`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.
You are an AI agent acting as a personal assistant.""",
                "tool_ids": ["00000000-0000-0000-0000-000000000000.think"],
                "handoff_ids": ["ffffffff-ffff-ffff-ffff-ffffffffffff"],
                "model": default_model,
                "model_settings": default_model_settings,
            })
            .execute()
        )
        # Ignore duplicate key errors
        if insert_response.data is None and hasattr(insert_response, "error"):
            error_code = getattr(insert_response.error, "code", None)
            if error_code != "23505":
                logger.warning(f"Error creating default Personal Assistant: {insert_response.error}")
    
    # Default Weather Assistant
    weather_assistant_id = "ffffffff-ffff-ffff-ffff-ffffffffffff"
    if not get_agent_by_id(weather_assistant_id, ctx):
        supabase = ctx.supabase
        insert_response = (
            supabase.table("agents")
            .insert({
                "id": weather_assistant_id,
                "user_id": ctx.user_id,
                "name": "Weather Assistant",
                "instructions": "You are a helpful AI assistant that can answer questions about weather. When asked about weather, you MUST use the get_weather tool to get accurate, real-time weather information.",
                "tool_ids": [
                    "00000000-0000-0000-0000-000000000000.get_weather",
                    "00000000-0000-0000-0000-000000000000.think",
                ],
                "handoff_ids": [],
                "model": default_model,
                "model_settings": default_model_settings,
            })
            .execute()
        )
        # Ignore duplicate key errors
        if insert_response.data is None and hasattr(insert_response, "error"):
            error_code = getattr(insert_response.error, "code", None)
            if error_code != "23505":
                logger.warning(f"Error creating default Weather Assistant: {insert_response.error}")

def load_agent_from_database(agent_id: str, ctx: TContext) -> Agent[AgentContext]:
    """Load an agent from the database by ID.

    Matches TypeScript implementation: queries agents table with RLS.
    Returns an Agent configured with the database record's settings.
    """
    if not ctx.user_id:
        raise HTTPException(status_code=400, detail="user_id is required to load agents")

    agent_record = get_agent_by_id(agent_id, ctx)
    if not agent_record:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")

    # Create Agent from database record
    # Use model from database, fallback to 'gpt-4o' if not set
    model = agent_record.get("model") or "gpt-4o" # TODO: No fallbacks!

    # Add client tools (like switch_theme) to all agents
    tools = [switch_theme]

    logger.info(f"Loading agent {agent_id} with model {model} and tools: {[t.__name__ if hasattr(t, '__name__') else str(t) for t in tools]}")

    agent = Agent[AgentContext](
        model=model,
        name=agent_record.get("name", "Assistant"),
        instructions=agent_record.get("instructions", "You are a helpful assistant"),
        tools=tools,  # type: ignore[arg-type]
        tool_use_behavior=StopAtTools(stop_at_tool_names=[CLIENT_THEME_TOOL_NAME]),
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


def _functions_base_url() -> str:
    supabase_url = os.environ.get("SUPABASE_URL")
    if not supabase_url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL is required")
    return f"{supabase_url.rstrip('/')}/functions/v1"

class MyChatKitServer(ChatKitServer):
    def __init__(
        self, data_store: Store, attachment_store: AttachmentStore | None = None
    ):
        super().__init__(data_store, attachment_store)

    async def _process_streaming_impl(
        self, request: StreamingReq, context: TContext
    ) -> AsyncIterator[ThreadStreamEvent]:
        # Override to fix threads.add_client_tool_output handler
        # The library loads only 1 item, but we need to load more to find pending tool calls
        # if an assistant message was saved after the tool call
        
        if isinstance(request, ThreadsAddClientToolOutputReq):
            thread = await self.store.load_thread(
                request.params.thread_id, context=context
            )
            # Load DEFAULT_PAGE_SIZE items instead of just 1 to find pending tool calls
            items = await self.store.load_thread_items(
                thread.id, None, DEFAULT_PAGE_SIZE, "desc", context
            )
            logger.info(f"[_process_streaming_impl] Loaded {len(items.data)} items for thread {thread.id}")
            logger.info(f"[_process_streaming_impl] Item types: {[item.type if hasattr(item, 'type') else type(item).__name__ for item in items.data]}")
            tool_call = next(
                (
                    item
                    for item in items.data
                    if isinstance(item, ClientToolCallItem)
                    and item.status == "pending"
                ),
                None,
            )
            if not tool_call:
                logger.error(f"[_process_streaming_impl] No pending ClientToolCallItem found in {len(items.data)} items")
                logger.error(f"[_process_streaming_impl] Items: {items.data}")
                raise ValueError(
                    f"Last thread item in {thread.id} was not a ClientToolCallItem"
                )

            tool_call.output = request.params.result
            tool_call.status = "completed"

            await self.store.save_item(thread.id, tool_call, context=context)

            # Safety against dangling pending tool calls if there are
            # multiple in a row, which should be impossible, and
            # integrations should ultimately filter out pending tool calls
            # when creating input response messages.
            await self._cleanup_pending_client_tool_call(thread, context)

            async for event in self._process_events(
                thread,
                context,
                lambda: self.respond(thread, None, context),
            ):
                yield event
        else:
            # For all other cases, use the parent's implementation
            async for event in super()._process_streaming_impl(request, context):
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
        agent_id = context.get("agent_id")
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
        # Set up multi-provider support - match TypeScript implementation
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

server = MyChatKitServer(data_store, attachment_store)

def extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

def decode_jwt_sub(jwt_token: str) -> str | None:
    try:
        # Decode JWT without verification to extract 'sub'
        parts = jwt_token.split(".")
        if len(parts) < 2:
            return None
        payload_b64 = parts[1]
        # Base64url decode with padding
        padding = '=' * (-len(payload_b64) % 4)
        payload_json = base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8")
        payload = json.loads(payload_json)
        sub = payload.get("sub") or payload.get("user_id")
        return sub
    except Exception:
        return None

def build_request_context(request: Request, agent_id: str | None = None) -> TContext:
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase env vars SUPABASE_URL and SUPABASE_ANON_KEY are required")

    token = extract_bearer_token(request)
    client: Client = create_client(supabase_url, supabase_key)
    # Apply per-request RLS via JWT if present
    if token:
        client.postgrest.auth(token)

    user_id = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
    if not user_id and token:
        user_id = decode_jwt_sub(token)

    return TContext({
        "supabase": client,
        "user_id": user_id,
        "user_jwt": token,
        "agent_id": agent_id,
    })

# @app.post("/chatkit")
@app.post("/agents/{agent_id}/chatkit")
async def chatkit_endpoint(request: Request, agent_id: str):
    try:
        body = await request.body()
        # Build context with agent_id included
        ctx = build_request_context(request, agent_id=agent_id)
        result = await server.process(body, ctx)
        if isinstance(result, StreamingResult):
            return StreamingResponse(
                result.json_events,
                media_type="text/event-stream",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                }
            )
        else:
            return Response(
                content=result.json,
                media_type="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                }
            )
    except Exception as e:
        logger.error(f"Error in chatkit_endpoint: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "detail": traceback.format_exc()},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )

@app.get("/threads/list")
async def list_threads(request: Request, limit: int = 20, after: str | None = None, order: str = "desc"):
    try:
        ctx = build_request_context(request)
        page = await data_store.load_threads(limit=limit, after=after, order=order, context=ctx)
        # page.data contains ThreadMetadata instances – convert to JSON-friendly dicts
        def _thread_to_dict(t: ThreadMetadata) -> dict[str, Any]:
            status_value = t.status
            if not isinstance(status_value, dict):
                if hasattr(status_value, "type"):
                    status_value = {"type": getattr(status_value, "type")}
                else:
                    status_value = {"type": str(status_value)}
            return {
                "id": t.id,
                "title": t.title,
                "created_at": int(t.created_at.timestamp()),
                "status": status_value,
                "metadata": t.metadata,
            }
        json_data = [_thread_to_dict(t) for t in page.data]

        return JSONResponse(
            status_code=200,
            content={
                "data": json_data,
                "has_more": page.has_more,
                "after": page.after,
            },
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
    except HTTPException as he:
        return JSONResponse(
            status_code=he.status_code,
            content={"detail": he.detail},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
    except Exception as e:
        logger.error(f"Error in list_threads: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "detail": traceback.format_exc()},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )

@app.post("/agents")
@app.get("/agents")
async def get_agents(request: Request):
    """Get all agents for the current user.
    
    Ensures default agents and MCP server exist before returning.
    Matches TypeScript AgentsService.getAllAgents implementation.
    """
    try:
        ctx = build_request_context(request)
        
        if not ctx.user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Ensure default agents exist first
        ensure_default_agents_exist(ctx)
        ensure_default_mcp_server(ctx)
        
        # Fetch all agents for the user
        supabase: Client = ctx["supabase"]
        response = (
            supabase.table("agents")
            .select("*")
            .eq("user_id", ctx.user_id)
            .order("created_at", desc=False)
            .execute()
        )
        
        if not response.data:
            agents = []
        else:
            agents = response.data
        
        return JSONResponse(
            status_code=200,
            content=agents,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching agents: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch agents", "detail": str(e)},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )
    
