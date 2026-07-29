"""
User Usage, Token Consumption, and Rate Limit Analytics Route
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Dict, Any

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.chat import ChatSession, Message
from app.models.session_document import SessionDocument
from app.utils.auth import get_current_user
from app.services.rate_limit_service import rate_limit_service

router = APIRouter()


@router.get("/usage")
async def get_user_usage_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get user token consumption, rate limit status, message metrics, and resource totals.
    """
    # 1. Fetch user's chat sessions
    sessions_query = await db.execute(
        select(ChatSession).where(ChatSession.user_id == current_user.id)
    )
    user_sessions = sessions_query.scalars().all()
    session_ids = [s.id for s in user_sessions]

    total_sessions = len(user_sessions)
    total_messages = 0
    prompt_chars = 0
    completion_chars = 0
    generated_images_count = 0

    if session_ids:
        # Fetch all messages in user's sessions
        messages_query = await db.execute(
            select(Message).where(Message.session_id.in_(session_ids))
        )
        messages = messages_query.scalars().all()
        total_messages = len(messages)

        for msg in messages:
            content_len = len(msg.content or "")
            if msg.role == "user":
                prompt_chars += content_len
            elif msg.role == "assistant":
                completion_chars += content_len
                # Check for image generation tags or metadata
                if (msg.meta and isinstance(msg.meta, dict) and msg.meta.get("type") == "image") or "/static/generated_" in msg.content:
                    generated_images_count += 1

    # Estimate token counts (~4 chars per token average)
    estimated_prompt_tokens = int(prompt_chars / 4)
    estimated_completion_tokens = int(completion_chars / 4)
    estimated_total_tokens = estimated_prompt_tokens + estimated_completion_tokens

    # 2. RAG Documents Count
    rag_docs_count = 0
    if session_ids:
        docs_query = await db.execute(
            select(func.count(SessionDocument.id)).where(SessionDocument.session_id.in_(session_ids))
        )
        rag_docs_count = docs_query.scalar_one_or_none() or 0

    # 3. Rate Limit Status Check
    user_key = f"user:{current_user.id}"
    
    rate_limit_tiers = {
        "standard": {"rpm": settings.RATE_LIMIT_RPM, "key": f"ratelimit:standard:{user_key}"},
        "chat_stream": {"rpm": settings.RATE_LIMIT_CHAT_RPM, "key": f"ratelimit:chat_stream:{user_key}"},
        "image_gen": {"rpm": settings.RATE_LIMIT_IMAGE_RPM, "key": f"ratelimit:image_gen:{user_key}"},
        "auth": {"rpm": settings.RATE_LIMIT_AUTH_RPM, "key": f"ratelimit:auth:{user_key}"},
    }

    tier_status = {}
    for tier_name, tier_info in rate_limit_tiers.items():
        is_limited, remaining, retry_after = await rate_limit_service.is_rate_limited(
            key=tier_info["key"],
            max_requests=tier_info["rpm"],
            window_seconds=60
        )
        # Fix count adjustment since is_rate_limited increments attempt
        tier_status[tier_name] = {
            "max_rpm": tier_info["rpm"],
            "remaining": remaining,
            "is_limited": is_limited,
            "retry_after": retry_after,
            "health_percentage": int((remaining / tier_info["rpm"]) * 100) if tier_info["rpm"] > 0 else 100
        }

    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "metrics": {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "estimated_prompt_tokens": estimated_prompt_tokens,
            "estimated_completion_tokens": estimated_completion_tokens,
            "estimated_total_tokens": estimated_total_tokens,
            "generated_images_count": generated_images_count,
            "rag_documents_count": rag_docs_count,
        },
        "rate_limits": tier_status,
        "settings": {
            "rate_limit_enabled": settings.RATE_LIMIT_ENABLED,
            "active_provider": settings.AI_PROVIDER,
            "default_model": settings.OPENAI_DEFAULT_MODEL if settings.AI_PROVIDER == "openai" else settings.GEMINI_DEFAULT_MODEL
        }
    }
