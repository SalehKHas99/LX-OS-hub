"""join_requests_and_members: owner_id, community_join_requests, community_members

Revision ID: a1b2c3d4e5f6
Revises: b1877c415232
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "b1877c415232"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "communities",
        sa.Column("owner_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_communities_owner_id_users",
        "communities",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_communities_owner_id"), "communities", ["owner_id"], unique=False)

    op.create_table(
        "community_join_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("community_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("reviewed_by_id", sa.UUID(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_community_join_requests_community_id"),
        "community_join_requests",
        ["community_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_community_join_requests_user_id"),
        "community_join_requests",
        ["user_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_community_join_request_community_user",
        "community_join_requests",
        ["community_id", "user_id"],
    )

    op.create_table(
        "community_members",
        sa.Column("community_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("community_id", "user_id"),
    )
    op.create_index(
        op.f("ix_community_members_community_id"),
        "community_members",
        ["community_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_community_members_user_id"),
        "community_members",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_community_members_user_id"), table_name="community_members")
    op.drop_index(op.f("ix_community_members_community_id"), table_name="community_members")
    op.drop_table("community_members")

    op.drop_constraint("uq_community_join_request_community_user", "community_join_requests", type_="unique")
    op.drop_index(op.f("ix_community_join_requests_user_id"), table_name="community_join_requests")
    op.drop_index(op.f("ix_community_join_requests_community_id"), table_name="community_join_requests")
    op.drop_table("community_join_requests")

    op.drop_constraint("fk_communities_owner_id_users", "communities", type_="foreignkey")
    op.drop_index(op.f("ix_communities_owner_id"), table_name="communities")
    op.drop_column("communities", "owner_id")
