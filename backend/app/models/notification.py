import enum
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, Text, Boolean, DateTime, ForeignKey, Index, Enum as SAEnum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base


class NotificationType(str, enum.Enum):
    comment_mention = "comment_mention"
    comment_reply = "comment_reply"
    community_join_request = "community_join_request"
    community_join_approved = "community_join_approved"
    community_join_rejected = "community_join_rejected"
    moderator_invite = "moderator_invite"
    community_banned = "community_banned"
    prompt_upvote = "prompt_upvote"
    prompt_downvote = "prompt_downvote"
    message_received = "message_received"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    notification_type = Column(
        SAEnum(NotificationType, name="notificationtype", create_constraint=False),
        nullable=False,
    )
    entity_type = Column(String(32), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id], back_populates="notifications", lazy="raise")
    actor = relationship("User", foreign_keys=[actor_id], lazy="raise")

    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at", postgresql_ops={"created_at": "DESC"}),
        Index("ix_notifications_user_read_created", "user_id", "is_read", "created_at", postgresql_ops={"created_at": "DESC"}),
    )
