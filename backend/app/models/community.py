import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class CommunityVisibility(str, enum.Enum):
    public = "public"
    restricted = "restricted"


class Community(Base, TimestampMixin):
    __tablename__ = "communities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    rules = Column(Text, nullable=True)
    visibility = Column(
        Enum(CommunityVisibility, name="communityvisibility"),
        default=CommunityVisibility.public,
        nullable=False,
    )
    avatar_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)
    announcement = Column(Text, nullable=True)
    show_owner_badge = Column(String(10), nullable=True, server_default="true")
    # Relationships
    owner = relationship("User", back_populates="owned_communities", foreign_keys=[owner_id])
    prompts = relationship("Prompt", back_populates="community")
    join_requests = relationship("CommunityJoinRequest", back_populates="community", cascade="all, delete-orphan")
    members = relationship("CommunityMember", back_populates="community", cascade="all, delete-orphan")
    moderator_invites = relationship("ModeratorInvite", back_populates="community", cascade="all, delete-orphan")
    bans = relationship("CommunityBan", back_populates="community", cascade="all, delete-orphan")


class JoinRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class CommunityJoinRequest(Base):
    __tablename__ = "community_join_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | approved | rejected
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    community = relationship("Community", back_populates="join_requests")
    user = relationship("User", foreign_keys=[user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])


class CommunityMemberRole(str, enum.Enum):
    member = "member"
    moderator = "moderator"


class CommunityMember(Base):
    __tablename__ = "community_members"

    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String(20), nullable=False, default="member")  # member | moderator
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    community = relationship("Community", back_populates="members")
    user = relationship("User", back_populates="community_memberships")


class ModeratorInvite(Base):
    __tablename__ = "moderator_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invited_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | accepted | rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    community = relationship("Community", back_populates="moderator_invites")
    user = relationship("User", foreign_keys=[user_id])
    invited_by = relationship("User", foreign_keys=[invited_by_id])


class CommunityBan(Base):
    __tablename__ = "community_bans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    banned_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    community = relationship("Community", back_populates="bans")
    user = relationship("User", foreign_keys=[user_id])
    banned_by = relationship("User", foreign_keys=[banned_by_id])
