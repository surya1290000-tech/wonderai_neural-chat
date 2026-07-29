"""
Tests for User Token Usage & Analytics API
"""

import pytest
from httpx import AsyncClient
from tests.test_api import register_user, auth_headers


class TestAnalyticsAPI:
    @pytest.mark.anyio
    async def test_analytics_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/analytics/usage")
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_analytics_usage_success(self, client: AsyncClient):
        reg = await register_user(client, email="analytics_user@example.com", username="analyticsuser")
        assert reg.status_code == 200
        token = reg.json()["token"]
        headers = auth_headers(token)

        # Create a session
        sess_resp = await client.post("/api/chat/sessions", json={"title": "Analytics Test Session"}, headers=headers)
        assert sess_resp.status_code == 200

        # Query analytics endpoint
        resp = await client.get("/api/analytics/usage", headers=headers)
        assert resp.status_code == 200

        data = resp.json()
        assert data["username"] == "analyticsuser"
        assert data["email"] == "analytics_user@example.com"
        assert "metrics" in data
        assert "rate_limits" in data

        metrics = data["metrics"]
        assert metrics["total_sessions"] == 1
        assert metrics["estimated_total_tokens"] >= 0
        assert "standard" in data["rate_limits"]
        assert "chat_stream" in data["rate_limits"]
        assert "image_gen" in data["rate_limits"]
        assert "auth" in data["rate_limits"]
