import enum
import uuid

from sqlalchemy import Column, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class ModerationState(str, enum.Enum):
    visible = "visible"
    flagged = "flagged"
    hidden = "hidden"
    removed = "removed"


class Comment(Base, TimestampMixin):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompts.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    parent_comment_id = Column(
        UUID(as_uuid=True), ForeignKey("comments.id"), nullable=True
    )
    content = Column(Text, nullable=False)
    moderation_state = Column(
        Enum(ModerationState, name="moderationstate"),
        default=ModerationState.visible,
        nullable=False,
    )

    prompt = relationship("Prompt", back_populates="comments")
    user = relationship("User", back_populates="comments")
    replies = relationship("Comment", foreign_keys=[parent_comment_id])
