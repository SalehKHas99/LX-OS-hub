from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID, uuid4
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import httpx
import os

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.prompt import Prompt, PromptImage, PromptStatus
from app.config.settings import settings

router = APIRouter(prefix="/uploads", tags=["uploads"])

# ── Constants ─────────────────────────────────────────────────────────────────

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
BUCKET_NAME = "prompt-images"


# ── Schemas ───────────────────────────────────────────────────────────────────

class UploadedImage(BaseModel):
    id: UUID
    prompt_id: UUID
    image_url: str
    alt_text: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    sort_order: int
    created_at: Optional[datetime] = None


# ── Supabase Storage helpers ──────────────────────────────────────────────────

def _supabase_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_KEY,
    }


def _storage_url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{path}"


def _public_url(path: str) -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{path}"


async def _upload_to_supabase(file_bytes: bytes, path: str, content_type: str) -> str:
    """Upload bytes to Supabase Storage and return the public URL."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {
            **_supabase_headers(),
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        response = await client.post(
            _storage_url(path),
            content=file_bytes,
            headers=headers,
        )
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=502,
                detail=f"Supabase Storage upload failed: {response.text}",
            )
    return _public_url(path)


async def _delete_from_supabase(path: str) -> None:
    """Delete a file from Supabase Storage."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        await client.delete(
            _storage_url(path),
            headers=_supabase_headers(),
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/prompt-image", response_model=UploadedImage, status_code=201)
async def upload_prompt_image(
    prompt_id: UUID = Form(...),
    alt_text: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an image and attach it to a prompt.
    Accepts: jpg, png, webp, gif — max 10MB.
    """
    # Validate prompt ownership
    result = await db.execute(
        select(Prompt).where(
            Prompt.id == prompt_id,
            Prompt.status == PromptStatus.published,
        )
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    if prompt.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your prompt")

    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"File type {file.content_type} not allowed. Use jpg, png, webp, or gif.",
        )

    # Read and validate file size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=422,
            detail=f"File too large. Maximum size is 10MB.",
        )

    # Generate unique storage path
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    storage_path = f"{current_user.id}/{prompt_id}/{uuid4()}.{ext}"

    # Upload to Supabase Storage
    public_url = await _upload_to_supabase(file_bytes, storage_path, file.content_type)

    # Get current sort order
    images_result = await db.execute(
        select(PromptImage).where(PromptImage.prompt_id == prompt_id)
    )
    existing_images = images_result.scalars().all()
    sort_order = len(existing_images)

    # Save to database
    image = PromptImage(
        id=uuid4(),
        prompt_id=prompt_id,
        image_url=public_url,
        alt_text=alt_text,
        sort_order=sort_order,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)

    return UploadedImage(
        id=image.id,
        prompt_id=image.prompt_id,
        image_url=image.image_url,
        alt_text=image.alt_text,
        width=image.width,
        height=image.height,
        sort_order=image.sort_order,
    )


@router.get("/prompt-images/{prompt_id}", response_model=list[UploadedImage])
async def get_prompt_images(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all images attached to a prompt."""
    result = await db.execute(
        select(PromptImage)
        .where(PromptImage.prompt_id == prompt_id)
        .order_by(PromptImage.sort_order)
    )
    images = result.scalars().all()
    return [
        UploadedImage(
            id=img.id,
            prompt_id=img.prompt_id,
            image_url=img.image_url,
            alt_text=img.alt_text,
            width=img.width,
            height=img.height,
            sort_order=img.sort_order,
        )
        for img in images
    ]


@router.delete("/prompt-image/{image_id}", status_code=204)
async def delete_prompt_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an image from a prompt and from Supabase Storage."""
    result = await db.execute(
        select(PromptImage).where(PromptImage.id == image_id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Verify ownership via prompt
    prompt_result = await db.execute(
        select(Prompt).where(Prompt.id == image.prompt_id)
    )
    prompt = prompt_result.scalar_one_or_none()
    if not prompt or prompt.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your image")

    # Delete from Supabase Storage
    # Extract path from public URL
    base = f"{settings.SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/"
    if image.image_url.startswith(base):
        storage_path = image.image_url[len(base):]
        await _delete_from_supabase(storage_path)

    # Delete from database
    await db.delete(image)
    await db.commit()


@router.patch("/prompt-image/{image_id}/reorder", status_code=204)
async def reorder_image(
    image_id: UUID,
    new_sort_order: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the display order of an image on a prompt."""
    result = await db.execute(
        select(PromptImage).where(PromptImage.id == image_id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    prompt_result = await db.execute(
        select(Prompt).where(Prompt.id == image.prompt_id)
    )
    prompt = prompt_result.scalar_one_or_none()
    if not prompt or prompt.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your image")

    image.sort_order = new_sort_order
    await db.commit()
