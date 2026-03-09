from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.schemas.prompts import PromptCard


class CollectionCreate(BaseModel):
    title: str
    description: Optional[str] = None


class CollectionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class CollectionOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    owner_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class CollectionDetail(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    owner_id: UUID
    created_at: datetime
    prompts: List[PromptCard] = []

    model_config = {"from_attributes": True}
