"""
Pytest configuration and shared fixtures for backend tests
"""

import sys
from unittest.mock import MagicMock

# Mock heavy ML libraries that may have C extension issues
faiss_mock = MagicMock()
sys.modules.setdefault('faiss', faiss_mock)

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.config import settings

# Disable rate limiting and 2FA requirement for test suite
settings.RATE_LIMIT_ENABLED = False
settings.ENABLE_2FA = False

TEST_DATABASE_URL = "sqlite+aiosqlite:///./data/test_neuralchat.db"
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create tables before each test, drop after. Also clear token blacklist."""
    from app.utils.auth import _blacklisted_tokens
    _blacklisted_tokens.clear()
    
    async with test_engine.begin() as conn:
        import app.models  # noqa: register all models
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
