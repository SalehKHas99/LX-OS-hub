from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.community import Community
from app.models.prompt import Prompt, PromptStatus
from app.models.tag import PromptTag
from app.schemas.communities import CommunityCreate, CommunityUpdate, CommunityOut
from app.schemas.prompts import PromptCard
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/communities", tags=["communities"])


async def _get_community_or_404(slug: str, db: AsyncSession) -> Community:
    result = await db.execute(select(Community).where(Community.slug == slug))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Community not found")
    return c


# ── List communities ──────────────────────────────────────────────────────────

@router.get("", response_model=list[CommunityOut])
async def list_communities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Community).order_by(Community.title))
    return result.scalars().all()


# ── Create community ──────────────────────────────────────────────────────────

@router.post("", response_model=CommunityOut, status_code=201)
async def create_community(
    payload: CommunityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(select(Community).where(Community.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already taken")

    community = Community(
        id=uuid4(),
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
        rules=payload.rules,
    )
    db.add(community)
    await db.commit()
    await db.refresh(community)
    return community


# ── Get community ─────────────────────────────────────────────────────────────

@router.get("/{slug}", response_model=CommunityOut)
async def get_community(slug: str, db: AsyncSession = Depends(get_db)):
    return await _get_community_or_404(slug, db)


# ── Update community ──────────────────────────────────────────────────────────

@router.patch("/{slug}", response_model=CommunityOut)
async def update_community(
    slug: str,
    payload: CommunityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    if payload.title is not None:
        community.title = payload.title
    if payload.description is not None:
        community.description = payload.description
    if payload.rules is not None:
        community.rules = payload.rules
    await db.commit()
    await db.refresh(community)
    return community


# ── Community prompt feed ─────────────────────────────────────────────────────

@router.get("/{slug}/prompts", response_model=PaginatedResponse[PromptCard])
async def community_prompts(
    slug: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    sort: str = Query("recent", pattern="^(top|recent)$"),
    db: AsyncSession = Depends(get_db),
):
    community = await _get_community_or_404(slug, db)

    from sqlalchemy.orm import selectinload
    stmt = (
        select(Prompt)
        .options(
            selectinload(Prompt.creator),
            selectinload(Prompt.prompt_tags).selectinload(PromptTag.tag),
            selectinload(Prompt.images),
        )
        .where(
            Prompt.community_id == community.id,
            Prompt.status == PromptStatus.published,
        )
    )

    if sort == "top":
        stmt = stmt.order_by(Prompt.score.desc(), Prompt.created_at.desc())
    else:
        stmt = stmt.order_by(Prompt.created_at.desc())

    total = (await db.execute(
        select(func.count()).select_from(
            select(Prompt).where(
                Prompt.community_id == community.id,
                Prompt.status == PromptStatus.published,
            ).subquery()
        )
    )).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(stmt.offset(offset).limit(page_size))
    prompts = result.scalars().all()

    items = [
        PromptCard.model_validate({
            "id": p.id, "title": p.title, "model_family": p.model_family.value if p.model_family else None,
            "score": p.score, "creator": p.creator,
            "tags": [pt.tag for pt in p.prompt_tags],
            "images": p.images, "created_at": p.created_at,
        })
        for p in prompts
    ]

    return PaginatedResponse(items=items, total=total, page=page,
                             page_size=page_size, has_more=(offset + len(items)) < total)
