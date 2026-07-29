"""
Audio processing & Speech-to-Text (STT) route module using OpenAI Whisper
"""

import os
import tempfile
import logging
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from openai import AsyncOpenAI

from app.config import settings
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger("wonderai.audio")
router = APIRouter()

ALLOWED_AUDIO_EXTENSIONS = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4"}


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Transcribe uploaded audio file using OpenAI Whisper API.
    Supports .webm, .wav, .mp3, .m4a, .ogg audio formats.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if not ext and file.content_type:
        if "webm" in file.content_type:
            ext = ".webm"
        elif "wav" in file.content_type:
            ext = ".wav"
        elif "mp3" in file.content_type or "mpeg" in file.content_type:
            ext = ".mp3"
        elif "ogg" in file.content_type:
            ext = ".ogg"

    if ext and ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format: {ext}. Allowed: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}"
        )

    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured for Whisper transcription."
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio file provided."
        )

    # Save to temp file for OpenAI SDK transmission
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext or ".webm") as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        with open(tmp_path, "rb") as audio_file:
            transcript_response = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )

        text = transcript_response.text.strip()
        logger.info(f"Audio transcribed successfully for user {current_user.id}: {len(text)} chars")
        return {"text": text, "status": "success"}

    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audio transcription failed: {str(e)}"
        )
    finally:
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
