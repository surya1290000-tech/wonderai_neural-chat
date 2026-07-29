"""
Tests for Audio Speech-to-Text (STT) Transcription API
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from tests.test_api import register_user, auth_headers


class TestAudioAPI:
    @pytest.mark.anyio
    async def test_transcribe_unauthenticated(self, client):
        resp = await client.post(
            "/api/audio/transcribe",
            files={"file": ("speech.webm", b"mock_audio_data", "audio/webm")}
        )
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_transcribe_no_openai_key(self, client):
        reg = await register_user(client, email="audio_nokey@example.com", username="audionokey")
        token = reg.json()["token"]
        headers = auth_headers(token)

        original_key = settings.OPENAI_API_KEY
        try:
            settings.OPENAI_API_KEY = ""
            resp = await client.post(
                "/api/audio/transcribe",
                files={"file": ("speech.webm", b"mock_audio_data", "audio/webm")},
                headers=headers
            )
            assert resp.status_code == 503
            assert "OpenAI API key not configured" in resp.json()["detail"]
        finally:
            settings.OPENAI_API_KEY = original_key

    @pytest.mark.anyio
    async def test_transcribe_invalid_extension(self, client):
        reg = await register_user(client, email="audio_invalid@example.com", username="audioinvalid")
        token = reg.json()["token"]
        headers = auth_headers(token)

        original_key = settings.OPENAI_API_KEY
        try:
            settings.OPENAI_API_KEY = "sk-test-key"
            resp = await client.post(
                "/api/audio/transcribe",
                files={"file": ("malicious.exe", b"invalid_data", "application/octet-stream")},
                headers=headers
            )
            assert resp.status_code == 400
            assert "Unsupported audio format" in resp.json()["detail"]
        finally:
            settings.OPENAI_API_KEY = original_key

    @pytest.mark.anyio
    @patch("app.routes.audio.AsyncOpenAI")
    async def test_transcribe_success(self, mock_openai_cls, client):
        reg = await register_user(client, email="audio_success@example.com", username="audiosuccess")
        token = reg.json()["token"]
        headers = auth_headers(token)

        # Mock OpenAI Whisper response
        mock_client = AsyncMock()
        mock_openai_cls.return_value = mock_client
        mock_response = AsyncMock()
        mock_response.text = "Hello Wonder AI, transcribe this audio recording."
        mock_client.audio.transcriptions.create.return_value = mock_response

        original_key = settings.OPENAI_API_KEY
        try:
            settings.OPENAI_API_KEY = "sk-mock-key"
            resp = await client.post(
                "/api/audio/transcribe",
                files={"file": ("speech.webm", b"mock_audio_content", "audio/webm")},
                headers=headers
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "success"
            assert resp.json()["text"] == "Hello Wonder AI, transcribe this audio recording."
        finally:
            settings.OPENAI_API_KEY = original_key
