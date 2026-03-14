from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, cast, String
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database.session import get_db
from app.auth.dependencies import get_current_user_optional
from app.models.prompt import Prompt, PromptStatus
from app.models.vote import PromptVote
from app.models.tag import Tag, PromptTag
from app.models.user import User
from app.models.community import Community
from app.schemas.prompts import PromptCard
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/suggest")
async def search_suggest(
    q: Optional[str] = Query(None, min_length=1, max_length=100),
    limit: int = Query(8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Suggest prompts, users, and communities for the search bar. Returns mixed results."""
    if not q or not q.strip():
        return {"prompts": [], "users": [], "communities": []}
    term = f"%{q.strip()}%"

    # Prompts (title / share_to_feed)
    from sqlalchemy import func
    prompt_stmt = (
        select(Prompt)
        .options(
            selectinload(Prompt.creator),
            selectinload(Prompt.prompt_tags).selectinload(PromptTag.tag),
            selectinload(Prompt.images),
        )
        .where(
            Prompt.status == PromptStatus.published,
            Prompt.share_to_feed.is_(True),
            or_(Prompt.title.ilike(term), Prompt.raw_prompt.ilike(term)),
        )
        .order_by(Prompt.score.desc().nullslast(), Prompt.created_at.desc())
        .limit(limit)
    )
    prompt_result = await db.execute(prompt_stmt)
    prompts = prompt_result.scalars().all()
    prompt_items = []
    for p in prompts:
        creator = None
        if p.creator:
            creator = {"id": str(p.creator.id), "username": p.creator.username, "avatar_url": getattr(p.creator, "avatar_url", None)}
        tags = [{"id": str(pt.tag.id), "slug": pt.tag.slug, "display_name": pt.tag.display_name} for pt in p.prompt_tags if pt.tag]
        prompt_items.append({
            "id": str(p.id),
            "title": p.title,
            "model_family": p.model_family.value if p.model_family else None,
            "score": p.score or 0,
            "creator": creator,
            "tags": tags,
            "images": [],
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    # Users (username) – active only
    user_stmt = (
        select(User)
        .where(User.is_active.is_(True), User.username.ilike(term))
        .limit(limit)
    )
    user_result = await db.execute(user_stmt)
    users = user_result.scalars().all()
    user_items = [{"id": str(u.id), "username": u.username} for u in users]

    # Communities (title, slug)
    comm_stmt = (
        select(Community)
        .where(or_(Community.title.ilike(term), Community.slug.ilike(term)))
        .limit(limit)
    )
    comm_result = await db.execute(comm_stmt)
    communities = comm_result.scalars().all()
    comm_items = [
        {"id": str(c.id), "slug": c.slug, "title": c.title}
        for c in communities
    ]

    return {"prompts": prompt_items, "users": user_items, "communities": comm_items}


@router.get("", response_model=PaginatedResponse[PromptCard])
async def search_prompts(
    q: Optional[str] = Query(None, description="Full-text search query"),
    model: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    sort: str = Query("top", pattern="^(top|recent)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    from sqlalchemy import func

    stmt = (
        select(Prompt)
        .options(
            selectinload(Prompt.creator),
            selectinload(Prompt.prompt_tags).selectinload(PromptTag.tag),
            selectinload(Prompt.images),
        )
        .where(
            Prompt.status == PromptStatus.published,
            Prompt.share_to_feed.is_(True),
        )
    )

    if q:
        stmt = stmt.where(
            or_(
                Prompt.title.ilike(f"%{q}%"),
                Prompt.raw_prompt.ilike(f"%{q}%"),
            )
        )

    if model:
        stmt = stmt.where(cast(Prompt.model_family, String).ilike(f"%{model}%"))

    if tag:
        stmt = stmt.join(PromptTag, PromptTag.prompt_id == Prompt.id).join(
            Tag, Tag.id == PromptTag.tag_id
        ).where(Tag.slug == tag)

    if sort == "top":
        stmt = stmt.order_by(Prompt.score.desc(), Prompt.created_at.desc())
    else:
        stmt = stmt.order_by(Prompt.created_at.desc())

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(stmt.offset(offset).limit(page_size))
    prompts = result.scalars().all()

    vote_map: dict = {}
    saved_set: set = set()
    if current_user and prompts:
        vote_rows = await db.execute(
            select(PromptVote.prompt_id, PromptVote.value).where(
                PromptVote.user_id == current_user.id,
                PromptVote.prompt_id.in_([p.id for p in prompts]),
            )
        )
        for pid, val in vote_rows.all():
            vote_map[pid] = val
        from app.models.saved_prompt import SavedPrompt
        saved_rows = await db.execute(
            select(SavedPrompt.prompt_id).where(
                SavedPrompt.user_id == current_user.id,
                SavedPrompt.prompt_id.in_([p.id for p in prompts]),
            )
        )
        saved_set = {row for (row,) in saved_rows.all()}

    items = [
        PromptCard.model_validate({
            "id": p.id,
            "title": p.title,
            "model_family": p.model_family.value if p.model_family else None,
            "score": p.score,
            "creator": p.creator,
            "tags": [pt.tag for pt in p.prompt_tags],
            "images": p.images,
            "created_at": p.created_at,
            "current_user_vote": vote_map.get(p.id),
            "is_saved": p.id in saved_set if current_user else None,
        })
        for p in prompts
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(items)) < total,
    )
