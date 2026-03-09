import uuid

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base


class Tag(Base):
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True)
    # category examples: "style", "model", "mood", "technique"

    prompt_tags = relationship("PromptTag", back_populates="tag")


class PromptTag(Base):
    __tablename__ = "prompt_tags"

    prompt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )

    prompt = relationship("Prompt", back_populates="prompt_tags")
    tag = relationship("Tag", back_populates="prompt_tags")
