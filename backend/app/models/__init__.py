# Import Base first so all models register against the same metadata.
# Import order matters: Base → enums-only → tables with no FKs → tables with FKs.

from .base import Base, TimestampMixin  # noqa: F401

# Core domain models
from .user import User, UserRole, ProfileVisibility  # noqa: F401
from .community import Community, CommunityVisibility  # noqa: F401
from .prompt import (  # noqa: F401
    Prompt,
    PromptContextBlock,
    PromptVersion,
    PromptImage,
    ModelFamily,
    PromptStatus,
    AdapterFamily,
    ContextSource,
)
from .tag import Tag, PromptTag  # noqa: F401
from .comment import Comment, ModerationState  # noqa: F401
from .collection import Collection, CollectionItem  # noqa: F401
from .report import Report, ReportStatus  # noqa: F401

# Admin models
from .admin import (  # noqa: F401
    SiteSetting,
    Announcement,
    AnnouncementType,
    AnnouncementAudience,
    FeaturedItem,
    FeaturedEntityType,
    FeaturedPlacement,
    UserBan,
    AuditLog,
    AdminNote,
)
