import enum
import uuid

from sqlalchemy import (
    Column, Enum, Float, ForeignKey, Index, Integer, String, Text,
)
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class ModelFamily(str, enum.Enum):
    midjourney = "midjourney"
    dalle = "dalle"
    stable_diffusion = "stable_diffusion"
    flux = "flux"
    comfyui = "comfyui"
    other = "other"


class PromptStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    hidden = "hidden"
    removed = "removed"


class AdapterFamily(str, enum.Enum):
    midjourney = "midjourney"
    dalle = "dalle"
    stable_diffusion = "stable_diffusion"
    flux = "flux"


class ContextSource(str, enum.Enum):
    user = "user"
    ai_parsed = "ai_parsed"


# ──────────────────────────────────────────────────────────
# PROMPT
# ──────────────────────────────────────────────────────────

class Prompt(Base, TimestampMixin):
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    raw_prompt = Column(Text, nullable=False)
    creator_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    model_family = Column(
        Enum(ModelFamily, name="modelfamily"), nullable=False
    )
    negative_prompt = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    community_id = Column(
        UUID(as_uuid=True), ForeignKey("communities.id"), nullable=True
    )
    status = Column(
        Enum(PromptStatus, name="promptstatus"),
        default=PromptStatus.draft,
        nullable=False,
    )
    score = Column(Integer, default=0, nullable=False)  # denormalized save count
    remix_of_id = Column(
        UUID(as_uuid=True), ForeignKey("prompts.id"), nullable=True
    )
    search_vector = Column(TSVECTOR)  # maintained by Postgres trigger

    # Relationships
    creator = relationship("User", back_populates="prompts", foreign_keys=[creator_id])
    community = relationship("Community", back_populates="prompts")
    context_blocks = relationship(
        "PromptContextBlock", back_populates="prompt", cascade="all, delete-orphan"
    )
    versions = relationship(
        "PromptVersion", back_populates="prompt", cascade="all, delete-orphan"
    )
    images = relationship(
        "PromptImage",
        back_populates="prompt",
        cascade="all, delete-orphan",
        order_by="PromptImage.sort_order",
    )
    comments = relationship(
        "Comment", back_populates="prompt", cascade="all, delete-orphan"
    )
    prompt_tags = relationship(
        "PromptTag", back_populates="prompt", cascade="all, delete-orphan"
    )
    remixes = relationship("Prompt", foreign_keys=[remix_of_id])
    collection_items = relationship("CollectionItem", back_populates="prompt")

    __table_args__ = (
        Index("ix_prompts_search_vector", "search_vector", postgresql_using="gin"),
        Index("ix_prompts_creator_status", "creator_id", "status"),
        Index("ix_prompts_community_status", "community_id", "status"),
        Index("ix_prompts_score", "score"),
    )


# ──────────────────────────────────────────────────────────
# PROMPT CONTEXT BLOCKS
# Each row = one structured context field for a prompt.
# ──────────────────────────────────────────────────────────

class PromptContextBlock(Base):
    __tablename__ = "prompt_context_blocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompts.id", ondelete="CASCADE"),
        nullable=False,
    )
    field_name = Column(String(100), nullable=False)
    # Valid field_name values (from product spec):
    # subject, environment, composition, lighting, style,
    # camera_or_render, mood, color_palette, negative_prompt,
    # model_parameters, reference_inputs, notes_and_rationale
    field_value = Column(Text, nullable=False)
    source_type = Column(
        Enum(ContextSource, name="contextsource"),
        default=ContextSource.user,
        nullable=False,
    )
    confidence = Column(Float, nullable=True)  # 0.0–1.0, only set for ai_parsed blocks
    sort_order = Column(Integer, default=0, nullable=False)

    prompt = relationship("Prompt", back_populates="context_blocks")

    __table_args__ = (
        Index("ix_context_blocks_prompt", "prompt_id"),
    )


# ──────────────────────────────────────────────────────────
# PROMPT VERSIONS
# A compiled model-specific export of a prompt's context.
# ──────────────────────────────────────────────────────────

class PromptVersion(Base, TimestampMixin):
    __tablename__ = "prompt_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompts.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_no = Column(Integer, nullable=False)
    adapter_family = Column(
        Enum(AdapterFamily, name="adapterfamily"), nullable=False
    )
    compiled_prompt = Column(Text, nullable=False)
    compile_notes = Column(Text, nullable=True)

    prompt = relationship("Prompt", back_populates="versions")

    __table_args__ = (
        Index("ix_versions_prompt", "prompt_id"),
    )


# ──────────────────────────────────────────────────────────
# PROMPT IMAGES
# Output images uploaded alongside a prompt.
# Actual file stored in Supabase Storage; only URL lives here.
# ──────────────────────────────────────────────────────────

class PromptImage(Base):
    __tablename__ = "prompt_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompts.id", ondelete="CASCADE"),
        nullable=False,
    )
    image_url = Column(String(500), nullable=False)
    alt_text = Column(String(300), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)

    prompt = relationship("Prompt", back_populates="images")

    __table_args__ = (
        Index("ix_images_prompt", "prompt_id"),
    )
