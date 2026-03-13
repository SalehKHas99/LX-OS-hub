import enum
import uuid

from sqlalchemy import Boolean, Column, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    user = "user"
    moderator = "moderator"
    admin = "admin"
    super_admin = "super_admin"


class ProfileVisibility(str, enum.Enum):
    public = "public"
    private = "private"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # nullable for OAuth users
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    role = Column(Enum(UserRole, name="userrole"), default=UserRole.user, nullable=False)
    profile_visibility = Column(
        Enum(ProfileVisibility, name="profilevisibility"),
        default=ProfileVisibility.public,
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)

    # OAuth support (optional — leave null for email/password users)
    oauth_provider = Column(String(50), nullable=True)       # e.g. "google"
    oauth_provider_id = Column(String(255), nullable=True)   # provider's user ID

    # Relationships
    prompts = relationship(
        "Prompt", back_populates="creator", foreign_keys="Prompt.creator_id"
    )
    comments = relationship("Comment", back_populates="user")
    collections = relationship("Collection", back_populates="owner")
    reports = relationship("Report", back_populates="reporter", foreign_keys="Report.reporter_id")
    bans = relationship("UserBan", back_populates="user", foreign_keys="UserBan.user_id")
    owned_communities = relationship("Community", back_populates="owner", foreign_keys="Community.owner_id")
    community_memberships = relationship("CommunityMember", back_populates="user")
    notifications = relationship("Notification", back_populates="user", foreign_keys="Notification.user_id")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.recipient_id", back_populates="recipient")
