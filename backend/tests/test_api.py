"""
Tests for NeuralChat API v2.0
Covers: auth endpoints (incl. refresh, logout, change-password),
chat session CRUD, pagination, feedback, export, search, health check

Uses a test SQLite database and mocks the FAISS/ML imports
that may not be available in all environments.
"""

import sys
from unittest.mock import MagicMock

# Mock heavy ML libraries that may have C extension issues
# These are only used by rag_service which isn't tested here
faiss_mock = MagicMock()
sys.modules.setdefault('faiss', faiss_mock)

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.config import settings

# Disable rate limiting for tests
settings.RATE_LIMIT_ENABLED = False


# ─── Test database setup ────────────────────────────────────────────
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
    # Clear in-memory token blacklist between tests
    from app.utils.auth import _blacklisted_tokens
    _blacklisted_tokens.clear()
    
    async with test_engine.begin() as conn:
        from app.models import user, chat  # noqa: register models
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ─── Helpers ─────────────────────────────────────────────────────────
async def register_user(client: AsyncClient, email="test@example.com", username="testuser", password="secret123"):
    return await client.post("/api/auth/register", json={
        "email": email,
        "username": username,
        "password": password
    })


async def login_user(client: AsyncClient, email="test@example.com", password="secret123"):
    return await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


# ─── Health Check ────────────────────────────────────────────────────
class TestHealthCheck:
    @pytest.mark.anyio
    async def test_root(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        assert resp.json()["message"] == "Wonder AI API is running"
        assert resp.json()["version"] == "2.0.0"

    @pytest.mark.anyio
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"
        assert "provider" in resp.json()


# ─── Auth ────────────────────────────────────────────────────────────
class TestAuth:
    @pytest.mark.anyio
    async def test_register_success(self, client):
        resp = await register_user(client)
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "test@example.com"
        assert data["user"]["username"] == "testuser"

    @pytest.mark.anyio
    async def test_register_duplicate_email(self, client):
        await register_user(client)
        resp = await register_user(client)
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"]

    @pytest.mark.anyio
    async def test_register_duplicate_username(self, client):
        await register_user(client, email="a@test.com", username="testuser")
        resp = await register_user(client, email="b@test.com", username="testuser")
        assert resp.status_code == 400
        assert "already taken" in resp.json()["detail"]

    @pytest.mark.anyio
    async def test_register_short_password(self, client):
        resp = await register_user(client, password="123")
        assert resp.status_code == 422  # validation error

    @pytest.mark.anyio
    async def test_register_invalid_username(self, client):
        resp = await register_user(client, username="bad user name!")
        assert resp.status_code == 422  # validation error

    @pytest.mark.anyio
    async def test_login_success(self, client):
        await register_user(client)
        resp = await login_user(client)
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "test@example.com"

    @pytest.mark.anyio
    async def test_login_wrong_password(self, client):
        await register_user(client)
        resp = await login_user(client, password="wrong")
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_login_nonexistent_user(self, client):
        resp = await login_user(client, email="nobody@example.com")
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_me_endpoint(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        resp = await client.get("/api/auth/me", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@example.com"

    @pytest.mark.anyio
    async def test_me_no_token(self, client):
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_refresh_token(self, client):
        reg = await register_user(client)
        refresh_token = reg.json()["refresh_token"]
        resp = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        assert "token" in resp.json()

    @pytest.mark.anyio
    async def test_refresh_with_invalid_token(self, client):
        resp = await client.post("/api/auth/refresh", json={"refresh_token": "invalid"})
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_logout(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        # Logout
        resp = await client.post("/api/auth/logout", headers=auth_headers(token))
        assert resp.status_code == 200
        # Token should now be invalid
        resp = await client.get("/api/auth/me", headers=auth_headers(token))
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_change_password(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        resp = await client.post("/api/auth/change-password",
            json={"current_password": "secret123", "new_password": "newsecret456"},
            headers=auth_headers(token))
        assert resp.status_code == 200
        # Login with new password
        resp = await login_user(client, password="newsecret456")
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_change_password_wrong_current(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        resp = await client.post("/api/auth/change-password",
            json={"current_password": "wrongpassword", "new_password": "newsecret456"},
            headers=auth_headers(token))
        assert resp.status_code == 400


# ─── Chat Sessions ──────────────────────────────────────────────────
class TestChatSessions:
    @pytest.mark.anyio
    async def test_create_session(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        resp = await client.post("/api/chat/sessions",
            json={"title": "Test Chat", "mode": "default", "model": "gpt-4o-mini", "temperature": 0.7},
            headers=auth_headers(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Test Chat"
        assert data["mode"] == "default"
        assert "id" in data

    @pytest.mark.anyio
    async def test_list_sessions(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        headers = auth_headers(token)

        # Create 2 sessions
        await client.post("/api/chat/sessions", json={"title": "Chat 1"}, headers=headers)
        await client.post("/api/chat/sessions", json={"title": "Chat 2"}, headers=headers)

        resp = await client.get("/api/chat/sessions", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    @pytest.mark.anyio
    async def test_list_sessions_pagination(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        headers = auth_headers(token)

        for i in range(5):
            await client.post("/api/chat/sessions", json={"title": f"Chat {i}"}, headers=headers)

        resp = await client.get("/api/chat/sessions?limit=2&offset=0", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

        resp = await client.get("/api/chat/sessions?limit=2&offset=3", headers=headers)
        assert len(resp.json()) == 2

    @pytest.mark.anyio
    async def test_delete_session(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        headers = auth_headers(token)

        create_resp = await client.post("/api/chat/sessions", json={"title": "To Delete"}, headers=headers)
        session_id = create_resp.json()["id"]

        del_resp = await client.delete(f"/api/chat/sessions/{session_id}", headers=headers)
        assert del_resp.status_code == 200

        # Verify it's gone
        list_resp = await client.get("/api/chat/sessions", headers=headers)
        assert len(list_resp.json()) == 0

    @pytest.mark.anyio
    async def test_update_session(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        headers = auth_headers(token)

        create_resp = await client.post("/api/chat/sessions", json={"title": "Original"}, headers=headers)
        session_id = create_resp.json()["id"]

        patch_resp = await client.patch(f"/api/chat/sessions/{session_id}",
            json={"title": "Updated Title", "mode": "writer"},
            headers=headers)
        assert patch_resp.status_code == 200

    @pytest.mark.anyio
    async def test_get_messages_empty_session(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        headers = auth_headers(token)

        create_resp = await client.post("/api/chat/sessions", json={"title": "Empty"}, headers=headers)
        session_id = create_resp.json()["id"]

        msgs_resp = await client.get(f"/api/chat/sessions/{session_id}/messages", headers=headers)
        assert msgs_resp.status_code == 200
        assert msgs_resp.json() == []

    @pytest.mark.anyio
    async def test_delete_nonexistent_session(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        headers = auth_headers(token)

        resp = await client.delete("/api/chat/sessions/nonexistent-id", headers=headers)
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_sessions_isolated_per_user(self, client):
        """User A's sessions shouldn't be visible to User B"""
        reg_a = await register_user(client, email="a@test.com", username="usera")
        reg_b = await register_user(client, email="b@test.com", username="userb")
        headers_a = auth_headers(reg_a.json()["token"])
        headers_b = auth_headers(reg_b.json()["token"])

        await client.post("/api/chat/sessions", json={"title": "A's Chat"}, headers=headers_a)

        resp_b = await client.get("/api/chat/sessions", headers=headers_b)
        assert len(resp_b.json()) == 0

    @pytest.mark.anyio
    async def test_export_session(self, client):
        reg = await register_user(client)
        token = reg.json()["token"]
        headers = auth_headers(token)

        create_resp = await client.post("/api/chat/sessions", json={"title": "Export Test"}, headers=headers)
        session_id = create_resp.json()["id"]

        # Export as JSON
        resp = await client.get(f"/api/chat/sessions/{session_id}/export?format=json", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["session"]["title"] == "Export Test"

        # Export as markdown
        resp = await client.get(f"/api/chat/sessions/{session_id}/export?format=markdown", headers=headers)
        assert resp.status_code == 200
        assert "content" in resp.json()

    @pytest.mark.anyio
    async def test_search_messages_empty(self, client):
        reg = await register_user(client, email="searchuser@example.com", username="searchuser")
        assert reg.status_code == 200, f"Registration failed: {reg.text}"
        token = reg.json()["token"]
        headers = auth_headers(token)

        resp = await client.get("/api/chat/search?q=hello", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []
