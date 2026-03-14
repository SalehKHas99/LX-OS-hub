from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, delete, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.friendship import Friendship
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.friends import FriendOut, FriendRequestIn

router = APIRouter(prefix="/friends", tags=["friends"])


@router.get("", response_model=list[FriendOut])
async def list_friends(
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users you are friends with (accepted both ways)."""
    # Accepted: (requester=me, addressee=other) or (requester=other, addressee=me)
    r = await db.execute(
        select(Friendship)
        .where(Friendship.status == "accepted")
        .where(or_(
            Friendship.requester_id == current_user.id,
            Friendship.addressee_id == current_user.id,
        ))
    )
    rows = r.scalars().all()[:limit]
    friend_ids: list[tuple[UUID, datetime]] = []
    for f in rows:
        uid = f.addressee_id if f.requester_id == current_user.id else f.requester_id
        friend_ids.append((uid, f.created_at))
    if not friend_ids:
        return []
    other_ids = {uid for uid, _ in friend_ids}
    users_r = await db.execute(select(User).where(User.id.in_(other_ids)))
    users = {u.id: u for u in users_r.scalars().all()}
    return [
        FriendOut(
            user_id=uid,
            username=users[uid].username,
            status="accepted",
            created_at=created_at,
        )
        for uid, created_at in friend_ids
    ]


@router.get("/requests", response_model=list[FriendOut])
async def list_friend_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Incoming friend requests (someone requested you, pending)."""
    r = await db.execute(
        select(Friendship)
        .where(Friendship.addressee_id == current_user.id, Friendship.status == "pending")
    )
    rows = r.scalars().all()
    if not rows:
        return []
    requester_ids = [f.requester_id for f in rows]
    users_r = await db.execute(select(User).where(User.id.in_(requester_ids)))
    users = {u.id: u for u in users_r.scalars().all()}
    return [
        FriendOut(
            user_id=f.requester_id,
            username=users[f.requester_id].username,
            status="pending",
            created_at=f.created_at,
        )
        for f in rows
    ]


@router.get("/status/{user_id}")
async def get_friend_status(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get relationship with user: none, pending_sent, pending_received, friends."""
    if user_id == current_user.id:
        return {"status": "none"}
    r = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == current_user.id, Friendship.addressee_id == user_id),
                and_(Friendship.requester_id == user_id, Friendship.addressee_id == current_user.id),
            )
        )
    )
    row = r.scalar_one_or_none()
    if not row:
        return {"status": "none"}
    if row.status == "accepted":
        return {"status": "friends"}
    if row.requester_id == current_user.id:
        return {"status": "pending_sent"}
    return {"status": "pending_received"}


@router.post("/request", status_code=201)
async def send_friend_request(
    payload: FriendRequestIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a friend request to addressee."""
    if payload.addressee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    other = await db.get(User, payload.addressee_id)
    if not other or not other.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    r = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == current_user.id, Friendship.addressee_id == payload.addressee_id),
                and_(Friendship.requester_id == payload.addressee_id, Friendship.addressee_id == current_user.id),
            )
        )
    )
    existing = r.scalar_one_or_none()
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends")
        if existing.requester_id == current_user.id:
            raise HTTPException(status_code=400, detail="Request already sent")
        # They requested me; accept it
        existing.status = "accepted"
        await db.commit()
        return {"status": "accepted", "message": "You are now friends"}
    db.add(Friendship(requester_id=current_user.id, addressee_id=payload.addressee_id, status="pending"))
    db.add(
        Notification(
            user_id=payload.addressee_id,
            actor_id=current_user.id,
            notification_type=NotificationType.friend_request,
            entity_type="user",
            entity_id=current_user.id,
            message=f"{current_user.username} sent you a friend request",
        )
    )
    await db.commit()
    return {"status": "pending", "message": "Friend request sent"}


@router.post("/accept/{user_id}", status_code=204)
async def accept_friend_request(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept an incoming friend request."""
    r = await db.execute(
        select(Friendship).where(
            Friendship.requester_id == user_id,
            Friendship.addressee_id == current_user.id,
            Friendship.status == "pending",
        )
    )
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    row.status = "accepted"
    await db.commit()


@router.post("/decline/{user_id}", status_code=204)
async def decline_friend_request(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Decline an incoming friend request."""
    await db.execute(
        delete(Friendship).where(
            Friendship.requester_id == user_id,
            Friendship.addressee_id == current_user.id,
            Friendship.status == "pending",
        )
    )
    await db.commit()


@router.delete("/{user_id}", status_code=204)
async def remove_friend(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a friend (unfriend)."""
    await db.execute(
        delete(Friendship).where(
            or_(
                and_(Friendship.requester_id == current_user.id, Friendship.addressee_id == user_id),
                and_(Friendship.requester_id == user_id, Friendship.addressee_id == current_user.id),
            )
        )
    )
    await db.commit()
