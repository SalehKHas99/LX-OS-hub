"""friends, blocks, conversation_acceptance, notification type message_request

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificationtype') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                    WHERE t.typname = 'notificationtype' AND e.enumlabel = 'message_request'
                ) THEN
                    ALTER TYPE notificationtype ADD VALUE 'message_request';
                END IF;
            END IF;
        END $$;
        """
    )

    op.create_table(
        "friendships",
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("addressee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["addressee_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("requester_id", "addressee_id"),
        sa.CheckConstraint("requester_id != addressee_id", name="friendships_no_self"),
    )
    op.create_index("ix_friendships_addressee_status", "friendships", ["addressee_id", "status"])
    op.create_index("ix_friendships_requester_status", "friendships", ["requester_id", "status"])

    op.create_table(
        "user_blocks",
        sa.Column("blocker_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["blocked_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["blocker_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("blocker_id", "blocked_id"),
        sa.CheckConstraint("blocker_id != blocked_id", name="user_blocks_no_self"),
    )
    op.create_index("ix_user_blocks_blocked", "user_blocks", ["blocked_id"])

    op.create_table(
        "conversation_acceptance",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("other_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["other_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "other_user_id"),
        sa.CheckConstraint("user_id != other_user_id", name="conversation_acceptance_no_self"),
    )
    op.create_index("ix_conversation_acceptance_other", "conversation_acceptance", ["other_user_id"])

    # Backfill: existing message pairs count as accepted by both sides
    op.execute(
        """
        INSERT INTO conversation_acceptance (user_id, other_user_id, accepted_at)
        SELECT m.sender_id, m.recipient_id, MIN(m.created_at)
        FROM messages m
        GROUP BY m.sender_id, m.recipient_id
        ON CONFLICT (user_id, other_user_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO conversation_acceptance (user_id, other_user_id, accepted_at)
        SELECT m.recipient_id, m.sender_id, MIN(m.created_at)
        FROM messages m
        GROUP BY m.recipient_id, m.sender_id
        ON CONFLICT (user_id, other_user_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_conversation_acceptance_other", table_name="conversation_acceptance")
    op.drop_table("conversation_acceptance")
    op.drop_index("ix_user_blocks_blocked", table_name="user_blocks")
    op.drop_table("user_blocks")
    op.drop_index("ix_friendships_requester_status", table_name="friendships")
    op.drop_index("ix_friendships_addressee_status", table_name="friendships")
    op.drop_table("friendships")
    # Enum value message_request left in place (PostgreSQL doesn't support remove)
