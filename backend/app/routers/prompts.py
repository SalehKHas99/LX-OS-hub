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
from app.models.collection import CollectionItem
from app.schemas.prompts import PromptCreate, PromptUpdate, PromptCard, PromptDetail
from app.schemas.comments import CommentCreate, CommentOut
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


def _build_prompt_card(p: Prompt) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "model_family": p.model_family.value if p.model_family else None,
        "score": p.score,
        "creator": p.creator,
        "tags": [pt.tag for pt in p.prompt_tags],
        "images": p.images,
        "created_at": p.created_at,
    }


def _build_prompt_detail(p: Prompt) -> dict:
    return {
        **_build_prompt_card(p),
        "raw_prompt": p.raw_prompt,
        "negative_prompt": p.negative_prompt,
        "notes": p.notes,
        "status": p.status.value,
        "community_id": p.community_id,
        "remix_of_id": p.remix_of_id,
        "context_blocks": p.context_blocks,
        "updated_at": p.updated_at,
    }


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
    q = select(Prompt).options(*_prompt_load_options()).where(
        Prompt.status == PromptStatus.published
    )
    if sort == "trending" or sort == "top":
        q = q.order_by(Prompt.score.desc(), Prompt.created_at.desc())
    else:
        q = q.order_by(Prompt.created_at.desc())

    count_result = await db.execute(
        select(func.count()).select_from(Prompt).where(Prompt.status == PromptStatus.published)
    )
    total = count_result.scalar_one()

    result = await db.execute(q.offset(offset).limit(page_size))
    prompts = result.scalars().all()

    return PaginatedResponse(
        items=[PromptCard.model_validate(_build_prompt_card(p)) for p in prompts],
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
        return PromptDetail.model_validate(_build_prompt_detail(prompt))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ── Get prompt detail ─────────────────────────────────────────────────────────

@router.get("/{prompt_id}", response_model=PromptDetail)
async def get_prompt(prompt_id: UUID, db: AsyncSession = Depends(get_db)):
    prompt = await _get_prompt_or_404(prompt_id, db)
    return PromptDetail.model_validate(_build_prompt_detail(prompt))


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
    return PromptDetail.model_validate(_build_prompt_detail(prompt))


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


# ── Save / unsave ─────────────────────────────────────────────────────────────

@router.post("/{prompt_id}/save", status_code=204)
async def save_prompt(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = await _get_prompt_or_404(prompt_id, db)
    await db.execute(
        update(Prompt).where(Prompt.id == prompt.id).values(score=Prompt.score + 1)
    )
    await db.commit()


@router.delete("/{prompt_id}/save", status_code=204)
async def unsave_prompt(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = await _get_prompt_or_404(prompt_id, db)
    await db.execute(
        update(Prompt).where(Prompt.id == prompt.id).values(
            score=func.greatest(Prompt.score - 1, 0)
        )
    )
    await db.commit()


# ── Comments ──────────────────────────────────────────────────────────────────

def _comment_to_out(c: Comment, replies: list[dict] | None = None) -> dict:
    """Build a dict for CommentOut without touching c.replies (lazy='raise')."""
    return {
        "id": c.id,
        "content": c.content,
        "user": c.user,
        "parent_comment_id": c.parent_comment_id,
        "moderation_state": c.moderation_state.value if c.moderation_state else "visible",
        "created_at": c.created_at,
        "replies": replies if replies is not None else [],
    }


@router.get("/{prompt_id}/comments", response_model=list[CommentOut])
async def get_comments(prompt_id: UUID, db: AsyncSession = Depends(get_db)):
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
    out = []
    for c in top_level:
        reply_dicts = [
            _comment_to_out(reply)
            for reply in c.replies
        ]
        out.append(CommentOut.model_validate(_comment_to_out(c, replies=reply_dicts)))
    return out


@router.post("/{prompt_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    prompt_id: UUID,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_prompt_or_404(prompt_id, db)
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
        return CommentOut.model_validate({
            "id": out.id,
            "content": out.content,
            "user": out.user,
            "parent_comment_id": out.parent_comment_id,
            "moderation_state": out.moderation_state.value if out.moderation_state else "visible",
            "created_at": out.created_at,
            "replies": [],
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
