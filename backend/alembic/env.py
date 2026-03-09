"""
Alembic environment configuration.
Uses async SQLAlchemy engine to match the FastAPI application layer.
"""
import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# ── Make sure app package is importable ──────────────────────────────────────
# This adds /backend to sys.path so `from app.models import Base` works
# regardless of where you run `alembic` from.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Import all models so Alembic can see them ─────────────────────────────────
# Importing the package-level __init__ pulls in every model class.
from app.models import Base  # noqa: E402
from app.config.settings import settings  # noqa: E402

# ── Standard Alembic setup ────────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ── Offline migrations ────────────────────────────────────────────────────────
# Generates SQL without a live DB connection.
# Useful for reviewing what will run before applying.

def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Required for Postgres enums to be created correctly
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online migrations ─────────────────────────────────────────────────────────
# Connects to the real database and applies migrations.

def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.DATABASE_URL)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


# ── Entry point ───────────────────────────────────────────────────────────────

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
