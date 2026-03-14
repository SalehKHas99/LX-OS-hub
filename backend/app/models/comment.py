import enum
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, Text, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class ModerationState(str, enum.Enum):
    visible = "visible"
    flagged = "flagged"
    hidden = "hidden"
    removed = "removed"


class Comment(Base):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    vote_score = Column(Integer, nullable=False, default=0, server_default="0")  # net upvotes - downvotes
    moderation_state = Column(
        SAEnum(ModerationState, name="moderationstate", create_constraint=False),
        nullable=False,
        default=ModerationState.visible,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    prompt = relationship("Prompt", back_populates="comments")
    user = relationship("User", lazy="raise")
    replies = relationship("Comment", foreign_keys=[parent_comment_id], lazy="raise")
