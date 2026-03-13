from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.message import Message
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.messages import MessageCreate, MessageOut, ConversationSummary

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all conversations (other users I've messaged or who messaged me), with last message and unread count."""
    # Subquery: last message per conversation (per other user)
    # "Other user" = recipient when I'm sender, sender when I'm recipient
    sent = select(
        Message.recipient_id.label("other_id"),
        Message.content,
        Message.created_at,
        Message.read_at,
    ).where(Message.sender_id == current_user.id)
    received = select(
        Message.sender_id.label("other_id"),
        Message.content,
        Message.created_at,
        Message.read_at,
    ).where(Message.recipient_id == current_user.id)
    # Union and order by created_at desc to get latest per conversation
    union = sent.union_all(received).subquery()
    # Get distinct other_id with max(created_at) to find last message
    last_per_other = (
        select(
            union.c.other_id,
            func.max(union.c.created_at).label("last_at"),
        )
        .group_by(union.c.other_id)
    ).subquery()

    # For each other_id, get the content of the last message (we'll do a second query for simplicity)
    # Simpler: get all my messages (sent + received), group in Python by other user, compute last + unread
    sent_msgs = await db.execute(
        select(Message)
        .where(Message.sender_id == current_user.id)
        .order_by(Message.created_at.desc())
    )
    sent_list = sent_msgs.scalars().all()
    recv_msgs = await db.execute(
        select(Message)
        .where(Message.recipient_id == current_user.id)
        .order_by(Message.created_at.desc())
    )
    recv_list = recv_msgs.scalars().all()

    # Build set of other user ids and collect last message + unread per other
    other_ids: set[UUID] = set()
    for m in sent_list:
        other_ids.add(m.recipient_id)
    for m in recv_list:
        other_ids.add(m.sender_id)

    if not other_ids:
        return []

    # Load usernames for other users
    users_result = await db.execute(select(User).where(User.id.in_(other_ids)))
    users = {u.id: u for u in users_result.scalars().all()}

    # For each other user: last message (by created_at), unread = count of received messages with read_at null
    unread_result = await db.execute(
        select(Message.sender_id, func.count().label("cnt"))
        .where(
            Message.recipient_id == current_user.id,
            Message.read_at.is_(None),
        )
        .group_by(Message.sender_id)
    )
    unread_map = {row[0]: row[1] for row in unread_result.all()}

    # Combine all messages and sort by created_at to get last message per conversation
    all_msgs: list[Message] = []
    for m in sent_list:
        all_msgs.append(m)
    for m in recv_list:
        all_msgs.append(m)
    all_msgs.sort(key=lambda x: x.created_at, reverse=True)

    # Per other_id, keep only the most recent message for preview and last_at
    last_preview: dict[UUID, tuple[str, datetime]] = {}
    for m in all_msgs:
        other = m.recipient_id if m.sender_id == current_user.id else m.sender_id
        if other not in last_preview:
            preview = m.content[:80] + ("..." if len(m.content) > 80 else "")
            last_preview[other] = (preview, m.created_at)

    result = []
    for other_id in other_ids:
        user = users.get(other_id)
        username = user.username if user else "?"
        preview, last_at = last_preview.get(other_id, (None, None))
        unread = unread_map.get(other_id, 0)
        result.append(
            ConversationSummary(
                other_user_id=other_id,
                other_username=username,
                last_message_preview=preview,
                last_at=last_at,
                unread_count=unread,
            )
        )

    # Sort by last_at desc
    result.sort(key=lambda c: c.last_at or datetime.min(timezone.utc), reverse=True)
    return result[:limit]


@router.get("/with/{user_id}", response_model=list[MessageOut])
async def get_messages_with(
    user_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    before: datetime | None = Query(None, description="Cursor: return messages before this time"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get messages between current user and the given user (paginated)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    stmt = (
        select(Message)
        .options(
            selectinload(Message.sender),
            selectinload(Message.recipient),
        )
        .where(
            or_(
                and_(Message.sender_id == current_user.id, Message.recipient_id == user_id),
                and_(Message.sender_id == user_id, Message.recipient_id == current_user.id),
            )
        )
        .order_by(Message.created_at.desc())
        .limit(limit + 1)
    )
    if before:
        stmt = stmt.where(Message.created_at < before)
    result = await db.execute(stmt)
    messages = result.unique().scalars().all()
    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]
    # Oldest first for display
    messages.reverse()
    return [
        MessageOut(
            id=m.id,
            sender_id=m.sender_id,
            recipient_id=m.recipient_id,
            sender_username=m.sender.username if m.sender else None,
            content=m.content,
            created_at=m.created_at,
            read_at=m.read_at,
            is_from_me=(m.sender_id == current_user.id),
        )
        for m in messages
    ]


@router.post("", response_model=MessageOut, status_code=201)
async def send_message(
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a direct message to another user."""
    if payload.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    recipient = await db.get(User, payload.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    if not recipient.is_active:
        raise HTTPException(status_code=400, detail="Cannot message this user")
    msg = Message(
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        content=payload.content.strip(),
    )
    db.add(msg)
    db.add(
        Notification(
            user_id=payload.recipient_id,
            actor_id=current_user.id,
            notification_type=NotificationType.message_received,
            entity_type="message_thread",
            entity_id=current_user.id,
            message=f"{current_user.username} sent you a message",
        )
    )
    await db.commit()
    await db.refresh(msg)
    await db.refresh(msg, ["sender", "recipient"])
    return MessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        recipient_id=msg.recipient_id,
        sender_username=current_user.username,
        content=msg.content,
        created_at=msg.created_at,
        read_at=msg.read_at,
        is_from_me=True,
    )


@router.post("/mark-read", status_code=204)
async def mark_conversation_read(
    user_id: UUID = Query(..., description="Mark all messages from this user as read"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all messages from the given user (in the conversation with me) as read."""
    await db.execute(
        update(Message)
        .where(
            Message.recipient_id == current_user.id,
            Message.sender_id == user_id,
            Message.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
