"""messages + friendships: composite indexes for conversation list and friend lists

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op

revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Conversation list: order by created_at filtered by sender or recipient (IF NOT EXISTS for idempotency)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_messages_sender_created ON messages (sender_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_messages_recipient_created ON messages (recipient_id, created_at DESC)"
    )
    # Friendships: list by requester or addressee and filter by status
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_friendships_requester_status ON friendships (requester_id, status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_friendships_addressee_status ON friendships (addressee_id, status)"
    )


def downgrade() -> None:
    op.drop_index("ix_friendships_addressee_status", table_name="friendships", if_exists=True)
    op.drop_index("ix_friendships_requester_status", table_name="friendships", if_exists=True)
    op.drop_index("ix_messages_recipient_created", table_name="messages", if_exists=True)
    op.drop_index("ix_messages_sender_created", table_name="messages", if_exists=True)
