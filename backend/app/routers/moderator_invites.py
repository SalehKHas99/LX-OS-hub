"""Moderator invite accept/reject. Invites are created in communities router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.community import Community, CommunityMember, ModeratorInvite
from app.schemas.communities import ModeratorInviteOut

router = APIRouter(prefix="/moderator-invites", tags=["moderator-invites"])


@router.get("", response_model=list[ModeratorInviteOut])
async def list_my_invites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ModeratorInvite)
        .options(
            selectinload(ModeratorInvite.community),
            selectinload(ModeratorInvite.invited_by),
        )
        .where(
            ModeratorInvite.user_id == current_user.id,
            ModeratorInvite.status == "pending",
        )
    )
    invites = result.scalars().all()
    return [
        ModeratorInviteOut(
            id=inv.id,
            community_id=inv.community_id,
            community_slug=inv.community.slug,
            community_title=inv.community.title,
            invited_by_username=inv.invited_by.username if inv.invited_by else "",
            status=inv.status,
            created_at=inv.created_at,
        )
        for inv in invites
    ]


@router.post("/{invite_id}/accept")
async def accept_invite(
    invite_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ModeratorInvite)
        .options(selectinload(ModeratorInvite.community))
        .where(
            ModeratorInvite.id == invite_id,
            ModeratorInvite.user_id == current_user.id,
            ModeratorInvite.status == "pending",
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found or already handled")
    existing = await db.execute(
        select(CommunityMember).where(
            CommunityMember.community_id == inv.community_id,
            CommunityMember.user_id == current_user.id,
        )
    )
    m = existing.scalar_one_or_none()
    if m:
        m.role = "moderator"
    else:
        db.add(
            CommunityMember(
                community_id=inv.community_id,
                user_id=current_user.id,
                role="moderator",
            )
        )
    inv.status = "accepted"
    await db.commit()
    return {"status": "accepted", "community_slug": inv.community.slug}


@router.post("/{invite_id}/reject")
async def reject_invite(
    invite_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ModeratorInvite).where(
            ModeratorInvite.id == invite_id,
            ModeratorInvite.user_id == current_user.id,
            ModeratorInvite.status == "pending",
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found or already handled")
    inv.status = "rejected"
    await db.commit()
    return {"status": "rejected"}
