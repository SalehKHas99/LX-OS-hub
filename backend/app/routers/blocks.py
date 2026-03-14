from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.friendship import UserBlock
from app.models.user import User
from app.schemas.friends import BlockedUserOut

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.get("", response_model=list[BlockedUserOut])
async def list_blocked(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users you have blocked."""
    r = await db.execute(
        select(UserBlock, User)
        .join(User, User.id == UserBlock.blocked_id)
        .where(UserBlock.blocker_id == current_user.id)
    )
    rows = r.all()
    return [
        BlockedUserOut(user_id=u.id, username=u.username, blocked_at=b.created_at)
        for b, u in rows
    ]


@router.post("/{user_id}", status_code=204)
async def block_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Block a user. They cannot message you or see you in lists."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    other = await db.get(User, user_id)
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    db.add(UserBlock(blocker_id=current_user.id, blocked_id=user_id))
    await db.commit()


@router.delete("/{user_id}", status_code=204)
async def unblock_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unblock a user."""
    await db.execute(
        delete(UserBlock).where(
            UserBlock.blocker_id == current_user.id,
            UserBlock.blocked_id == user_id,
        )
    )
    await db.commit()
