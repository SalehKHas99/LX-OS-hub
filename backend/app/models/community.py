import enum
import uuid

from sqlalchemy import Column, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class CommunityVisibility(str, enum.Enum):
    public = "public"
    restricted = "restricted"


class Community(Base, TimestampMixin):
    __tablename__ = "communities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    rules = Column(Text, nullable=True)
    visibility = Column(
        Enum(CommunityVisibility, name="communityvisibility"),
        default=CommunityVisibility.public,
        nullable=False,
    )

    # Relationships
    prompts = relationship("Prompt", back_populates="community")
