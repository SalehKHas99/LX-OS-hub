from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FriendOut(BaseModel):
    user_id: UUID
    username: str
    status: str  # "accepted" | "pending" (for pending incoming: they requested you)
    created_at: datetime


class FriendRequestIn(BaseModel):
    addressee_id: UUID


class BlockedUserOut(BaseModel):
    user_id: UUID
    username: str
    blocked_at: datetime
