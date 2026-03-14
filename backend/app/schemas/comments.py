from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.schemas.prompts import CreatorSummary


class CommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[UUID] = None


class CommentUpdate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 1:
            raise ValueError("Content cannot be empty")
        return v


class VoteIn(BaseModel):
    value: int  # 1 upvote, -1 downvote

    @field_validator("value")
    @classmethod
    def value_must_be_one_or_minus_one(cls, v: int) -> int:
        if v not in (1, -1):
            raise ValueError("value must be 1 or -1")
        return v


class CommentOut(BaseModel):
    id: UUID
    content: str
    user: CreatorSummary
    parent_comment_id: Optional[UUID] = None
    moderation_state: str
    created_at: datetime
    replies: List["CommentOut"] = []
    vote_score: int = 0
    current_user_vote: Optional[int] = None  # 1 upvote, -1 downvote, None not voted

    model_config = {"from_attributes": True}


CommentOut.model_rebuild()
