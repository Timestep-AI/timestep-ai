from typing import Any, AsyncIterator
import os
import json
import base64
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
import logging
from agents import Agent, Runner, RunConfig
from agents.extensions.memory import SQLAlchemySession
from chatkit.agents import simple_to_agent_input, stream_agent_response, AgentContext
from chatkit.server import StreamingResult, ChatKitServer
from chatkit.types import ThreadMetadata, UserMessageItem, ThreadStreamEvent, UserMessageTextContent
from chatkit.store import Store, AttachmentStore
from supabase import create_client, Client
from .stores import PostgresStore, BlobStorageStore, TContext

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

data_store = PostgresStore()
attachment_store = BlobStorageStore(data_store)

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

def _get_session_for_thread(thread_id: str) -> SQLAlchemySession:
    """Create or get a SQLAlchemySession for a given thread.
    
    Uses thread-based session ID naming: "thread_{thread_id}"
    This works with Supabase RLS since sessions are implicitly user-scoped.
    """
    session_id = f"thread_{thread_id}"
    db_url = _construct_supabase_db_url()
    return SQLAlchemySession.from_url(
        session_id=session_id,
        url=db_url,
        create_tables=True
    )

class MyChatKitServer(ChatKitServer):
    def __init__(
        self, data_store: Store, attachment_store: AttachmentStore | None = None
    ):
        super().__init__(data_store, attachment_store)

    assistant_agent = Agent[AgentContext](
        model="gpt-4.1",
        name="Assistant",
        instructions="You are a helpful assistant"
    )

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
        # Create SQLAlchemySession with thread-based session ID
        session = _get_session_for_thread(thread.id)
        
        # Convert input to agent format
        agent_input = await simple_to_agent_input(input) if input else []
        
        # Define session_input_callback to merge list input with conversation history
        # Signature: (history_items: list, new_items: list) -> list
        # history_items: items from session history
        # new_items: new input items for current turn
        def session_input_callback(history_items, new_items):
            """Merge session history with new input items."""
            # Combine history + new input items
            return history_items + new_items
        
        # Create RunConfig with session_input_callback
        run_config = RunConfig(session_input_callback=session_input_callback)
        
        result = Runner.run_streamed(
            self.assistant_agent,
            agent_input,
            context=agent_context,
            session=session,
            run_config=run_config,
        )
        async for event in stream_agent_response(agent_context, result):
            yield event

server = MyChatKitServer(data_store, attachment_store)

def _extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

def _decode_jwt_sub(jwt_token: str) -> str | None:
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

def _build_request_context(request: Request) -> TContext:
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase env vars SUPABASE_URL and SUPABASE_ANON_KEY are required")

    token = _extract_bearer_token(request)
    client: Client = create_client(supabase_url, supabase_key)
    # Apply per-request RLS via JWT if present
    if token:
        client.postgrest.auth(token)

    user_id = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
    if not user_id and token:
        user_id = _decode_jwt_sub(token)

    return TContext({
        "supabase": client,
        "user_id": user_id,
    })

# @app.post("/chatkit")
@app.post("/agents/{agent_id}/chatkit")
async def chatkit_endpoint(request: Request, agent_id: str):
    try:
        body = await request.body()
        ctx = _build_request_context(request)
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
        ctx = _build_request_context(request)
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
