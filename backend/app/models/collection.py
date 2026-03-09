import uuid

from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class Collection(Base, TimestampMixin):
    __tablename__ = "collections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    owner = relationship("User", back_populates="collections")
    items = relationship(
        "CollectionItem",
        back_populates="collection",
        cascade="all, delete-orphan",
        order_by="CollectionItem.sort_order",
    )


class CollectionItem(Base):
    __tablename__ = "collection_items"

    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collections.id", ondelete="CASCADE"),
        primary_key=True,
    )
    prompt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sort_order = Column(Integer, default=0, nullable=False)

    collection = relationship("Collection", back_populates="items")
    prompt = relationship("Prompt", back_populates="collection_items")
