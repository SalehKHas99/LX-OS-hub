from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    recipient_id: UUID
    content: str = Field(..., min_length=1, max_length=10000)


class MessageOut(BaseModel):
    id: UUID
    sender_id: UUID
    recipient_id: UUID
    sender_username: Optional[str] = None
    content: str
    created_at: datetime
    read_at: Optional[datetime] = None
    is_from_me: bool = False

    model_config = {"from_attributes": True}


class ConversationSummary(BaseModel):
    """One conversation with another user (for inbox list)."""
    other_user_id: UUID
    other_username: str
    last_message_preview: Optional[str] = None
    last_at: Optional[datetime] = None
    unread_count: int = 0
