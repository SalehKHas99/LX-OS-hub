from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID, uuid4

from app.database.session import get_db
from app.auth.dependencies import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.prompt import Prompt, PromptContextBlock, PromptStatus, ModelFamily, ContextSource
from app.models.tag import Tag, PromptTag
from app.models.comment import Comment, ModerationState
from app.models.notification import Notification, NotificationType
from app.models.vote import PromptVote, CommentVote
from app.models.saved_prompt import SavedPrompt
from app.models.collection import CollectionItem
from app.models.community import Community, CommunityMember, CommunityVisibility
from app.schemas.prompts import PromptCreate, PromptUpdate, PromptCard, PromptDetail
from app.schemas.comments import CommentCreate, CommentUpdate, CommentOut, VoteIn
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/prompts", tags=["prompts"])


def _prompt_load_options():
    return [
        selectinload(Prompt.creator),
        selectinload(Prompt.prompt_tags).selectinload(PromptTag.tag),
        selectinload(Prompt.images),
        selectinload(Prompt.context_blocks),
    ]


async def _get_prompt_or_404(prompt_id: UUID, db: AsyncSession) -> Prompt:
    result = await db.execute(
        select(Prompt)
        .options(*_prompt_load_options())
        .where(Prompt.id == prompt_id, Prompt.status == PromptStatus.published)
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


def _build_prompt_card(
    p: Prompt,
    current_user_vote: Optional[int] = None,
    is_saved: Optional[bool] = None,
) -> dict:
    out = {
        "id": p.id,
        "title": p.title,
        "model_family": p.model_family.value if p.model_family else None,
        "score": p.score,
        "creator": p.creator,
        "tags": [pt.tag for pt in p.prompt_tags],
        "images": p.images,
        "created_at": p.created_at,
        "current_user_vote": current_user_vote,
        "is_saved": is_saved,
    }
    return out


def _build_prompt_detail(
    p: Prompt,
    current_user_vote: Optional[int] = None,
    is_saved: Optional[bool] = None,
) -> dict:
    out = {
        **_build_prompt_card(p, current_user_vote, is_saved),
        "raw_prompt": p.raw_prompt,
        "negative_prompt": p.negative_prompt,
        "notes": p.notes,
        "status": p.status.value,
        "community_id": p.community_id,
        "remix_of_id": p.remix_of_id,
        "context_blocks": p.context_blocks,
        "updated_at": p.updated_at,
    }
    return out


# ── Feed ──────────────────────────────────────────────────────────────────────

@router.get("/feed", response_model=PaginatedResponse[PromptCard])
async def get_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    sort: str = Query("trending", pattern="^(trending|recent|top)$"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    offset = (page - 1) * page_size
    q = (
        select(Prompt)
        .options(*_prompt_load_options())
        .where(
            Prompt.status == PromptStatus.published,
            Prompt.share_to_feed.is_(True),
        )
    )
    if sort == "trending" or sort == "top":
        q = q.order_by(Prompt.score.desc(), Prompt.created_at.desc())
    else:
        q = q.order_by(Prompt.created_at.desc())

    count_result = await db.execute(
        select(func.count()).select_from(Prompt).where(
            Prompt.status == PromptStatus.published,
            Prompt.share_to_feed.is_(True),
        )
    )
    total = count_result.scalar_one()

    result = await db.execute(q.offset(offset).limit(page_size))
    prompts = result.scalars().all()

    vote_map: dict[UUID, int] = {}
    saved_set: set[UUID] = set()
    if current_user and prompts:
        vote_rows = await db.execute(
            select(PromptVote.prompt_id, PromptVote.value).where(
                PromptVote.user_id == current_user.id,
                PromptVote.prompt_id.in_([p.id for p in prompts]),
            )
        )
        for pid, val in vote_rows.all():
            vote_map[pid] = val
        saved_rows = await db.execute(
            select(SavedPrompt.prompt_id).where(
                SavedPrompt.user_id == current_user.id,
                SavedPrompt.prompt_id.in_([p.id for p in prompts]),
            )
        )
        saved_set = {row for (row,) in saved_rows.all()}

    return PaginatedResponse(
        items=[
            PromptCard.model_validate(_build_prompt_card(p, vote_map.get(p.id), p.id in saved_set if current_user else None))
            for p in prompts
        ],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(prompts)) < total,
    )


# ── Create prompt ─────────────────────────────────────────────────────────────

@router.post("", response_model=PromptDetail, status_code=201)
async def create_prompt(
    payload: PromptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    share_to_feed = payload.share_to_feed

    if payload.community_id:
        member = await db.execute(
            select(CommunityMember).where(
                CommunityMember.community_id == payload.community_id,
                CommunityMember.user_id == current_user.id,
            )
        )
        if not member.scalar_one_or_none():
            raise HTTPException(
                status_code=403,
                detail="You must be an approved member of this community to post prompts here.",
            )
        # Determine default sharing behavior based on community visibility
        community_result = await db.execute(
            select(Community).where(Community.id == payload.community_id)
        )
        community = community_result.scalar_one_or_none()
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")
        if share_to_feed is None:
            # Public communities default to being visible in feed/search,
            # restricted communities default to wall-only unless user opts in.
            share_to_feed = community.visibility != CommunityVisibility.restricted
    else:
        if share_to_feed is None:
            # Non-community prompts are always visible in feed/search.
            share_to_feed = True
    try:
        prompt = Prompt(
            id=uuid4(),
            title=payload.title,
            raw_prompt=payload.raw_prompt,
            creator_id=current_user.id,
            model_family=ModelFamily(payload.model_family) if payload.model_family else ModelFamily.other,
            negative_prompt=payload.negative_prompt,
            notes=payload.notes,
            community_id=payload.community_id,
            remix_of_id=payload.remix_of_id,
            status=PromptStatus.published,
            score=0,
            share_to_feed=share_to_feed,
        )
        db.add(prompt)
        await db.flush()

        # Context blocks (user-submitted => source_type=user)
        for cb in payload.context_blocks:
            db.add(PromptContextBlock(
                id=uuid4(),
                prompt_id=prompt.id,
                field_name=cb.field_name,
                field_value=cb.field_value,
                source_type=ContextSource.user,
                sort_order=cb.sort_order,
            ))

        # Tags
        for slug in payload.tag_slugs:
            tag_result = await db.execute(select(Tag).where(Tag.slug == slug))
            tag = tag_result.scalar_one_or_none()
            if not tag:
                tag = Tag(id=uuid4(), slug=slug, display_name=slug.replace("-", " ").title())
                db.add(tag)
                await db.flush()
            db.add(PromptTag(prompt_id=prompt.id, tag_id=tag.id))

        await db.commit()

        result = await db.execute(
            select(Prompt).options(*_prompt_load_options()).where(Prompt.id == prompt.id)
        )
        prompt = result.scalar_one()
        return PromptDetail.model_validate(_build_prompt_detail(prompt, None, False))
    except HTTPException:
        raise
    except Exception as e:
        # Surface the underlying error in development to make debugging easier.
        raise HTTPException(status_code=500, detail="Failed to create prompt") from None


# ── Get prompt detail ─────────────────────────────────────────────────────────

@router.get("/{prompt_id}", response_model=PromptDetail)
async def get_prompt(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    prompt = await _get_prompt_or_404(prompt_id, db)
    current_user_vote: Optional[int] = None
    is_saved: Optional[bool] = None
    if current_user:
        r = await db.execute(
            select(PromptVote.value).where(
                PromptVote.user_id == current_user.id,
                PromptVote.prompt_id == prompt_id,
            )
        )
        row = r.scalar_one_or_none()
        if row is not None:
            current_user_vote = row
        saved = await db.execute(
            select(SavedPrompt.prompt_id).where(
                SavedPrompt.user_id == current_user.id,
                SavedPrompt.prompt_id == prompt_id,
            )
        )
        is_saved = saved.scalar_one_or_none() is not None
    return PromptDetail.model_validate(_build_prompt_detail(prompt, current_user_vote, is_saved))


# ── Update prompt ─────────────────────────────────────────────────────────────

@router.patch("/{prompt_id}", response_model=PromptDetail)
async def update_prompt(
    prompt_id: UUID,
    payload: PromptUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = await _get_prompt_or_404(prompt_id, db)
    if prompt.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your prompt")

    if payload.title is not None:
        prompt.title = payload.title
    if payload.raw_prompt is not None:
        prompt.raw_prompt = payload.raw_prompt
    if payload.model_family is not None:
        prompt.model_family = ModelFamily(payload.model_family)
    if payload.negative_prompt is not None:
        prompt.negative_prompt = payload.negative_prompt
    if payload.notes is not None:
        prompt.notes = payload.notes

    if payload.context_blocks is not None:
        await db.execute(
            PromptContextBlock.__table__.delete().where(
                PromptContextBlock.prompt_id == prompt.id
            )
        )
        for cb in payload.context_blocks:
            db.add(PromptContextBlock(
                id=uuid4(),
                prompt_id=prompt.id,
                field_name=cb.field_name,
                field_value=cb.field_value,
                source_type=ContextSource.user,
                sort_order=cb.sort_order,
            ))

    await db.commit()
    result = await db.execute(
        select(Prompt).options(*_prompt_load_options()).where(Prompt.id == prompt.id)
    )
    prompt = result.scalar_one()
    r = await db.execute(
        select(PromptVote.value).where(
            PromptVote.user_id == current_user.id,
            PromptVote.prompt_id == prompt_id,
        )
    )
    current_user_vote = r.scalar_one_or_none()
    saved = await db.execute(
        select(SavedPrompt.prompt_id).where(
            SavedPrompt.user_id == current_user.id,
            SavedPrompt.prompt_id == prompt_id,
        )
    )
    is_saved = saved.scalar_one_or_none() is not None
    return PromptDetail.model_validate(_build_prompt_detail(prompt, current_user_vote, is_saved))


# ── Delete prompt ─────────────────────────────────────────────────────────────

@router.delete("/{prompt_id}", status_code=204)
async def delete_prompt(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = await _get_prompt_or_404(prompt_id, db)
    if prompt.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your prompt")
    prompt.status = PromptStatus.removed
    await db.commit()


# ── Prompt vote (upvote / downvote) ───────────────────────────────────────────

async def _recalc_prompt_score(prompt_id: UUID, db: AsyncSession) -> None:
    r = await db.execute(
        select(func.coalesce(func.sum(PromptVote.value), 0)).where(
            PromptVote.prompt_id == prompt_id
        )
    )
    new_score = int(r.scalar_one())
    await db.execute(update(Prompt).where(Prompt.id == prompt_id).values(score=new_score))


@router.post("/{prompt_id}/vote", status_code=204)
async def vote_prompt(
    prompt_id: UUID,
    payload: VoteIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = await _get_prompt_or_404(prompt_id, db)
    existing = await db.execute(
        select(PromptVote).where(
            PromptVote.user_id == current_user.id,
            PromptVote.prompt_id == prompt_id,
        )
    )
    pv = existing.scalar_one_or_none()
    if pv:
        pv.value = payload.value
    else:
        db.add(PromptVote(user_id=current_user.id, prompt_id=prompt_id, value=payload.value))
    await _recalc_prompt_score(prompt_id, db)
    if prompt.creator_id != current_user.id:
        notif_type = NotificationType.prompt_upvote if payload.value == 1 else NotificationType.prompt_downvote
        db.add(
            Notification(
                user_id=prompt.creator_id,
                actor_id=current_user.id,
                notification_type=notif_type,
                entity_type="prompt",
                entity_id=prompt.id,
                message=f"{current_user.username} {'upvoted' if payload.value == 1 else 'downvoted'} your prompt",
            )
        )
    await db.commit()


@router.delete("/{prompt_id}/vote", status_code=204)
async def remove_prompt_vote(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_prompt_or_404(prompt_id, db)
    await db.execute(
        PromptVote.__table__.delete().where(
            PromptVote.user_id == current_user.id,
            PromptVote.prompt_id == prompt_id,
        )
    )
    await _recalc_prompt_score(prompt_id, db)
    await db.commit()


# ── Save / unsave (bookmark; distinct from vote) ───────────────────────────────

@router.post("/{prompt_id}/save", status_code=204)
async def save_prompt(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bookmark/save a prompt (distinct from upvote)."""
    await _get_prompt_or_404(prompt_id, db)
    existing = await db.execute(
        select(SavedPrompt).where(
            SavedPrompt.user_id == current_user.id,
            SavedPrompt.prompt_id == prompt_id,
        )
    )
    if existing.scalar_one_or_none():
        return  # already saved
    db.add(SavedPrompt(user_id=current_user.id, prompt_id=prompt_id))
    await db.commit()


@router.delete("/{prompt_id}/save", status_code=204)
async def unsave_prompt(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove prompt from saved/bookmarks."""
    await _get_prompt_or_404(prompt_id, db)
    await db.execute(
        SavedPrompt.__table__.delete().where(
            SavedPrompt.user_id == current_user.id,
            SavedPrompt.prompt_id == prompt_id,
        )
    )
    await db.commit()


# ── Comments ──────────────────────────────────────────────────────────────────

def _comment_to_out(
    c: Comment,
    replies: list[dict] | None = None,
    current_user_vote: Optional[int] = None,
) -> dict:
    """Build a dict for CommentOut without touching c.replies (lazy='raise')."""
    return {
        "id": c.id,
        "content": c.content,
        "user": c.user,
        "parent_comment_id": c.parent_comment_id,
        "moderation_state": c.moderation_state.value if c.moderation_state else "visible",
        "created_at": c.created_at,
        "replies": replies if replies is not None else [],
        "vote_score": getattr(c, "vote_score", 0),
        "current_user_vote": current_user_vote,
    }


@router.get("/{prompt_id}/comments", response_model=list[CommentOut])
async def get_comments(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    await _get_prompt_or_404(prompt_id, db)
    result = await db.execute(
        select(Comment)
        .options(
            selectinload(Comment.user),
            selectinload(Comment.replies).selectinload(Comment.user),
        )
        .where(
            Comment.prompt_id == prompt_id,
            Comment.parent_comment_id == None,
            Comment.moderation_state == ModerationState.visible,
        )
        .order_by(Comment.created_at.asc())
    )
    top_level = result.scalars().all()
    all_comments = list(top_level) + [r for c in top_level for r in c.replies]
    comment_ids = [c.id for c in all_comments]
    vote_map: dict[UUID, int] = {}
    if current_user and comment_ids:
        vote_rows = await db.execute(
            select(CommentVote.comment_id, CommentVote.value).where(
                CommentVote.user_id == current_user.id,
                CommentVote.comment_id.in_(comment_ids),
            )
        )
        for cid, val in vote_rows.all():
            vote_map[cid] = val
    out = []
    for c in top_level:
        reply_dicts = [
            _comment_to_out(reply, current_user_vote=vote_map.get(reply.id))
            for reply in c.replies
        ]
        out.append(
            CommentOut.model_validate(
                _comment_to_out(c, replies=reply_dicts, current_user_vote=vote_map.get(c.id))
            )
        )
    return out


@router.post("/{prompt_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    prompt_id: UUID,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = await _get_prompt_or_404(prompt_id, db)
    if payload.parent_comment_id is not None:
        parent = await db.execute(
            select(Comment).where(
                Comment.id == payload.parent_comment_id,
                Comment.prompt_id == prompt_id,
            )
        )
        if parent.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=400,
                detail="Parent comment not found or does not belong to this prompt",
            )
    try:
        comment = Comment(
            id=uuid4(),
            prompt_id=prompt_id,
            user_id=current_user.id,
            content=payload.content,
            parent_comment_id=payload.parent_comment_id,
            moderation_state=ModerationState.visible,
        )
        db.add(comment)
        await db.commit()
        result = await db.execute(
            select(Comment).options(selectinload(Comment.user)).where(Comment.id == comment.id)
        )
        out = result.scalar_one()

        # Notifications: reply to comment author (entity = comment for deep link)
        if payload.parent_comment_id is not None:
            parent_res = await db.execute(
                select(Comment).where(Comment.id == payload.parent_comment_id)
            )
            parent = parent_res.scalar_one_or_none()
            if parent and parent.user_id != current_user.id:
                db.add(
                    Notification(
                        user_id=parent.user_id,
                        actor_id=current_user.id,
                        notification_type=NotificationType.comment_reply,
                        entity_type="comment",
                        entity_id=comment.id,
                        message=f"{current_user.username} replied to your comment",
                    )
                )

        # Mentions: @username in content (entity points to comment for deep link)
        import re

        mentioned_usernames = set(re.findall(r"@([a-zA-Z0-9_-]{3,30})", comment.content or ""))
        if mentioned_usernames:
            from app.models.user import User as UserModel

            result_users = await db.execute(
                select(UserModel).where(UserModel.username.in_(list(mentioned_usernames)))
            )
            for u in result_users.scalars():
                if u.id == current_user.id:
                    continue
                db.add(
                    Notification(
                        user_id=u.id,
                        actor_id=current_user.id,
                        notification_type=NotificationType.comment_mention,
                        entity_type="comment",
                        entity_id=comment.id,
                        message=f"{current_user.username} mentioned you in a comment",
                    )
                )

        # Notify prompt creator on any comment by someone else
        if prompt.creator_id != current_user.id:
            db.add(
                Notification(
                    user_id=prompt.creator_id,
                    actor_id=current_user.id,
                    notification_type=NotificationType.comment_reply,
                    entity_type="prompt",
                    entity_id=prompt_id,
                    message=f"{current_user.username} commented on your prompt",
                )
            )

        await db.commit()

        return CommentOut.model_validate({
            "id": out.id,
            "content": out.content,
            "user": out.user,
            "parent_comment_id": out.parent_comment_id,
            "moderation_state": out.moderation_state.value if out.moderation_state else "visible",
            "created_at": out.created_at,
            "replies": [],
            "vote_score": 0,
            "current_user_vote": None,
        })
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to add comment") from None


@router.patch("/{prompt_id}/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    prompt_id: UUID,
    comment_id: UUID,
    payload: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit a comment (author only)."""
    await _get_prompt_or_404(prompt_id, db)
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.user))
        .where(
            Comment.id == comment_id,
            Comment.prompt_id == prompt_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    comment.content = payload.content.strip()
    if not comment.content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    await db.commit()
    await db.refresh(comment)
    vote_row = await db.execute(
        select(CommentVote.value).where(
            CommentVote.user_id == current_user.id,
            CommentVote.comment_id == comment_id,
        )
    )
    current_user_vote = vote_row.scalar_one_or_none()
    return CommentOut.model_validate(
        _comment_to_out(comment, replies=[], current_user_vote=current_user_vote)
    )


@router.delete("/{prompt_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    prompt_id: UUID,
    comment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a comment (author only). Soft-delete: sets moderation_state to removed."""
    await _get_prompt_or_404(prompt_id, db)
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.prompt_id == prompt_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    comment.moderation_state = ModerationState.removed
    await db.commit()


# ── Comment vote ───────────────────────────────────────────────────────────────

async def _recalc_comment_score(comment_id: UUID, db: AsyncSession) -> None:
    r = await db.execute(
        select(func.coalesce(func.sum(CommentVote.value), 0)).where(
            CommentVote.comment_id == comment_id
        )
    )
    new_score = int(r.scalar_one())
    await db.execute(
        update(Comment).where(Comment.id == comment_id).values(vote_score=new_score)
    )


@router.post("/{prompt_id}/comments/{comment_id}/vote", status_code=204)
async def vote_comment(
    prompt_id: UUID,
    comment_id: UUID,
    payload: VoteIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_prompt_or_404(prompt_id, db)
    comment_result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.prompt_id == prompt_id,
        )
    )
    comment = comment_result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    existing = await db.execute(
        select(CommentVote).where(
            CommentVote.user_id == current_user.id,
            CommentVote.comment_id == comment_id,
        )
    )
    cv = existing.scalar_one_or_none()
    if cv:
        cv.value = payload.value
    else:
        db.add(CommentVote(user_id=current_user.id, comment_id=comment_id, value=payload.value))
    await _recalc_comment_score(comment_id, db)
    if comment.user_id != current_user.id:
        notif_type = (
            NotificationType.comment_upvote if payload.value == 1 else NotificationType.comment_downvote
        )
        db.add(
            Notification(
                user_id=comment.user_id,
                actor_id=current_user.id,
                notification_type=notif_type,
                entity_type="comment",
                entity_id=comment_id,
                message=f"{current_user.username} {'upvoted' if payload.value == 1 else 'downvoted'} your comment",
            )
        )
    await db.commit()


@router.delete("/{prompt_id}/comments/{comment_id}/vote", status_code=204)
async def remove_comment_vote(
    prompt_id: UUID,
    comment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_prompt_or_404(prompt_id, db)
    comment_result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.prompt_id == prompt_id,
        )
    )
    if not comment_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Comment not found")
    await db.execute(
        CommentVote.__table__.delete().where(
            CommentVote.user_id == current_user.id,
            CommentVote.comment_id == comment_id,
        )
    )
    await _recalc_comment_score(comment_id, db)
    await db.commit()
