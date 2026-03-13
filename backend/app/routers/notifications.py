from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import joinedload
from typing import List
from uuid import UUID
from pydantic import BaseModel

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.notification import Notification
from app.models.community import Community
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

    return [
        NotificationOut(
            id=n.id,
            notification_type=n.notification_type.value,
            entity_type=n.entity_type,
            entity_id=n.entity_id,
            entity_slug=slug_map.get(n.entity_id),
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

