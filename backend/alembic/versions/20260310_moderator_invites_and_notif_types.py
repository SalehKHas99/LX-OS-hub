"""moderator_invites table and notification types moderator_invite, prompt_upvote, prompt_downvote

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-03-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "moderator_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invited_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_moderator_invites_community_user", "moderator_invites", ["community_id", "user_id"], unique=False)

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificationtype') THEN
                IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'notificationtype' AND e.enumlabel = 'moderator_invite') THEN
                    ALTER TYPE notificationtype ADD VALUE 'moderator_invite';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'notificationtype' AND e.enumlabel = 'prompt_upvote') THEN
                    ALTER TYPE notificationtype ADD VALUE 'prompt_upvote';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'notificationtype' AND e.enumlabel = 'prompt_downvote') THEN
                    ALTER TYPE notificationtype ADD VALUE 'prompt_downvote';
                END IF;
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_moderator_invites_community_user", table_name="moderator_invites")
    op.drop_table("moderator_invites")
    # Enum values are not removed in PostgreSQL downgrade
    pass
