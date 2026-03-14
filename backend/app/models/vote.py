from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base


class PromptVote(Base):
    """User vote on a prompt: value 1 (up) or -1 (down). One vote per user per prompt."""
    __tablename__ = "prompt_votes"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="CASCADE"), primary_key=True)
    value = Column(Integer, nullable=False)  # 1 or -1
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CommentVote(Base):
    """User vote on a comment: value 1 (up) or -1 (down). One vote per user per comment."""
    __tablename__ = "comment_votes"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), primary_key=True)
    value = Column(Integer, nullable=False)  # 1 or -1
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
