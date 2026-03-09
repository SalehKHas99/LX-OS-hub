import enum
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index,
    Integer, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


# ──────────────────────────────────────────────────────────
# SITE SETTINGS
# Key/value store for all live site configuration.
# Changes take effect immediately — no redeploy needed.
# ──────────────────────────────────────────────────────────

class SiteSetting(Base, TimestampMixin):
    """
    Grouped setting keys:

    branding:
      site_name, site_tagline, logo_url, favicon_url,
      primary_color, accent_color, footer_text

    features:
      allow_registration, context_lab_enabled

    content:
      max_images_per_prompt

    operations:
      maintenance_mode
    """
    __tablename__ = "site_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    value_type = Column(String(20), nullable=False, default="string")
    # value_type: "string" | "boolean" | "integer" | "json" | "color" | "url"
    label = Column(String(200), nullable=True)
    group = Column(String(100), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    # is_public=True  → exposed to frontend on app load (theme colors, site name)
    # is_public=False → server-side only (feature flags, rate limits)
    updated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    updated_by = relationship("User", foreign_keys=[updated_by_id])


# ──────────────────────────────────────────────────────────
# ANNOUNCEMENTS
# Site-wide banners, notices, or modal alerts.
# ──────────────────────────────────────────────────────────

class AnnouncementType(str, enum.Enum):
    banner = "banner"    # sticky top-of-page bar
    notice = "notice"    # dismissible info card in feed
    modal = "modal"      # one-time popup on next visit


class AnnouncementAudience(str, enum.Enum):
    everyone = "everyone"
    logged_in = "logged_in"
    logged_out = "logged_out"


class Announcement(Base, TimestampMixin):
    __tablename__ = "announcements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=True)
    type = Column(
        Enum(AnnouncementType, name="announcementtype"),
        nullable=False,
        default=AnnouncementType.banner,
    )
    audience = Column(
        Enum(AnnouncementAudience, name="announcementaudience"),
        nullable=False,
        default=AnnouncementAudience.everyone,
    )
    is_active = Column(Boolean, default=False, nullable=False)
    is_dismissible = Column(Boolean, default=True, nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    cta_label = Column(String(100), nullable=True)   # e.g. "Read more"
    cta_url = Column(String(500), nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    created_by = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("ix_announcements_active", "is_active"),
    )


# ──────────────────────────────────────────────────────────
# FEATURED ITEMS
# Curated placements on homepage and explore page.
# Each row = one featured slot.
# ──────────────────────────────────────────────────────────

class FeaturedEntityType(str, enum.Enum):
    prompt = "prompt"
    community = "community"
    collection = "collection"


class FeaturedPlacement(str, enum.Enum):
    homepage_hero = "homepage_hero"             # large hero card
    homepage_grid = "homepage_grid"             # featured grid section
    explore_spotlight = "explore_spotlight"     # pinned to top of explore


class FeaturedItem(Base, TimestampMixin):
    __tablename__ = "featured_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False)   # FeaturedEntityType value
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    placement = Column(String(50), nullable=False)     # FeaturedPlacement value
    position = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    note = Column(Text, nullable=True)                 # internal editorial note
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    created_by = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("ix_featured_placement_active", "placement", "is_active"),
    )


# ──────────────────────────────────────────────────────────
# USER BANS
# Tracks all bans — temporary and permanent.
# Checked at the auth middleware layer on every request.
# ──────────────────────────────────────────────────────────

class UserBan(Base, TimestampMixin):
    __tablename__ = "user_bans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    banned_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    is_permanent = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # null = permanent
    is_active = Column(Boolean, default=True, nullable=False)
    lifted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    lifted_at = Column(DateTime(timezone=True), nullable=True)
    lift_reason = Column(Text, nullable=True)

    user = relationship("User", back_populates="bans", foreign_keys=[user_id])
    banned_by = relationship("User", foreign_keys=[banned_by_id])
    lifted_by = relationship("User", foreign_keys=[lifted_by_id])

    __table_args__ = (
        Index("ix_bans_user_active", "user_id", "is_active"),
    )


# ──────────────────────────────────────────────────────────
# AUDIT LOGS
# Immutable record of every admin and moderator action.
# NEVER update or delete rows in this table.
# ──────────────────────────────────────────────────────────

class AuditLog(Base):
    """
    action format: "resource.verb"

    Examples:
      user.ban          user.unban         user.role_change
      prompt.hide       prompt.restore     prompt.feature
      report.resolve    report.dismiss     report.assign
      setting.update    announcement.publish
      community.create  collection.delete
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    before_state = Column(JSONB, nullable=True)   # snapshot before change
    after_state = Column(JSONB, nullable=True)    # snapshot after change
    meta = Column(JSONB, nullable=True)           # IP, user agent, extra context
    created_at = Column(
        DateTime(timezone=True), nullable=False
        # Set explicitly in the audit service, not via server_default,
        # so the timestamp is always precise to the action.
    )

    actor = relationship("User", foreign_keys=[actor_id])

    __table_args__ = (
        Index("ix_audit_actor", "actor_id"),
        Index("ix_audit_entity", "entity_type", "entity_id"),
        Index("ix_audit_created", "created_at"),
    )


# ──────────────────────────────────────────────────────────
# ADMIN NOTES
# Internal moderator notes attached to any entity.
# Never visible to regular users.
# ──────────────────────────────────────────────────────────

class AdminNote(Base, TimestampMixin):
    __tablename__ = "admin_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50), nullable=False)  # "user" | "prompt" | "comment"
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    content = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)

    author = relationship("User", foreign_keys=[author_id])

    __table_args__ = (
        Index("ix_admin_notes_entity", "entity_type", "entity_id"),
    )
