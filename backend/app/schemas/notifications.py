from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: UUID
    notification_type: str
    entity_type: str
    entity_id: UUID
    entity_slug: Optional[str] = None  # for community links, e.g. /c/{slug}
    prompt_id: Optional[UUID] = None  # when entity_type is "comment", prompt for link
    message: str
    is_read: bool
    created_at: datetime
    actor_username: Optional[str] = None

    model_config = {"from_attributes": True}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        