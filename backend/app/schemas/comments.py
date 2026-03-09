from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.schemas.prompts import CreatorSummary


class CommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[UUID] = None


class CommentOut(BaseModel):
    id: UUID
    content: str
    user: CreatorSummary
    parent_comment_id: Optional[UUID] = None
    moderation_state: str
    created_at: datetime
    replies: List["CommentOut"] = []

    model_config = {"from_attributes": True}


CommentOut.model_rebuild()
