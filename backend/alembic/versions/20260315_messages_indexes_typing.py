"""messages: add unread index + typing indicator table for instant messaging

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fast unread count: index (recipient_id, read_at) for WHERE recipient_id=X AND read_at IS NULL
    op.create_index(
        "ix_messages_recipient_read_at",
        "messages",
        ["recipient_id", "read_at"],
        postgresql_where=sa.text("read_at IS NULL"),
    )
    # Typing indicator: who is typing in conversation with whom; expires after ~10s if not refreshed
    op.create_table(
        "message_typing",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("other_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["other_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "other_user_id"),
    )
    op.create_index(
        "ix_message_typing_other_updated",
        "message_typing",
        ["other_user_id", "updated_at"],
        postgresql_ops={"updated_at": "DESC"},
    )


def downgrade() -> None:
    op.drop_index("ix_message_typing_other_updated", table_name="message_typing")
    op.drop_table("message_typing")
    op.drop_index("ix_messages_recipient_read_at", table_name="messages")
