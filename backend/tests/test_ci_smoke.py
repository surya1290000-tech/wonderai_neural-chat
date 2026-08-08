"""
CI Health & Smoke Tests
Lightweight tests that run without heavy ML dependencies (torch, faiss, etc.)
Tests core API functionality: auth, chat sessions, health check
"""
import sys
from unittest.mock import MagicMock

# Mock ALL heavy ML/AI libs before any app import
for mod in ['faiss', 'sentence_transformers', 'torch', 'numpy',
            'pdfplumber', 'docx', 'pgvector']:
    sys.modules.setdefault(mod, MagicMock())

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.config import settings

# Disable rate limiting and 2FA for tests
settings.RATE_LIMIT_ENABLED = False
settings.ENABLE_2FA = False

# In-memory SQLite for CI (no disk, no postgres needed)
TEST_DB = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB, echo=False, connect_args={"check_same_thread": False})
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


async def override_get_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    from app.utils.auth import _blacklisted_tokens
    _blacklisted_tokens.clear()
    async with test_engine.begin() as conn:
        import app.models  # noqa
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def register(client, email="test@example.com", username="testuser", password="Test1234!"):
    return await client.post("/api/auth/register", json={
        "email": email, "username": username, "password": password
    })


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ─── Health Check ─────────────────────────────────────────────────────────────

class TestHealth:
    async def test_root_endpoint(self, client):
        r = await client.get("/")
        assert r.status_code == 200
        assert "Wonder AI" in r.json().get("message", "")

    async def test_health_endpoint(self, client):
        r = await client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


# ─── Authentication ───────────────────────────────────────────────────────────

class TestAuth:
    async def test_register_success(self, client):
        r = await register(client, "ci_reg@example.com", "ci_reg")
        assert r.status_code == 200
        assert "token" in r.json()

    async def test_register_duplicate_email(self, client):
        await register(client, "dup@example.com", "dupuser1")
        r = await register(client, "dup@example.com", "dupuser2")
        assert r.status_code == 400

    async def test_login_success(self, client):
        await register(client, "ci_login@example.com", "ci_login")
        r = await client.post("/api/auth/login", json={
            "email": "ci_login@example.com", "password": "Test1234!"
        })
        assert r.status_code == 200
        assert "token" in r.json()

    async def test_login_wrong_password(self, client):
        await register(client, "ci_wrongpw@example.com", "ci_wrongpw")
        r = await client.post("/api/auth/login", json={
            "email": "ci_wrongpw@example.com", "password": "WrongPass!"
        })
        assert r.status_code == 401

    async def test_me_endpoint(self, client):
        r = await register(client, "ci_me@example.com", "ci_me")
        token = r.json()["token"]
        me = await client.get("/api/auth/me", headers=auth_headers(token))
        assert me.status_code == 200
        assert me.json()["email"] == "ci_me@example.com"

    async def test_unauthenticated_me(self, client):
        r = await client.get("/api/auth/me")
        assert r.status_code == 401


# ─── Chat Sessions ────────────────────────────────────────────────────────────

class TestChatSessions:
    async def test_create_session(self, client):
        r = await register(client, "ci_chat@example.com", "ci_chat")
        token = r.json()["token"]
        sess = await client.post("/api/chat/sessions", json={"title": "CI Test"},
                                 headers=auth_headers(token))
        assert sess.status_code == 200
        assert "id" in sess.json()

    async def test_list_sessions(self, client):
        r = await register(client, "ci_list@example.com", "ci_list")
        token = r.json()["token"]
        headers = auth_headers(token)
        await client.post("/api/chat/sessions", json={"title": "Session A"}, headers=headers)
        await client.post("/api/chat/sessions", json={"title": "Session B"}, headers=headers)
        list_r = await client.get("/api/chat/sessions", headers=headers)
        assert list_r.status_code == 200
        assert len(list_r.json()) >= 2

    async def test_delete_session(self, client):
        r = await register(client, "ci_del@example.com", "ci_del")
        token = r.json()["token"]
        headers = auth_headers(token)
        sess = await client.post("/api/chat/sessions", json={"title": "To Delete"}, headers=headers)
        sid = sess.json()["id"]
        del_r = await client.delete(f"/api/chat/sessions/{sid}", headers=headers)
        assert del_r.status_code == 200
