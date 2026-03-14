from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, or_, and_, func, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.friendship import ConversationAcceptance, UserBlock
from app.models.message import Message
from app.models.message_typing import MessageTyping
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.messages import (
    MessageCreate,
    MessageUpdate,
    MessageOut,
    MessagesWithResponse,
    ConversationSummary,
    TypingResponse,
)

router = APIRouter(prefix="/messages", tags=["messages"])

# Limit conversation list to last N messages per direction for fast list_conversations
_CONVERSATION_LOAD_LIMIT = 150
# Typing considered active for this many seconds
TYPING_EXPIRY_SECONDS = 8


async def _accepted_other_ids(session: AsyncSession, user_id: UUID) -> set[UUID]:
    """Set of other_user_id where user_id has accepted the conversation."""
    r = await session.execute(
        select(ConversationAcceptance.other_user_id).where(ConversationAcceptance.user_id == user_id)
    )
    return set(r.scalars().all())


async def _is_blocked(session: AsyncSession, user_a: UUID, user_b: UUID) -> bool:
    """True if either has blocked the other."""
    r = await session.execute(
        select(UserBlock).where(
            or_(
                and_(UserBlock.blocker_id == user_a, UserBlock.blocked_id == user_b),
                and_(UserBlock.blocker_id == user_b, UserBlock.blocked_id == user_a),
            )
        )
    )
    return r.scalar_one_or_none() is not None


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return total number of unread messages for the current user (e.g. for nav badge)."""
    result = await db.execute(
        select(func.count()).select_from(Message).where(
            Message.recipient_id == current_user.id,
            Message.read_at.is_(None),
        )
    )
    return {"count": result.scalar_one() or 0}


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List inbox: conversations you have accepted (or started), with last message and unread count."""
    accepted = await _accepted_other_ids(db, current_user.id)
    if not accepted:
        return []
    # Load only recent messages per direction (index-friendly)
    sent_msgs = await db.execute(
        select(Message)
        .where(Message.sender_id == current_user.id)
        .order_by(Message.created_at.desc())
        .limit(_CONVERSATION_LOAD_LIMIT)
    )
    sent_list = sent_msgs.scalars().all()
    recv_msgs = await db.execute(
        select(Message)
        .where(Message.recipient_id == current_user.id)
        .order_by(Message.created_at.desc())
        .limit(_CONVERSATION_LOAD_LIMIT)
    )
    recv_list = recv_msgs.scalars().all()

    # Only show conversations we've accepted
    all_others: set[UUID] = set()
    for m in sent_list:
        all_others.add(m.recipient_id)
    for m in recv_list:
        all_others.add(m.sender_id)
    other_ids = accepted & all_others

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


@router.get("/requests", response_model=list[ConversationSummary])
async def list_message_requests(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Message requests: people who messaged you and you haven't accepted yet."""
    accepted = await _accepted_other_ids(db, current_user.id)
    recv_msgs = await db.execute(
        select(Message)
        .where(Message.recipient_id == current_user.id)
        .order_by(Message.created_at.desc())
        .limit(_CONVERSATION_LOAD_LIMIT)
    )
    recv_list = recv_msgs.scalars().all()
    # Other = sender; only those I haven't accepted
    request_other_ids = {m.sender_id for m in recv_list} - accepted
    if not request_other_ids:
        return []
    users_result = await db.execute(select(User).where(User.id.in_(request_other_ids)))
    users = {u.id: u for u in users_result.scalars().all()}
    unread_result = await db.execute(
        select(Message.sender_id, func.count().label("cnt")).where(
            Message.recipient_id == current_user.id,
            Message.read_at.is_(None),
        ).group_by(Message.sender_id)
    )
    unread_map = {row[0]: row[1] for row in unread_result.all()}
    last_preview: dict[UUID, tuple[str, datetime]] = {}
    for m in recv_list:
        if m.sender_id not in request_other_ids:
            continue
        if m.sender_id not in last_preview:
            preview = m.content[:80] + ("..." if len(m.content) > 80 else "")
            last_preview[m.sender_id] = (preview, m.created_at)
    result = []
    for other_id in request_other_ids:
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
    result.sort(key=lambda c: c.last_at or datetime.min(timezone.utc), reverse=True)
    return result[:limit]


@router.get("/requests/count")
async def get_message_requests_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Count of message requests (for badge)."""
    accepted = await _accepted_other_ids(db, current_user.id)
    r = await db.execute(
        select(Message.sender_id)
        .where(Message.recipient_id == current_user.id)
        .distinct()
    )
    senders = {row[0] for row in r.all()}
    count = len(senders - accepted)
    return {"count": max(0, count)}


@router.post("/requests/accept/{user_id}", status_code=204)
async def accept_message_request(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a message request; conversation moves to inbox."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Invalid")
    now = datetime.now(timezone.utc)
    stmt = pg_insert(ConversationAcceptance.__table__).values(
        user_id=current_user.id,
        other_user_id=user_id,
        accepted_at=now,
    ).on_conflict_do_nothing(index_elements=["user_id", "other_user_id"])
    await db.execute(stmt)
    await db.commit()


def _message_to_out(m: Message, current_user_id: UUID) -> MessageOut:
    return MessageOut(
        id=m.id,
        sender_id=m.sender_id,
        recipient_id=m.recipient_id,
        sender_username=m.sender.username if m.sender else None,
        content=m.content,
        created_at=m.created_at,
        read_at=m.read_at,
        is_from_me=(m.sender_id == current_user_id),
    )


@router.get("/with/{user_id}", response_model=MessagesWithResponse)
async def get_messages_with(
    user_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    before: datetime | None = Query(None, description="Cursor: return messages before this time"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get messages between current user and the given user (paginated). Cursor: use next_before for loading more."""
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
    next_before = messages[0].created_at if messages and has_more else None
    other = await db.get(User, user_id)
    other_username = other.username if other else None
    return MessagesWithResponse(
        messages=[_message_to_out(m, current_user.id) for m in messages],
        has_more=has_more,
        next_before=next_before,
        other_user_id=user_id,
        other_username=other_username,
    )


@router.get("/with/{user_id}/new", response_model=list[MessageOut])
async def get_new_messages(
    user_id: UUID,
    since: datetime = Query(..., description="ISO datetime; return messages created after this"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lightweight poll: return only new messages in this conversation since `since`. Use for near-instant updates."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    stmt = (
        select(Message)
        .options(selectinload(Message.sender), selectinload(Message.recipient))
        .where(
            Message.created_at > since,
            or_(
                and_(Message.sender_id == current_user.id, Message.recipient_id == user_id),
                and_(Message.sender_id == user_id, Message.recipient_id == current_user.id),
            ),
        )
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    messages = result.unique().scalars().all()
    return [_message_to_out(m, current_user.id) for m in messages]


@router.post("/typing", status_code=204)
async def set_typing(
    other_user_id: UUID = Query(..., description="The user you are typing to"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Call when the current user is typing in a conversation. Expires after a few seconds if not refreshed."""
    if other_user_id == current_user.id:
        return
    now = datetime.now(timezone.utc)
    stmt = pg_insert(MessageTyping.__table__).values(
        user_id=current_user.id,
        other_user_id=other_user_id,
        updated_at=now,
    ).on_conflict_do_update(
        index_elements=["user_id", "other_user_id"],
        set_={"updated_at": now},
    )
    await db.execute(stmt)
    await db.commit()


@router.get("/with/{user_id}/typing", response_model=TypingResponse)
async def get_typing_status(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns whether the other user (user_id) is currently typing in this conversation."""
    if user_id == current_user.id:
        return TypingResponse(typing=False)
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=TYPING_EXPIRY_SECONDS)
    r = await db.execute(
        select(MessageTyping).where(
            MessageTyping.user_id == user_id,
            MessageTyping.other_user_id == current_user.id,
            MessageTyping.updated_at >= cutoff,
        )
    )
    row = r.scalar_one_or_none()
    return TypingResponse(typing=row is not None)


@router.post("", response_model=MessageOut, status_code=201)
async def send_message(
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a direct message to another user. Blocked users cannot message each other."""
    if payload.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    if await _is_blocked(db, current_user.id, payload.recipient_id):
        raise HTTPException(status_code=403, detail="Cannot message this user")
    recipient = await db.get(User, payload.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    if not recipient.is_active:
        raise HTTPException(status_code=400, detail="Cannot message this user")
    # Whether recipient has already accepted conversation with us (for notification type)
    r = await db.execute(
        select(ConversationAcceptance).where(
            ConversationAcceptance.user_id == payload.recipient_id,
            ConversationAcceptance.other_user_id == current_user.id,
        )
    )
    recipient_accepted = r.scalar_one_or_none() is not None
    notif_type = NotificationType.message_received if recipient_accepted else NotificationType.message_request
    # Sender accepts conversation with recipient
    now = datetime.now(timezone.utc)
    await db.execute(
        pg_insert(ConversationAcceptance.__table__).values(
            user_id=current_user.id,
            other_user_id=payload.recipient_id,
            accepted_at=now,
        ).on_conflict_do_nothing(index_elements=["user_id", "other_user_id"])
    )
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
            notification_type=notif_type,
            entity_type="message_thread",
            entity_id=current_user.id,
            message=f"{current_user.username} sent you a message",
        )
    )
    await db.commit()
    await db.refresh(msg)
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


@router.patch("/{message_id}", response_model=MessageOut)
async def update_message(
    message_id: UUID,
    payload: MessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit a message (sender only)."""
    result = await db.execute(
        select(Message).options(selectinload(Message.sender)).where(Message.id == message_id)
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your message")
    msg.content = payload.content.strip()
    await db.commit()
    await db.refresh(msg)
    return _message_to_out(msg, current_user.id)


@router.delete("/{message_id}", status_code=204)
async def delete_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a message (sender only)."""
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your message")
    await db.execute(delete(Message).where(Message.id == message_id))
    await db.commit()


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
