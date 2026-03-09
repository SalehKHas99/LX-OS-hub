from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.prompt import Prompt, PromptStatus
from app.models.tag import PromptTag
from app.schemas.prompts import PromptCard
from app.schemas.common import PaginatedResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProfileOut(BaseModel):
    id: UUID
    username: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    created_at: datetime
    prompt_count: int

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


router = APIRouter(prefix="/users", tags=["profiles"])


async def _get_user_or_404(username: str, db: AsyncSession) -> User:
    username = username.strip()
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{username}", response_model=ProfileOut)
async def get_profile(username: str, db: AsyncSession = Depends(get_db)):
    user = await _get_user_or_404(username, db)
    count = (await db.execute(
        select(func.count()).select_from(Prompt)
        .where(Prompt.creator_id == user.id, Prompt.status == PromptStatus.published)
    )).scalar_one()
    return ProfileOut(
        id=user.id, username=user.username, bio=user.bio,
        avatar_url=user.avatar_url, role=user.role,
        created_at=user.created_at, prompt_count=count,
    )


@router.patch("/me/profile", response_model=ProfileOut)
async def update_profile(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.bio is not None:
        current_user.bio = payload.bio
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    await db.commit()
    await db.refresh(current_user)
    count = (await db.execute(
        select(func.count()).select_from(Prompt)
        .where(Prompt.creator_id == current_user.id, Prompt.status == PromptStatus.published)
    )).scalar_one()
    return ProfileOut(
        id=current_user.id, username=current_user.username, bio=current_user.bio,
        avatar_url=current_user.avatar_url, role=current_user.role,
        created_at=current_user.created_at, prompt_count=count,
    )


@router.get("/{username}/prompts", response_model=PaginatedResponse[PromptCard])
async def user_prompts(
    username: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_or_404(username, db)

    stmt = (
        select(Prompt)
        .options(
            selectinload(Prompt.creator),
            selectinload(Prompt.prompt_tags).selectinload(PromptTag.tag),
            selectinload(Prompt.images),
        )
        .where(Prompt.creator_id == user.id, Prompt.status == PromptStatus.published)
        .order_by(Prompt.created_at.desc())
    )

    total = (await db.execute(
        select(func.count()).select_from(
            select(Prompt).where(
                Prompt.creator_id == user.id, Prompt.status == PromptStatus.published
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
