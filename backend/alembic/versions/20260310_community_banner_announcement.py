"""add community banner_url, announcement, show_owner_badge

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-03-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, None] = "a4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("communities", sa.Column("banner_url", sa.String(500), nullable=True))
    op.add_column("communities", sa.Column("announcement", sa.Text(), nullable=True))
    op.add_column(
        "communities",
        sa.Column("show_owner_badge", sa.String(10), nullable=True, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("communities", "show_owner_badge")
    op.drop_column("communities", "announcement")
    op.drop_column("communities", "banner_url")
