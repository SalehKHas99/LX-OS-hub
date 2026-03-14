"""prompt_votes, comment_votes, comment.vote_score, notification types for comment vote

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Comment vote_score column
    op.add_column("comments", sa.Column("vote_score", sa.Integer(), nullable=False, server_default="0"))

    # Prompt votes
    op.create_table(
        "prompt_votes",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prompt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["prompt_id"], ["prompts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "prompt_id"),
    )
    op.create_index("ix_prompt_votes_prompt_id", "prompt_votes", ["prompt_id"])

    # Comment votes
    op.create_table(
        "comment_votes",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("comment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "comment_id"),
    )
    op.create_index("ix_comment_votes_comment_id", "comment_votes", ["comment_id"])

    # Notification enum: comment_upvote, comment_downvote
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                           WHERE t.typname = 'notificationtype' AND e.enumlabel = 'comment_upvote') THEN
                ALTER TYPE notificationtype ADD VALUE 'comment_upvote';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                           WHERE t.typname = 'notificationtype' AND e.enumlabel = 'comment_downvote') THEN
                ALTER TYPE notificationtype ADD VALUE 'comment_downvote';
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_comment_votes_comment_id", table_name="comment_votes")
    op.drop_table("comment_votes")
    op.drop_index("ix_prompt_votes_prompt_id", table_name="prompt_votes")
    op.drop_table("prompt_votes")
    op.drop_column("comments", "vote_score")
