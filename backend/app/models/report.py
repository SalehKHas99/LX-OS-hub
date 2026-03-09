import enum
import uuid

from sqlalchemy import Column, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class ReportStatus(str, enum.Enum):
    pending = "pending"
    reviewed = "reviewed"
    resolved = "resolved"
    dismissed = "dismissed"


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50), nullable=False)
    # entity_type values: "prompt" | "comment" | "user"
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    reason = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(
        Enum(ReportStatus, name="reportstatus"),
        default=ReportStatus.pending,
        nullable=False,
    )
    assigned_to_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    reporter = relationship("User", back_populates="reports", foreign_keys=[reporter_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
