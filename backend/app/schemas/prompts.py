from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime


# ── Context block ─────────────────────────────────────────────────────────────

class ContextBlockIn(BaseModel):
    field_name: str
    field_value: str
    sort_order: int = 0

    @field_validator("field_name")
    @classmethod
    def field_name_bounded(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 80:
            raise ValueError("field_name must be at most 80 characters")
        return v

    @field_validator("field_value")
    @classmethod
    def field_value_bounded(cls, v: str) -> str:
        if v and len(v) > 10_000:
            raise ValueError("field_value must be at most 10000 characters")
        return v or ""


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
    share_to_feed: Optional[bool] = None
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
        if len(v) > 50_000:
            raise ValueError("Prompt must be at most 50000 characters")
        return v

    @field_validator("negative_prompt")
    @classmethod
    def negative_bounded(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 5_000:
            raise ValueError("Negative prompt at most 5000 characters")
        return v

    @field_validator("notes")
    @classmethod
    def notes_bounded(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 5_000:
            raise ValueError("Notes at most 5000 characters")
        return v

    @field_validator("context_blocks")
    @classmethod
    def context_blocks_bounded(cls, v: List["ContextBlockIn"]) -> List["ContextBlockIn"]:
        if len(v) > 50:
            raise ValueError("At most 50 context blocks")
        return v

    @field_validator("tag_slugs")
    @classmethod
    def tag_slugs_bounded(cls, v: List[str]) -> List[str]:
        if len(v) > 20:
            raise ValueError("At most 20 tags")
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

    @field_validator("title")
    @classmethod
    def title_bounded(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) < 3 or len(v) > 200:
                raise ValueError("Title must be 3–200 characters")
        return v

    @field_validator("raw_prompt")
    @classmethod
    def raw_prompt_bounded(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 50_000:
            raise ValueError("Prompt at most 50000 characters")
        return v

    @field_validator("negative_prompt", "notes")
    @classmethod
    def text_bounded(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 5_000:
            raise ValueError("Field at most 5000 characters")
        return v

    @field_validator("context_blocks")
    @classmethod
    def context_blocks_bounded(cls, v: Optional[List[ContextBlockIn]]) -> Optional[List[ContextBlockIn]]:
        if v is not None and len(v) > 50:
            raise ValueError("At most 50 context blocks")
        return v

    @field_validator("tag_slugs")
    @classmethod
    def tag_slugs_bounded(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None and len(v) > 20:
            raise ValueError("At most 20 tags")
        return v


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
    current_user_vote: Optional[int] = None  # 1 upvote, -1 downvote, None not voted
    is_saved: Optional[bool] = None  # True if current user has saved (bookmarked) this prompt

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
    current_user_vote: Optional[int] = None  # 1 upvote, -1 downvote, None not voted
    is_saved: Optional[bool] = None  # True if current user has saved (bookmarked) this prompt

    model_config = {"from_attributes": True}
