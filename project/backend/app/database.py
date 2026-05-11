"""
Database setup using SQLAlchemy async with SQLite
Stores chat history, sessions, and user data
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def init_db():
    """Create all tables on startup"""
    async with engine.begin() as conn:
        from app.models import user, chat  # noqa: import models to register them
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    """Dependency injector for database sessions"""
    async with AsyncSessionLocal() as session:
        yield session
