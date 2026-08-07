"""
Database setup using SQLAlchemy async engine.
Supports PostgreSQL (production via asyncpg) and SQLite (local dev via aiosqlite).
The driver is auto-detected from the DATABASE_URL scheme.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


def _build_engine():
    """Create the async engine with driver-appropriate settings."""
    url = settings.DATABASE_URL

    # PostgreSQL gets connection pooling; SQLite does not support it
    if url.startswith("postgresql"):
        return create_async_engine(
            url,
            echo=settings.DEBUG,
            pool_size=15,              # Max persistent connections
            max_overflow=30,           # Max temporary burst connections
            pool_pre_ping=True,        # Detect stale connections before checkout
            pool_recycle=300,          # Recycle connections every 5 min to prevent server timeouts
        )
    else:
        # SQLite / other — no pool args
        return create_async_engine(url, echo=settings.DEBUG)


engine = _build_engine()
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _auto_migrate(connection):
    from sqlalchemy import inspect, text
    inspector = inspect(connection)
    is_postgres = connection.dialect.name.startswith("postgres")
    datetime_type = "TIMESTAMP" if is_postgres else "DATETIME"
    json_type = "JSON" if is_postgres else "JSON"

    if inspector.has_table("users"):
        existing_cols = {col["name"] for col in inspector.get_columns("users")}
        if "full_name" not in existing_cols:
            connection.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR"))
        if "avatar_url" not in existing_cols:
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR"))
        if "updated_at" not in existing_cols:
            connection.execute(text(f"ALTER TABLE users ADD COLUMN updated_at {datetime_type}"))
        if "role" not in existing_cols:
            connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user'"))
        if "tier" not in existing_cols:
            connection.execute(text("ALTER TABLE users ADD COLUMN tier VARCHAR DEFAULT 'free'"))
        if "auth_provider" not in existing_cols:
            connection.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR DEFAULT 'local'"))
        if "preferences" not in existing_cols:
            connection.execute(text(f"ALTER TABLE users ADD COLUMN preferences {json_type}"))
        if "last_login_at" not in existing_cols:
            connection.execute(text(f"ALTER TABLE users ADD COLUMN last_login_at {datetime_type}"))
    # Auto-migrate: add agent_id to chat_sessions if missing
    if inspector.has_table("chat_sessions"):
        session_cols = {col["name"] for col in inspector.get_columns("chat_sessions")}
        if "agent_id" not in session_cols:
            connection.execute(text("ALTER TABLE chat_sessions ADD COLUMN agent_id VARCHAR"))


async def init_db():
    """Create all tables on startup and apply migrations"""
    async with engine.begin() as conn:
        from app.models import user, chat, session_document, agent  # noqa: import models to register them
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_auto_migrate)


async def get_db():
    """Dependency injector for database sessions"""
    async with AsyncSessionLocal() as session:
        yield session
