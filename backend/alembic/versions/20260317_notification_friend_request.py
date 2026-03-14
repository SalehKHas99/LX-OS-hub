"""add notification type friend_request

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-03-17

"""
from typing import Sequence, Union

from alembic import op

revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "a3b4c5d6e7f8"
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
                    WHERE t.typname = 'notificationtype' AND e.enumlabel = 'friend_request'
                ) THEN
                    ALTER TYPE notificationtype ADD VALUE 'friend_request';
                END IF;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    pass
