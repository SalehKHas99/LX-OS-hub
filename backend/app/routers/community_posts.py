from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone

from app.database.session import get_db
from app.auth.dependencies import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.community import Community, CommunityMember, CommunityVisibility, CommunityBan

router = APIRouter(prefix="/communities", tags=["community-posts"])


async def _is_banned(community_id, user_id, db: AsyncSession) -> bool:
    result = await db.execute(
        select(CommunityBan).where(
            CommunityBan.community_id == community_id,
            CommunityBan.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None

# In-memory store for wall posts (replace with DB table in production)
# Structure: { slug: [ {id, content, author, created_at} ] }
_wall: dict = {}


class PostIn(BaseModel):
    content: str


def _is_mod_or_owner(community: Community, user: User, member: CommunityMember | None) -> bool:
    if community.owner_id == user.id:
        return True
    return member is not None and member.role == "moderator"


@router.get("/{slug}/posts")
async def list_posts(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """List wall posts. For restricted communities, only accepted members (or mod/owner) can view."""
    _ = await db.execute(select(Community).where(Community.slug == slug))
    community = _.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    if current_user and await _is_banned(community.id, current_user.id, db):
        raise HTTPException(
            status_code=403,
            detail="You are banned from this community and cannot view or post.",
        )

    if community.visibility == CommunityVisibility.restricted:
        if not current_user:
            raise HTTPException(
                status_code=403,
                detail="Join this community to view posts. Sign in and request to join.",
            )
        member_result = await db.execute(
            select(CommunityMember).where(
                CommunityMember.community_id == community.id,
                CommunityMember.user_id == current_user.id,
            )
        )
        member = member_result.scalar_one_or_none()
        if not _is_mod_or_owner(community, current_user, member) and not member:
            raise HTTPException(
                status_code=403,
                detail="Join this community to view posts. Request to join and wait for approval.",
            )

    posts = _wall.get(slug, [])
    return {"items": list(reversed(posts)), "total": len(posts)}


@router.post("/{slug}/posts", status_code=201)
async def create_post(
    slug: str,
    body: PostIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a wall post. Requires authentication and approved membership."""
    result = await db.execute(select(Community).where(Community.slug == slug))
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    if await _is_banned(community.id, current_user.id, db):
        raise HTTPException(
            status_code=403,
            detail="You are banned from this community and cannot post.",
        )
    member = await db.execute(
        select(CommunityMember).where(
            CommunityMember.community_id == community.id,
            CommunityMember.user_id == current_user.id,
        )
    )
    if not member.scalar_one_or_none():
        raise HTTPException(
            status_code=403,
            detail="You must be an approved member to post. Request to join and wait for approval.",
        )

    if not body.content.strip():
        raise HTTPException(status_code=422, detail="Content cannot be empty")

    post = {
        "id": str(uuid.uuid4()),
        "content": body.content.strip(),
        "author": {
            "id": str(current_user.id),
            "username": current_user.username,
            "avatar_url": getattr(current_user, "avatar_url", None),
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _wall.setdefault(slug, []).append(post)
    return post
