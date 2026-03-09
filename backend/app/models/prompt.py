import enum
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Column, String, Text, Integer, DateTime, ForeignKey, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class PromptStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    hidden = "hidden"
    removed = "removed"

class ModelFamily(str, enum.Enum):
    midjourney = "midjourney"
    dalle = "dalle"
    stable_diffusion = "stable_diffusion"
    stable_image = "stable_image"
    flux = "flux"
    comfyui = "comfyui"
    other = "other"
class AdapterFamily(str, enum.Enum):
    midjourney = "midjourney"
    dalle = "dalle"
    stable_diffusion = "stable_diffusion"
    flux = "flux"


class ContextSource(str, enum.Enum):
    user = "user"
    ai_parsed = "ai_parsed"

class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(200), nullable=False)
    raw_prompt = Column(Text, nullable=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    model_family = Column(
        SAEnum(ModelFamily, name="modelfamily", create_constraint=False),
        nullable=False,
        default=ModelFamily.other,
    )
    negative_prompt = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="SET NULL"), nullable=True)
    remix_of_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="SET NULL"), nullable=True)
    score = Column(Integer, nullable=False, default=0)
    status = Column(SAEnum(PromptStatus), nullable=False, default=PromptStatus.published)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    creator = relationship("User", back_populates="prompts", lazy="raise")
    community = relationship("Community", back_populates="prompts", lazy="raise")
    context_blocks = relationship("PromptContextBlock", back_populates="prompt", cascade="all, delete-orphan", lazy="raise")
    prompt_tags = relationship("PromptTag", back_populates="prompt", cascade="all, delete-orphan", lazy="raise")
    images = relationship("PromptImage", back_populates="prompt", cascade="all, delete-orphan", order_by="PromptImage.sort_order", lazy="raise")
    comments = relationship("Comment", back_populates="prompt", cascade="all, delete-orphan", lazy="raise")
    collection_items = relationship("CollectionItem", back_populates="prompt", lazy="raise")
    remix_children = relationship("Prompt", foreign_keys=[remix_of_id], lazy="raise")


class PromptContextBlock(Base):
    __tablename__ = "prompt_context_blocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(100), nullable=False)
    field_value = Column(Text, nullable=False)
    source_type = Column(SAEnum(ContextSource), nullable=True)
    confidence = Column(Integer, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    prompt = relationship("Prompt", back_populates="context_blocks")


class PromptImage(Base):
    __tablename__ = "prompt_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(Text, nullable=False)
    alt_text = Column(String(500), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    prompt = relationship("Prompt", back_populates="images")
class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    version_no = Column(Integer, nullable=False, default=1)
    adapter_family = Column(String(100), nullable=True)
    compiled_prompt = Column(Text, nullable=False)
    compile_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    prompt = relationship("Prompt", lazy="raise")