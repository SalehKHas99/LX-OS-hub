from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import joinedload
from typing import List
from uuid import UUID
from pydantic import BaseModel

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.notification import Notification
from app.models.community import Community
from app.models.comment import Comment
from app.schemas.notifications import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Single query with LEFT JOIN to users (actor): uses ix_notifications_user_created
    stmt = (
        select(Notification)
        .options(joinedload(Notification.actor))
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))

    result = await db.execute(stmt)
    rows = result.unique().scalars().all()

    # Resolve community slugs for clickable links (entity_type=community -> /c/{slug})
    community_ids = [n.entity_id for n in rows if n.entity_type == "community"]
    slug_map: dict[UUID, str] = {}
    if community_ids:
        res = await db.execute(
            select(Community.id, Community.slug).where(Community.id.in_(community_ids))
        )
        for (cid, slug) in res.all():
            slug_map[cid] = slug

    # Resolve prompt_id for comment entities (entity_type=comment -> link to /prompt/{prompt_id}#comment-{id})
    comment_ids = [n.entity_id for n in rows if n.entity_type == "comment"]
    comment_prompt_map: dict[UUID, UUID] = {}
    if comment_ids:
        res = await db.execute(
            select(Comment.id, Comment.prompt_id).where(Comment.id.in_(comment_ids))
        )
        for (cid, pid) in res.all():
            comment_prompt_map[cid] = pid

    return [
        NotificationOut(
            id=n.id,
            notification_type=n.notification_type.value,
            entity_type=n.entity_type,
            entity_id=n.entity_id,
            entity_slug=slug_map.get(n.entity_id),
            prompt_id=comment_prompt_map.get(n.entity_id) if n.entity_type == "comment" else None,
            message=n.message,
            is_read=n.is_read,
            created_at=n.created_at,
            actor_username=n.actor.username if n.actor else None,
        )
        for n in rows
    ]


class MarkReadPayload(BaseModel):
    ids: List[UUID]


@router.post("/mark-read", status_code=204)
async def mark_read(
    payload: MarkReadPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.ids:
        return
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.id.in_(payload.ids))
        .values(is_read=True)
    )
    await db.commit()


@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a notification (own only)."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.execute(delete(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id))
    await db.commit()

