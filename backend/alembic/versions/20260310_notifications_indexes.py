"""add notifications indexes for list query

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-03-10

Adds composite indexes so list_notifications uses an index scan
instead of a full table scan + sort. Run after notifications table exists.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Index for: WHERE user_id = ? ORDER BY created_at DESC LIMIT N
    op.create_index(
        "ix_notifications_user_created",
        "notifications",
        ["user_id", "created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC NULLS LAST"},
    )
    # Index for: WHERE user_id = ? AND is_read = ? ORDER BY created_at DESC LIMIT N
    op.create_index(
        "ix_notifications_user_read_created",
        "notifications",
        ["user_id", "is_read", "created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC NULLS LAST"},
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_read_created", table_name="notifications")
    op.drop_index("ix_notifications_user_created", table_name="notifications")
