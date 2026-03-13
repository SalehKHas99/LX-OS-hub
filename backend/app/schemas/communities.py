from pydantic import BaseModel, field_validator
from typing import Optional, Any
from uuid import UUID
from datetime import datetime


# ── Join requests & membership ────────────────────────────────────────────────


class JoinRequestOut(BaseModel):
    id: UUID
    user_id: UUID
    username: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    user_id: UUID
    username: str
    role: str  # "member" | "moderator"
    joined_at: datetime

    model_config = {"from_attributes": True}


class MemberRoleUpdate(BaseModel):
    role: str  # "member" | "moderator"


class ModeratorInviteCreate(BaseModel):
    user_id: UUID


class ModeratorInviteOut(BaseModel):
    id: UUID
    community_id: UUID
    community_slug: str
    community_title: str
    invited_by_username: str
    status: str
    created_at: datetime


class MembershipStatusOut(BaseModel):
    status: str  # "none" | "pending" | "member" | "moderator" | "banned"
    role: Optional[str] = None

    model_config = {"from_attributes": True}


class BanCreate(BaseModel):
    user_id: UUID
    reason: Optional[str] = None


class BanOut(BaseModel):
    user_id: UUID
    username: str
    banned_by_username: str
    reason: Optional[str] = None
    created_at: datetime


class CommunityCreate(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None
    rules: Optional[str] = None
    visibility: str = "public"  # "public" | "restricted"

    @field_validator("slug")
    @classmethod
    def slug_valid(cls, v: str) -> str:
        import re
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug may only contain lowercase letters, numbers, and hyphens")
        if len(v) < 2 or len(v) > 50:
            raise ValueError("Slug must be 2–50 characters")
        return v


RULES_MAX_LENGTH = 2000


class CommunityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[str] = None
    announcement: Optional[str] = None
    show_owner_badge: Optional[bool] = None

    @field_validator("rules")
    @classmethod
    def rules_max_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > RULES_MAX_LENGTH:
            raise ValueError(f"Rules must be at most {RULES_MAX_LENGTH} characters")
        return v


class CommunityOut(BaseModel):
    id: UUID
    slug: str
    title: str
    description: Optional[str] = None
    rules: Optional[str] = None
    visibility: str
    owner_id: Optional[UUID] = None
    owner_username: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    announcement: Optional[str] = None
    show_owner_badge: bool = True
    member_count: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("show_owner_badge", mode="before")
    @classmethod
    def coerce_show_owner_badge(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() == "true"
        return True

    @classmethod
    def from_community(cls, community, member_count: Optional[int] = None, owner_username: Optional[str] = None):
        """Build CommunityOut from Community model with optional member_count and owner_username."""
        show = getattr(community, "show_owner_badge", None)
        show_bool = show is None or str(show).lower() == "true"
        if owner_username is None and hasattr(community, "owner") and community.owner is not None:
            owner_username = getattr(community.owner, "username", None)
        return cls(
            id=community.id,
            slug=community.slug,
            title=community.title,
            description=community.description,
            rules=community.rules,
            visibility=community.visibility.value if hasattr(community.visibility, "value") else community.visibility,
            owner_id=community.owner_id,
            owner_username=owner_username,
            avatar_url=community.avatar_url,
            banner_url=getattr(community, "banner_url", None),
            announcement=getattr(community, "announcement", None),
            show_owner_badge=show_bool,
            member_count=member_count,
            created_at=community.created_at,
        )
