"""prompts: composite index for feed (status, share_to_feed, created_at)

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-03-20

"""
from typing import Sequence, Union

from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_prompts_feed "
        "ON prompts (status, share_to_feed, created_at DESC)"
    )


def downgrade() -> None:
    op.drop_index("ix_prompts_feed", table_name="prompts", if_exists=True)
