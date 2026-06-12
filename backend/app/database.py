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
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,        # detect stale connections
            pool_recycle=300,           # recycle connections every 5 min
        )
    else:
        # SQLite / other — no pool args
        return create_async_engine(url, echo=settings.DEBUG)


engine = _build_engine()
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all tables on startup"""
    async with engine.begin() as conn:
        from app.models import user, chat, session_document  # noqa: import models to register them
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """Dependency injector for database sessions"""
    async with AsyncSessionLocal() as session:
        yield session
