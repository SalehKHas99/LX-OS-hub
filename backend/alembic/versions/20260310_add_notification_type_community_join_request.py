"""add notification type community_join_request

Revision ID: d1e2f3a4b5c6
Revises: cfebf2c278e4
Create Date: 2026-03-10

Adds 'community_join_request' to the notificationtype enum if the notifications
table and enum exist (e.g. created by SQLAlchemy create_all). Safe to run if
the value already exists or the table does not use an enum.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "cfebf2c278e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the new enum value for PostgreSQL. Safe if type or value already exists.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificationtype') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON e.enumtypid = t.oid
                    WHERE t.typname = 'notificationtype' AND e.enumlabel = 'community_join_request'
                ) THEN
                    ALTER TYPE notificationtype ADD VALUE 'community_join_request';
                END IF;
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # PostgreSQL does not support removing an enum value easily; leave as-is.
    pass
