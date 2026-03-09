from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, cast, String
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database.session import get_db
from app.models.prompt import Prompt, PromptStatus
from app.models.tag import Tag, PromptTag
from app.schemas.prompts import PromptCard
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=PaginatedResponse[PromptCard])
async def search_prompts(
    q: Optional[str] = Query(None, description="Full-text search query"),
    model: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    sort: str = Query("top", pattern="^(top|recent)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func

    stmt = (
        select(Prompt)
        .options(
            selectinload(Prompt.creator),
            selectinload(Prompt.prompt_tags).selectinload(PromptTag.tag),
            selectinload(Prompt.images),
        )
        .where(Prompt.status == PromptStatus.published)
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
