from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID

from .base import Base


class Friendship(Base):
    """Friend request: requester sends to addressee. status=pending until addressee accepts."""
    __tablename__ = "friendships"

    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    addressee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")  # pending | accepted
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserBlock(Base):
    """blocker_id has blocked blocked_id (blocker cannot see blocked; blocked cannot message blocker)."""
    __tablename__ = "user_blocks"

    blocker_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    blocked_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ConversationAcceptance(Base):
    """user_id has accepted the conversation with other_user_id (moves from "requests" to inbox)."""
    __tablename__ = "conversation_acceptance"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    other_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    accepted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
