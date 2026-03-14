from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.prompt import Prompt, PromptStatus
from app.models.vote import PromptVote
from app.models.saved_prompt import SavedPrompt
from app.models.tag import PromptTag
from app.schemas.prompts import PromptCard
from app.schemas.common import PaginatedResponse
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

BIO_MAX_LEN = 2000
AVATAR_URL_MAX_LEN = 2000


class ProfileOut(BaseModel):
    id: UUID
    username: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    created_at: datetime
    prompt_count: int
    public_key: Optional[str] = None  # E2E messaging: base64 P-256 public key

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("bio")
    @classmethod
    def bio_bounded(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > BIO_MAX_LEN:
            raise ValueError(f"Bio must be at most {BIO_MAX_LEN} characters")
        return v

    @field_validator("avatar_url")
    @classmethod
    def avatar_url_bounded(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > AVATAR_URL_MAX_LEN:
            raise ValueError(f"Avatar URL must be at most {AVATAR_URL_MAX_LEN} characters")
        return v


router = APIRouter(prefix="/users", tags=["profiles"])


async def _get_user_or_404(username: str, db: AsyncSession) -> User:
    username = username.strip()
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{username}", response_model=ProfileOut)
async def get_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user = await _get_user_or_404(username, db)
    is_own_profile = current_user is not None and current_user.id == user.id
    base_filter = (Prompt.creator_id == user.id) & (Prompt.status == PromptStatus.published)
    if not is_own_profile:
        base_filter = base_filter & (Prompt.share_to_feed.is_(True))
    count = (await db.execute(
        select(func.count()).select_from(Prompt).where(base_filter)
    )).scalar_one()
    return ProfileOut(
        id=user.id, username=user.username, bio=user.bio,
        avatar_url=user.avatar_url, role=user.role,
        created_at=user.created_at, prompt_count=count,
        public_key=getattr(user, "public_key", None),
    )


class PublicKeyUpdate(BaseModel):
    public_key: str  # base64-encoded P-256 public key


@router.put("/me/public-key")
async def set_public_key(
    payload: PublicKeyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set current user's E2E public key (for encrypted messaging)."""
    if len(payload.public_key) > 2000:
        raise HTTPException(status_code=400, detail="Public key too long")
    current_user.public_key = payload.public_key
    await db.commit()
    return {"ok": True}


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
        public_key=getattr(current_user, "public_key", None),
    )


@router.get("/{username}/prompts", response_model=PaginatedResponse[PromptCard])
async def user_prompts(
    username: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user = await _get_user_or_404(username, db)
    # When viewing someone else's profile, only show prompts shared to feed (same as Explore).
    is_own_profile = current_user is not None and current_user.id == user.id
    base_filter = (Prompt.creator_id == user.id) & (Prompt.status == PromptStatus.published)
    if not is_own_profile:
        base_filter = base_filter & (Prompt.share_to_feed.is_(True))

    stmt = (
        select(Prompt)
        .options(
            selectinload(Prompt.creator),
            selectinload(Prompt.prompt_tags).selectinload(PromptTag.tag),
            selectinload(Prompt.images),
        )
        .where(base_filter)
        .order_by(Prompt.created_at.desc())
    )

    total = (await db.execute(
        select(func.count()).select_from(
            select(Prompt).where(base_filter).subquery()
        )
    )).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(stmt.offset(offset).limit(page_size))
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

    items = [
        PromptCard.model_validate({
            "id": p.id, "title": p.title, "model_family": p.model_family.value if p.model_family else None,
            "score": p.score, "creator": p.creator,
            "tags": [pt.tag for pt in p.prompt_tags],
            "images": p.images, "created_at": p.created_at,
            "current_user_vote": vote_map.get(p.id),
            "is_saved": p.id in saved_set if current_user else None,
        })
        for p in prompts
    ]

    return PaginatedResponse(items=items, total=total, page=page,
                             page_size=page_size, has_more=(offset + len(items)) < total)
