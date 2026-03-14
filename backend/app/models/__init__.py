# Import Base first so all models register against the same metadata.
# Import order matters: Base → enums-only → tables with no FKs → tables with FKs.

from .base import Base, TimestampMixin  # noqa: F401

# Core domain models
from .user import User, UserRole, ProfileVisibility  # noqa: F401
from .community import (  # noqa: F401
    Community,
    CommunityVisibility,
    CommunityJoinRequest,
    JoinRequestStatus,
    CommunityMember,
    CommunityMemberRole,
    ModeratorInvite,
    CommunityBan,
)
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
from .vote import PromptVote, CommentVote  # noqa: F401
from .saved_prompt import SavedPrompt  # noqa: F401
from .collection import Collection, CollectionItem  # noqa: F401
from .report import Report, ReportStatus  # noqa: F401
from .notification import Notification, NotificationType  # noqa: F401
from .message import Message  # noqa: F401
from .message_typing import MessageTyping  # noqa: F401
from .friendship import Friendship, UserBlock, ConversationAcceptance  # noqa: F401

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
