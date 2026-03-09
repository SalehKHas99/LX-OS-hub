from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime


# ── Context block ─────────────────────────────────────────────────────────────

class ContextBlockIn(BaseModel):
    field_name: str
    field_value: str
    sort_order: int = 0


class ContextBlockOut(BaseModel):
    id: UUID
    field_name: str
    field_value: str
    sort_order: int

    model_config = {"from_attributes": True}


# ── Prompt image ──────────────────────────────────────────────────────────────

class PromptImageOut(BaseModel):
    id: UUID
    image_url: str
    alt_text: Optional[str] = None
    sort_order: int

    model_config = {"from_attributes": True}


# ── Creator summary (nested in prompt) ───────────────────────────────────────

class CreatorSummary(BaseModel):
    id: UUID
    username: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Tag summary ───────────────────────────────────────────────────────────────

class TagOut(BaseModel):
    id: UUID
    slug: str
    display_name: str

    model_config = {"from_attributes": True}


# ── Prompt create ─────────────────────────────────────────────────────────────

class PromptCreate(BaseModel):
    title: str
    raw_prompt: str
    model_family: Optional[str] = None
    negative_prompt: Optional[str] = None
    notes: Optional[str] = None
    community_id: Optional[UUID] = None
    remix_of_id: Optional[UUID] = None
    context_blocks: List[ContextBlockIn] = []
    tag_slugs: List[str] = []

    @field_validator("title")
    @classmethod
    def title_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 200:
            raise ValueError("Title must be 3–200 characters")
        return v

    @field_validator("raw_prompt")
    @classmethod
    def prompt_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Prompt must be at least 10 characters")
        return v


# ── Prompt update ─────────────────────────────────────────────────────────────

class PromptUpdate(BaseModel):
    title: Optional[str] = None
    raw_prompt: Optional[str] = None
    model_family: Optional[str] = None
    negative_prompt: Optional[str] = None
    notes: Optional[str] = None
    context_blocks: Optional[List[ContextBlockIn]] = None
    tag_slugs: Optional[List[str]] = None


# ── Prompt card (feed / search results) ──────────────────────────────────────

class PromptCard(BaseModel):
    id: UUID
    title: str
    model_family: Optional[str] = None
    score: int
    creator: CreatorSummary
    tags: List[TagOut] = []
    images: List[PromptImageOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Prompt detail (full page) ─────────────────────────────────────────────────

class PromptDetail(BaseModel):
    id: UUID
    title: str
    raw_prompt: str
    model_family: Optional[str] = None
    negative_prompt: Optional[str] = None
    notes: Optional[str] = None
    score: int
    status: str
    creator: CreatorSummary
    community_id: Optional[UUID] = None
    remix_of_id: Optional[UUID] = None
    context_blocks: List[ContextBlockOut] = []
    tags: List[TagOut] = []
    images: List[PromptImageOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
