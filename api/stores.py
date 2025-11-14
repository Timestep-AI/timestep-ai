"""ChatKit Data Store implementation that uses OpenAI ChatKit API via OpenAI Python client."""
from typing import Any
from datetime import datetime
import os
import logging

from fastapi import HTTPException
from chatkit.store import Store, AttachmentStore
from chatkit.types import (
    ThreadMetadata,
    ThreadItem,
    UserMessageItem,
    AssistantMessageItem,
    ClientToolCallItem,
    WidgetItem,
    UserMessageTextContent,
    AssistantMessageContent,
    InferenceOptions,
    Page as ChatKitPage,
)
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class TContext(dict):
    """Request-scoped context passed through ChatKit and Store.

    Expected keys:
      - supabase: Client (RLS-aware; auth set with the user's JWT if provided)
      - user_id: str | None (UUID string)
      - user_jwt: str | None (JWT token for API authentication)
      - agent_id: str | None (optional agent ID from URL)
    """
    @property
    def supabase(self):
        from supabase import Client
        return self["supabase"]

    @property
    def user_id(self) -> str | None:
        return self.get("user_id")

    @property
    def user_jwt(self) -> str | None:
        return self.get("user_jwt")

    @property
    def agent_id(self) -> str | None:
        return self.get("agent_id")


class ChatKitDataStore(Store):
    """Store implementation using OpenAI ChatKit API."""

    def __init__(self):
        """Initialize the ChatKit data store with OpenAI client."""
        # Point to our Supabase edge function that implements ChatKit API
        supabase_url = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
        self.base_url = f"{supabase_url}/functions/v1/openai-polyfill"

    def _get_client(self, context: TContext | None) -> AsyncOpenAI:
        """Get OpenAI client with proper authentication."""
        api_key = context.user_jwt if context and context.user_jwt else "dummy-key"
        return AsyncOpenAI(
            api_key=api_key,
            base_url=self.base_url,
            default_headers={
                "OpenAI-Beta": "chatkit_beta=v1",
            }
        )

    @staticmethod
    def generate_thread_id(context: TContext | None = None) -> str:
        """Generate a new thread ID with chatkit prefix."""
        import uuid
        return f"cthr_{uuid.uuid4().hex[:12]}"

    def generate_item_id(
        self, item_type: str | Any, thread: ThreadMetadata, context: TContext | None = None
    ) -> str:
        """Generate a unique item ID with chatkit prefix."""
        import uuid
        import time
        timestamp = int(time.time() * 1000)
        random_str = uuid.uuid4().hex[:6]
        return f"cthi_{timestamp}_{random_str}"

    async def add_thread_item(
        self, thread_id: str, item: ThreadItem, context: TContext | None = None
    ) -> None:
        """Add an item to a thread using custom ChatKit API endpoints."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")
        if not context.user_id:
            raise HTTPException(status_code=400, detail="Missing user_id")

        item_id = item.id if hasattr(item, 'id') else 'N/A'
        logger.info(f"[add_thread_item] Adding item to thread {thread_id}: type={item.type if hasattr(item, 'type') else type(item).__name__}, id={item_id}")
        
        # CRITICAL: Check if ID is invalid for any item type
        # If items are saved with __fake_id__, they will overwrite each other due to PRIMARY KEY constraint
        if item_id == '__fake_id__' or not item_id or item_id == 'N/A':
            logger.error(f"[add_thread_item] WARNING: Item has invalid ID: {item_id}, type={item.type if hasattr(item, 'type') else type(item).__name__}")
            # Generate a proper ID if missing
            # Create a minimal ThreadMetadata for generate_item_id
            thread_meta = ThreadMetadata(id=thread_id, created_at=datetime.now())
            # Determine item type for ID generation
            if isinstance(item, ClientToolCallItem):
                item_type_for_id = "tool_call"
                logger.info(f"[add_thread_item] ClientToolCallItem: status={item.status}, name={item.name}, call_id={item.call_id}")
            elif isinstance(item, WidgetItem):
                item_type_for_id = "widget"
            elif isinstance(item, AssistantMessageItem):
                item_type_for_id = "message"
            elif isinstance(item, UserMessageItem):
                item_type_for_id = "message"
            else:
                item_type_for_id = "message"  # Default fallback
            item.id = self.generate_item_id(item_type_for_id, thread_meta, context)
            logger.info(f"[add_thread_item] Generated new ID for item: {item.id}")
        elif isinstance(item, ClientToolCallItem):
            logger.info(f"[add_thread_item] ClientToolCallItem: status={item.status}, name={item.name}, call_id={item.call_id}, id={item_id}")

        import httpx

        client = self._get_client(context)

        # CUSTOM: Ensure thread exists
        try:
            await client.post(
                f"/chatkit/threads/{thread_id}/ensure",
                cast_to=httpx.Response,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to ensure thread: {str(e)}")

        # CUSTOM: Get next item index
        try:
            response = await client.post(
                f"/chatkit/threads/{thread_id}/next_index",
                cast_to=httpx.Response,
            )
            result = response.json()
            next_index = result["next_index"]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get next index: {str(e)}")

        # Serialize item to ChatKit format
        item_data = self._serialize_thread_item(item)

        # CUSTOM: Add thread item
        try:
            await client.post(
                f"/chatkit/threads/{thread_id}/items",
                cast_to=httpx.Response,
                body={
                    "id": item.id,
                    "created_at": int(item.created_at.timestamp()),
                    "type": item_data["type"],
                    "data": item_data,
                    "item_index": next_index,
                },
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to add thread item: {str(e)}")

    def _serialize_thread_item(self, item: ThreadItem) -> dict[str, Any]:
        """Serialize a ThreadItem to ChatKit API format."""
        import json

        if isinstance(item, UserMessageItem):
            result = {
                "type": "chatkit.user_message",
                "content": [
                    {"type": "input_text", "text": part.text}
                    for part in item.content
                    if hasattr(part, "text")
                ],
                "attachments": item.attachments or [],
            }
            if item.inference_options:
                # Convert InferenceOptions to dict for JSON serialization
                if isinstance(item.inference_options, InferenceOptions):
                    result["inference_options"] = item.inference_options.model_dump()
                elif isinstance(item.inference_options, dict):
                    result["inference_options"] = item.inference_options
                else:
                    result["inference_options"] = dict(item.inference_options)
            return result
        elif isinstance(item, AssistantMessageItem):
            return {
                "type": "chatkit.assistant_message",
                "content": [
                    {"type": "output_text", "text": part.text}
                    for part in item.content
                    if hasattr(part, "text")
                ],
            }
        elif isinstance(item, ClientToolCallItem):
            return {
                "type": "chatkit.client_tool_call",
                "status": item.status,
                "call_id": item.call_id,
                "name": item.name,
                "arguments": json.dumps(item.arguments) if isinstance(item.arguments, dict) else item.arguments,
                "output": json.dumps(item.output) if item.output and isinstance(item.output, dict) else item.output,
            }
        elif isinstance(item, WidgetItem):
            # Widget should be serialized as a JSON string per OpenAPI spec
            widget_value = item.widget
            if widget_value:
                # Handle Pydantic models
                if hasattr(widget_value, "model_dump"):
                    widget_dict = widget_value.model_dump()
                    serialized_widget = json.dumps(widget_dict)
                elif isinstance(widget_value, dict):
                    serialized_widget = json.dumps(widget_value)
                elif isinstance(widget_value, str):
                    serialized_widget = widget_value
                else:
                    serialized_widget = json.dumps({})
            else:
                serialized_widget = json.dumps({})
            
            return {
                "type": "chatkit.widget",
                "widget": serialized_widget,
            }
        else:
            raise ValueError(f"Unsupported item type: {type(item)}")

    def _deserialize_thread_item(self, item_data: dict[str, Any]) -> ThreadItem:
        """Deserialize ChatKit API format to ThreadItem."""
        import json
        import time

        item_type = item_data.get("type")
        item_id = item_data.get("id")
        thread_id = item_data.get("thread_id")
        created_at = datetime.fromtimestamp(item_data.get("created_at", time.time()))

        if item_type == "chatkit.user_message":
            content = [
                UserMessageTextContent(type="input_text", text=part["text"])
                for part in item_data.get("content", [])
                if part.get("type") == "input_text"
            ]
            # Reconstruct InferenceOptions from dict if present
            inference_options_data = item_data.get("inference_options")
            inference_options = None
            if inference_options_data:
                if isinstance(inference_options_data, dict):
                    inference_options = InferenceOptions(**inference_options_data)
                elif isinstance(inference_options_data, InferenceOptions):
                    inference_options = inference_options_data

            return UserMessageItem(
                id=item_id,
                thread_id=thread_id,
                created_at=created_at,
                content=content,
                attachments=item_data.get("attachments", []),
                inference_options=inference_options,
            )
        elif item_type == "chatkit.assistant_message":
            content = [
                AssistantMessageContent(
                    type="output_text",
                    text=part.get("text", ""),
                    annotations=part.get("annotations", []) if isinstance(part.get("annotations"), list) else []
                )
                for part in item_data.get("content", [])
                if part.get("type") == "output_text"
            ]
            return AssistantMessageItem(
                id=item_id,
                thread_id=thread_id,
                created_at=created_at,
                content=content,
            )
        elif item_type == "chatkit.client_tool_call":
            arguments = item_data.get("arguments", "{}")
            if isinstance(arguments, str):
                try:
                    arguments = json.loads(arguments)
                except:
                    arguments = {}

            output = item_data.get("output")
            if output and isinstance(output, str):
                try:
                    output = json.loads(output)
                except:
                    pass

            return ClientToolCallItem(
                id=item_id,
                thread_id=thread_id,
                created_at=created_at,
                status=item_data.get("status", "pending"),
                call_id=item_data.get("call_id", ""),
                name=item_data.get("name", ""),
                arguments=arguments,
                output=output,
            )
        elif item_type == "chatkit.widget":
            # Widget is stored as a JSON string per OpenAPI spec, deserialize it
            widget_str = item_data.get("widget")
            widget_obj = {}
            if widget_str and isinstance(widget_str, str):
                try:
                    widget_obj = json.loads(widget_str)
                except:
                    widget_obj = {}
            elif widget_str and isinstance(widget_str, dict):
                widget_obj = widget_str
            
            return WidgetItem(
                id=item_id,
                thread_id=thread_id,
                created_at=created_at,
                widget=widget_obj,
                copy_text=item_data.get("copy_text") if item_data.get("copy_text") else None,
            )
        else:
            raise ValueError(f"Unsupported item type: {item_type}")

    async def load_thread(
        self, thread_id: str, context: TContext | None = None
    ) -> ThreadMetadata:
        """Load thread metadata via ChatKit API using OpenAI client."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")

        client = self._get_client(context)

        try:
            # Use OpenAI client to retrieve thread
            thread = await client.beta.chatkit.threads.retrieve(thread_id)

            return ThreadMetadata(
                id=thread.id,
                created_at=datetime.fromtimestamp(thread.created_at),
            )
        except Exception as e:
            if "404" in str(e):
                raise HTTPException(status_code=404, detail="Thread not found")
            raise HTTPException(status_code=500, detail=str(e))

    async def load_thread_items(
        self, thread_id: str, after: str | None, limit: int, order: str, context: TContext | None = None
    ) -> ChatKitPage[ThreadItem]:
        """Load thread items via ChatKit API using OpenAI client."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")

        client = self._get_client(context)

        try:
            # Use OpenAI client to list thread items
            params = {
                "limit": limit,
                "order": order,
            }
            if after:
                params["after"] = after

            response = await client.beta.chatkit.threads.list_items(
                thread_id=thread_id,
                **params
            )

            # Convert response items to ThreadItem objects
            items = [self._deserialize_thread_item(item.model_dump()) for item in response.data]

            return ChatKitPage(
                data=items,
                first_id=response.first_id,
                last_id=response.last_id,
                has_more=response.has_more,
            )
        except Exception as e:
            if "404" in str(e):
                raise HTTPException(status_code=404, detail="Thread not found")
            raise HTTPException(status_code=500, detail=str(e))

    async def load_threads(
        self, after: str | None, limit: int, order: str, context: TContext | None = None
    ) -> ChatKitPage[ThreadMetadata]:
        """Load threads via ChatKit API using OpenAI client."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")

        client = self._get_client(context)

        try:
            params = {
                "limit": limit,
                "order": order,
            }
            if after:
                params["after"] = after

            response = await client.beta.chatkit.threads.list(**params)

            threads = [
                ThreadMetadata(
                    id=t.id,
                    created_at=datetime.fromtimestamp(t.created_at),
                )
                for t in response.data
            ]

            return ChatKitPage(
                data=threads,
                first_id=response.first_id,
                last_id=response.last_id,
                has_more=response.has_more,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def save_thread(
        self, thread: ThreadMetadata, context: TContext | None = None
    ) -> None:
        """Save thread metadata (threads are auto-created when adding items)."""
        pass

    async def save_item(
        self, thread_id: str, item: ThreadItem, context: TContext | None = None
    ) -> None:
        """Update an existing thread item using custom ChatKit API endpoint."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")

        import httpx

        client = self._get_client(context)
        item_data = self._serialize_thread_item(item)

        # CUSTOM: Update thread item
        try:
            await client.put(
                f"/chatkit/threads/{thread_id}/items/{item.id}",
                cast_to=httpx.Response,
                body={"data": item_data},
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update thread item: {str(e)}")

    async def delete_thread_item(
        self, thread_id: str, item_id: str, context: TContext | None = None
    ) -> None:
        """Delete a thread item using custom ChatKit API endpoint."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")

        import httpx

        client = self._get_client(context)

        # CUSTOM: Delete thread item
        try:
            await client.delete(
                f"/chatkit/threads/{thread_id}/items/{item_id}",
                cast_to=httpx.Response,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete thread item: {str(e)}")

    # Stub methods required by Store interface
    def delete_attachment(self, attachment_id: str, context: TContext | None = None) -> None:
        raise NotImplementedError("Attachments not yet supported")

    def delete_thread(self, thread_id: str, context: TContext | None = None) -> None:
        raise NotImplementedError("delete_thread not yet implemented")

    def load_attachment(self, attachment_id: str, context: TContext | None = None) -> bytes:
        raise NotImplementedError("Attachments not yet supported")

    async def load_item(self, thread_id: str, item_id: str, context: TContext | None = None) -> ThreadItem:
        """Load a specific thread item by ID.
        
        Uses listItems to find the specific item with matching ID.
        """
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")
        if not context.user_id:
            raise HTTPException(status_code=400, detail="Missing user_id")
        
        try:
            client = self._get_client(context)
            
            # Use listItems to find the specific item
            # We'll fetch items and find the one with matching ID
            response = await client.beta.chatkit.threads.list_items(
                thread_id,
                limit=100,  # Fetch a reasonable number of items to find the one
                order="desc",
            )
            
            # Find the item with matching ID
            item = None
            for candidate in response.data:
                if candidate.id == item_id:
                    item = candidate
                    break
            
            if not item:
                raise HTTPException(status_code=404, detail=f"Item {item_id} not found in thread {thread_id}")
            
            # Convert Pydantic model to dict if needed
            if hasattr(item, 'model_dump'):
                item_dict = item.model_dump(mode='json')
            elif hasattr(item, 'dict'):
                item_dict = item.dict()
            elif isinstance(item, dict):
                item_dict = item
            else:
                # Try to convert to dict using __dict__
                item_dict = dict(item) if hasattr(item, '__dict__') else item
            
            return self._deserialize_thread_item(item_dict)
        except HTTPException:
            raise
        except Exception as e:
            if "404" in str(e) or "not found" in str(e).lower():
                raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
            logger.exception(f"[load_item] Error loading item {item_id} from thread {thread_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load thread item: {str(e)}")

    def save_attachment(self, attachment_id: str, data: bytes, context: TContext | None = None) -> None:
        raise NotImplementedError("Attachments not yet supported")


class ChatKitAttachmentStore(AttachmentStore):
    """Attachment store implementation for ChatKit (not yet implemented)."""

    def __init__(self, data_store: Store):
        self.data_store = data_store

    def delete_attachment(self, attachment_id: str, context: Any = None) -> None:
        raise NotImplementedError("Attachments not yet supported")

    def generate_attachment_id(self, context: Any = None) -> str:
        import uuid
        return f"attach_{uuid.uuid4().hex[:12]}"

    def load_attachment(self, attachment_id: str, context: Any = None) -> bytes:
        raise NotImplementedError("Attachments not yet supported")

    def save_attachment(self, attachment_id: str, data: bytes, context: Any = None) -> None:
        raise NotImplementedError("Attachments not yet supported")
