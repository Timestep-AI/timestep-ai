from typing import Any
from datetime import datetime
import uuid
import time
import random
import string
import json

from fastapi import HTTPException
from chatkit.store import Store, AttachmentStore
from chatkit.types import (
    ThreadMetadata,
    ThreadItem,
    UserMessageItem,
    AssistantMessageItem,
    UserMessageTextContent,
    AssistantMessageContent,
    InferenceOptions,
    Page as ChatKitPage,
)

class TContext(dict):
    """Request-scoped context passed through ChatKit and Store.

    Expected keys:
      - supabase: Client (RLS-aware; auth set with the user's JWT if provided)
      - user_id: str | None (UUID string; for anonymous usage provide a stable client UUID)
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

class StoreItemType:
    pass

def _parse_ts(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value)
    if isinstance(value, str):
        try:
            if value.endswith("Z"):
                value = value.replace("Z", "+00:00")
            return datetime.fromisoformat(value)
        except Exception:
            return datetime.now()
    return datetime.now()

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
        self, thread_id: str, item: ThreadItem, context: TContext | None = None
    ) -> None:
        """Add an item (message) to a thread."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")
        if not context.user_id:
            raise HTTPException(status_code=400, detail="Missing user_id (supply 'x-user-id' header for anonymous users)")

        supabase = context.supabase

        # Get next message index via RPC to ensure ordering under concurrency
        rpc_res = supabase.rpc("get_next_message_index", {"p_thread_id": thread_id}).execute()
        if rpc_res.data is None:
            raise HTTPException(status_code=500, detail="Failed to get next message index")
        next_index = int(rpc_res.data)

        # Serialize ChatKit ThreadItem into (role, content) for DB
        role = "assistant"
        content = ""
        if isinstance(item, UserMessageItem):
            role = "user"
            content = "\n".join(
                part.text for part in item.content if isinstance(part, UserMessageTextContent)
            )
        elif isinstance(item, AssistantMessageItem):
            role = "assistant"
            content = "\n".join(
                part.text for part in item.content if isinstance(part, AssistantMessageContent)
            )
        else:
            try:
                content = json.dumps(item.model_dump(), default=str)
            except Exception:
                content = str(item)

        insert_payload = {
            "id": f"msg_{int(time.time()*1000)}_{''.join(random.choices(string.ascii_lowercase + string.digits, k=6))}",
            "thread_id": thread_id,
            "user_id": context.user_id,
            "message_index": next_index,
            "role": role,
            "content": content,
            # Optional fields left null by default: name, tool_calls, tool_call_id, file_id
        }

        supabase.table("thread_messages").insert(insert_payload).execute()

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
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")
        supabase = context.supabase

        sel = (
            supabase
            .table("threads")
            .select("id, user_id, created_at, metadata, object, vector_store_id, updated_at")
            .eq("id", thread_id)
            .limit(1)
        ).execute()
        rows = sel.data or []
        if not rows:
            # If not found, initialize a new thread metadata (not persisted yet)
            return ThreadMetadata(
                id=thread_id,
                title="New Chat",
                created_at=datetime.now(),
                status={"type": "active"},
                metadata={},
            )

        row = rows[0]
        created_at_ts = row.get("created_at")
        created_dt = datetime.fromtimestamp(created_at_ts) if isinstance(created_at_ts, (int, float)) else datetime.now()
        metadata = row.get("metadata") or {}
        return ThreadMetadata(
            id=row["id"],
            title=metadata.get("title", "New Chat"),
            created_at=created_dt,
            status=metadata.get("status", {"type": "active"}),
            metadata=metadata,
        )

    async def load_thread_items(
        self, thread_id: str, limit: int, after: str | None = None, order: str = "asc", context: TContext | None = None
    ) -> ChatKitPage[ThreadItem]:
        """Load thread items (messages) with pagination."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")
        supabase = context.supabase

        q = (
            supabase
            .table("thread_messages")
            .select("id, message_index, role, content, name, tool_calls, tool_call_id, file_id, created_at")
            .eq("thread_id", thread_id)
        )

        # Cursor-based on message_index
        if after is not None:
            try:
                after_index = int(after)
                if order == "asc":
                    q = q.gt("message_index", after_index)
                else:
                    q = q.lt("message_index", after_index)
            except ValueError:
                pass

        effective_limit = (limit or 50)  # guard against None
        q = q.order("message_index", desc=(order != "asc")).limit(effective_limit + 1)
        res = q.execute()
        rows = res.data or []
        has_more = len(rows) > effective_limit
        rows = rows[:effective_limit]
        next_after = str(rows[-1]["message_index"]) if rows else None

        # Map DB rows to ChatKit ThreadItem models
        items: list[ThreadItem] = []
        for r in rows:
            role = r.get("role")
            item_id = r.get("id")
            created_at = _parse_ts(r.get("created_at"))
            text_content = (r.get("content") or "")

            if role == "user":
                items.append(
                    UserMessageItem(
                        id=item_id,
                        thread_id=thread_id,
                        created_at=created_at,
                        content=[UserMessageTextContent(text=text_content)],
                        attachments=[],
                        quoted_text=None,
                        inference_options=InferenceOptions(),
                    )
                )
            elif role == "assistant":
                items.append(
                    AssistantMessageItem(
                        id=item_id,
                        thread_id=thread_id,
                        created_at=created_at,
                        content=[AssistantMessageContent(text=text_content)],
                    )
                )
            else:
                items.append(
                    AssistantMessageItem(
                        id=item_id,
                        thread_id=thread_id,
                        created_at=created_at,
                        content=[AssistantMessageContent(text=text_content)],
                    )
                )

        return ChatKitPage(data=items, has_more=has_more, after=next_after)

    async def load_threads(
        self, limit: int, after: str | None = None, order: str = "desc", context: TContext | None = None
    ) -> ChatKitPage[ThreadMetadata]:
        """Load threads with pagination. Returns a Page object."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")
        if not context.user_id:
            # Require explicit user identity for listing to prevent anon from seeing all threads under permissive RLS
            raise HTTPException(status_code=400, detail="Missing user_id (supply 'x-user-id' header for anonymous users)")

        supabase = context.supabase
        q = (
            supabase
            .table("threads")
            .select("id, user_id, created_at, metadata, object, vector_store_id, updated_at")
        ).eq("user_id", context.user_id)

        if after is not None:
            try:
                after_ts = int(after)
                if order == "asc":
                    q = q.gt("created_at", after_ts)
                else:
                    q = q.lt("created_at", after_ts)
            except ValueError:
                pass

        q = q.order("created_at", desc=(order != "asc")).limit(limit + 1)
        res = q.execute()
        rows = res.data or []
        has_more = len(rows) > limit
        rows = rows[:limit]
        next_after = str(rows[-1]["created_at"]) if rows else None

        # Map DB rows -> ThreadMetadata objects as expected by ChatKit
        data: list[ThreadMetadata] = []
        for row in rows:
            created_at_ts = row.get("created_at")
            created_dt = datetime.fromtimestamp(created_at_ts) if isinstance(created_at_ts, (int, float)) else datetime.now()
            metadata = row.get("metadata") or {}
            data.append(
                ThreadMetadata(
                    id=row["id"],
                    title=metadata.get("title", "New Chat"),
                    created_at=created_dt,
                    status=metadata.get("status", {"type": "active"}),
                    metadata=metadata,
                )
            )

        return ChatKitPage(data=data, has_more=has_more, after=next_after)

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
        """Save or upsert a thread row."""
        if context is None:
            raise HTTPException(status_code=400, detail="Missing request context")
        if not context.user_id:
            raise HTTPException(status_code=400, detail="Missing user_id (supply 'x-user-id' header for anonymous users)")

        supabase = context.supabase
        created_ts = int(thread.created_at.timestamp()) if isinstance(thread.created_at, datetime) else int(time.time())

        payload = {
            "id": thread.id,
            "user_id": context.user_id,
            "created_at": created_ts,
            "metadata": thread.metadata or {},
            "object": "thread",
        }

        supabase.table("threads").upsert(payload).execute()

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

