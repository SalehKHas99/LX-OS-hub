from pydantic import BaseModel, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime


class CommunityCreate(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None
    rules: Optional[str] = None

    @field_validator("slug")
    @classmethod
    def slug_valid(cls, v: str) -> str:
        import re
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug may only contain lowercase letters, numbers, and hyphens")
        if len(v) < 2 or len(v) > 50:
            raise ValueError("Slug must be 2–50 characters")
        return v


class CommunityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[str] = None


class CommunityOut(BaseModel):
    id: UUID
    slug: str
    title: str
    description: Optional[str] = None
    rules: Optional[str] = None
    visibility: str
    created_at: datetime

    model_config = {"from_attributes": True}
