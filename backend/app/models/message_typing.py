from sqlalchemy import Column, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID

from .base import Base


class MessageTyping(Base):
    """Tracks when a user is typing in a conversation (other_user_id = the conversation partner)."""
    __tablename__ = "message_typing"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    other_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
