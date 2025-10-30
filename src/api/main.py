from typing import Any, AsyncIterator
from datetime import datetime
import uuid
import time
import random
import string

from agents import Agent, Runner
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
import logging
from chatkit.agents import simple_to_agent_input, stream_agent_response, AgentContext
from chatkit.server import StreamingResult, ChatKitServer
from chatkit.types import ThreadMetadata, UserMessageItem, ThreadStreamEvent
from chatkit.store import Store, AttachmentStore

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

class TContext:
    pass

class StoreItemType:
    pass

class Page:
    """Page object for paginated results."""
    def __init__(self, data: list[Any], has_more: bool, after: str | None = None):
        self.data = data
        self.has_more = has_more
        self.after = after

class PostgresStore(Store):
    @staticmethod
    def generate_thread_id(context: TContext | None = None) -> str:
        """Generate a new thread ID."""
        return str(uuid.uuid4())

    def generate_item_id(
        self, item_type: str | StoreItemType, thread: ThreadMetadata, context: TContext | None = None
    ) -> str:
        """Generate a unique item ID."""
        # Convert item_type to string if it's not already
        prefix = str(item_type) if isinstance(item_type, str) else "item"
        timestamp = int(time.time() * 1000)  # milliseconds like JavaScript Date.now()
        random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        return f"{prefix}_{timestamp}_{random_str}"

    async def add_thread_item(
        self, thread_id: str, item: Any, context: TContext | None = None
    ) -> None:
        """Add an item (message) to a thread."""
        # TODO: Implement database save
        pass

    def delete_attachment(
        self, *args: any, **kwargs: any
    ) -> None:
        raise NotImplementedError("delete_attachment is not implemented")

    def delete_thread(
        self, *args: any, **kwargs: any
    ) -> None:
        raise NotImplementedError("delete_thread is not implemented")

    def delete_thread_item(
        self, *args: any, **kwargs: any
    ) -> None:
        raise NotImplementedError("delete_thread_item is not implemented")

    def load_attachment(
        self, *args: any, **kwargs: any
    ) -> None:
        raise NotImplementedError("load_attachment is not implemented")

    def load_item(
        self, *args: any, **kwargs: any
    ) -> None:
        raise NotImplementedError("load_item is not implemented")

    async def load_thread(
        self, thread_id: str, context: TContext | None = None
    ) -> ThreadMetadata:
        """Load a thread by ID."""
        # TODO: Implement database query
        # For now, return a basic thread metadata
        return ThreadMetadata(
            id=thread_id,
            title="New Chat",
            created_at=datetime.now(),
            status={"type": "active"},
            metadata={},
        )

    async def load_thread_items(
        self, thread_id: str, limit: int, after: str | None = None, order: str = "asc", context: TContext | None = None
    ) -> Page:
        """Load thread items (messages) with pagination."""
        # TODO: Implement database query
        return Page(
            data=[],
            has_more=False,
            after=None,
        )

    async def load_threads(
        self, limit: int, after: str | None = None, order: str = "desc", context: TContext | None = None
    ) -> Page:
        """Load threads with pagination. Returns a Page object."""
        # TODO: Implement database query
        # For now, return empty list to prevent crashes
        return Page(
            data=[],
            has_more=False,
            after=None,
        )

    def save_attachment(
        self, *args: any, **kwargs: any
    ) -> None:
        raise NotImplementedError("save_attachment is not implemented")

    def save_item(
        self, *args: any, **kwargs: any
    ) -> None:
        raise NotImplementedError("save_item is not implemented")

    async def save_thread(
        self, thread: ThreadMetadata, context: TContext | None = None
    ) -> None:
        """Save a thread."""
        # TODO: Implement database save
        pass

class BlobStorageStore(AttachmentStore):
    def __init__(self, data_store: Store):
        self.data_store = data_store

    def delete_attachment(
        self, *args: any, **kwargs: any
    ) -> None:
        raise NotImplementedError("delete_attachment is not implemented")

    def generate_attachment_id(
        self, mime_type: str, context: TContext
    ) -> str:
        raise NotImplementedError("generate_attachment_id is not implemented")

data_store = PostgresStore()
attachment_store = BlobStorageStore(data_store)

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
        result = Runner.run_streamed(
            self.assistant_agent,
            await simple_to_agent_input(input) if input else [],
            context=agent_context,
        )
        async for event in stream_agent_response(agent_context, result):
            yield event

server = MyChatKitServer(data_store, attachment_store)

# @app.post("/chatkit")
@app.post("/agents/{agent_id}/chatkit")
async def chatkit_endpoint(request: Request, agent_id: str):
    try:
        body = await request.body()
        result = await server.process(body, {})
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
