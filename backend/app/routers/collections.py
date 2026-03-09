from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.collection import Collection, CollectionItem
from app.models.prompt import Prompt, PromptStatus
from app.models.tag import PromptTag
from app.schemas.collections import CollectionCreate, CollectionUpdate, CollectionOut, CollectionDetail
from app.schemas.prompts import PromptCard

router = APIRouter(prefix="/collections", tags=["collections"])


async def _get_collection_or_404(collection_id: UUID, db: AsyncSession) -> Collection:
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    return c


# ── List my collections ───────────────────────────────────────────────────────

@router.get("/mine", response_model=list[CollectionOut])
async def my_collections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Collection)
        .where(Collection.owner_id == current_user.id)
        .order_by(Collection.created_at.desc())
    )
    return result.scalars().all()


# ── Create collection ─────────────────────────────────────────────────────────

@router.post("", response_model=CollectionOut, status_code=201)
async def create_collection(
    payload: CollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = Collection(
        id=uuid4(),
        owner_id=current_user.id,
        title=payload.title,
        description=payload.description,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    return collection


# ── Get collection detail ─────────────────────────────────────────────────────

@router.get("/{collection_id}", response_model=CollectionDetail)
async def get_collection(collection_id: UUID, db: AsyncSession = Depends(get_db)):
    collection = await _get_collection_or_404(collection_id, db)

    items_result = await db.execute(
        select(CollectionItem)
        .where(CollectionItem.collection_id == collection_id)
        .order_by(CollectionItem.sort_order)
    )
    items = items_result.scalars().all()

    prompts = []
    for item in items:
        p_result = await db.execute(
            select(Prompt)
            .options(
                selectinload(Prompt.creator),
                selectinload(Prompt.prompt_tags).selectinload(PromptTag.tag),
                selectinload(Prompt.images),
            )
            .where(Prompt.id == item.prompt_id, Prompt.status == PromptStatus.published)
        )
        p = p_result.scalar_one_or_none()
        if p:
            prompts.append(PromptCard.model_validate({
                "id": p.id, "title": p.title, "model_family": p.model_family.value if p.model_family else None,
                "score": p.score, "creator": p.creator,
                "tags": [pt.tag for pt in p.prompt_tags],
                "images": p.images, "created_at": p.created_at,
            }))

    return CollectionDetail(
        id=collection.id,
        title=collection.title,
        description=collection.description,
        owner_id=collection.owner_id,
        created_at=collection.created_at,
        prompts=prompts,
    )


# ── Update collection ─────────────────────────────────────────────────────────

@router.patch("/{collection_id}", response_model=CollectionOut)
async def update_collection(
    collection_id: UUID,
    payload: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = await _get_collection_or_404(collection_id, db)
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your collection")
    if payload.title is not None:
        collection.title = payload.title
    if payload.description is not None:
        collection.description = payload.description
    await db.commit()
    await db.refresh(collection)
    return collection


# ── Delete collection ─────────────────────────────────────────────────────────

@router.delete("/{collection_id}", status_code=204)
async def delete_collection(
    collection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = await _get_collection_or_404(collection_id, db)
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your collection")
    await db.delete(collection)
    await db.commit()


# ── Add / remove prompt from collection ───────────────────────────────────────

@router.post("/{collection_id}/prompts/{prompt_id}", status_code=204)
async def add_to_collection(
    collection_id: UUID,
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = await _get_collection_or_404(collection_id, db)
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your collection")

    existing = await db.execute(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection_id,
            CollectionItem.prompt_id == prompt_id,
        )
    )
    if existing.scalar_one_or_none():
        return  # Already in collection

    count = (await db.execute(
        select(func.count()).select_from(CollectionItem)
        .where(CollectionItem.collection_id == collection_id)
    )).scalar_one()

    db.add(CollectionItem(
        collection_id=collection_id,
        prompt_id=prompt_id,
        sort_order=count,
    ))
    await db.commit()


@router.delete("/{collection_id}/prompts/{prompt_id}", status_code=204)
async def remove_from_collection(
    collection_id: UUID,
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = await _get_collection_or_404(collection_id, db)
    if collection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your collection")

    result = await db.execute(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection_id,
            CollectionItem.prompt_id == prompt_id,
        )
    )
    item = result.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()
