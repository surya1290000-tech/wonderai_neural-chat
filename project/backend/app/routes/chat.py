"""
Chat routes - session management and streaming AI responses
Streaming uses Server-Sent Events (SSE)
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import json

from app.database import get_db, AsyncSessionLocal
from app.models.user import User
from app.models.chat import ChatSession, Message
from app.utils.auth import get_current_user
from app.services.ai_service import ai_service
from app.services.rag_service import rag_service

router = APIRouter()

class CreateSessionRequest(BaseModel):
    title: str = "New Chat"
    mode: str = "default"
    model: Optional[str] = None  # None = use AI provider default from settings
    temperature: float = 0.7
    system_prompt: Optional[str] = None

class UpdateSessionRequest(BaseModel):
    title: Optional[str] = None
    mode: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    system_prompt: Optional[str] = None

class SendMessageRequest(BaseModel):
    content: str
    use_rag: bool = False

@router.get("/sessions")
async def list_sessions(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession).where(ChatSession.user_id == current_user.id).order_by(ChatSession.updated_at.desc()))
    sessions = result.scalars().all()
    return [{"id": s.id, "title": s.title, "mode": s.mode, "model": s.model, "temperature": s.temperature, "created_at": s.created_at, "updated_at": s.updated_at} for s in sessions]

@router.post("/sessions")
async def create_session(req: CreateSessionRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Resolve model: use request model or fall back to the configured provider's default
    from app.config import settings as cfg
    if req.model is None:
        if cfg.AI_PROVIDER == "ollama":
            resolved_model = cfg.OLLAMA_DEFAULT_MODEL
        elif cfg.AI_PROVIDER == "gemini":
            resolved_model = cfg.GEMINI_DEFAULT_MODEL
        else:
            resolved_model = cfg.OPENAI_DEFAULT_MODEL
    else:
        resolved_model = req.model
    session = ChatSession(user_id=current_user.id, title=req.title, mode=req.mode, model=resolved_model, temperature=req.temperature, system_prompt=req.system_prompt)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"id": session.id, "title": session.title, "mode": session.mode, "model": session.model, "temperature": session.temperature}

@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")
    msgs = await db.execute(select(Message).where(Message.session_id == session_id).order_by(Message.created_at))
    return [{"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at} for m in msgs.scalars()]

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"message": "Deleted"}

@router.patch("/sessions/{session_id}")
async def update_session(session_id: str, req: UpdateSessionRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(session, field, value)
    await db.commit()
    return {"message": "Updated"}

@router.post("/sessions/{session_id}/messages/stream")
async def stream_message(
    session_id: str,
    req: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """STREAMING ENDPOINT - Returns Server-Sent Events for real-time AI responses"""
    
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Load conversation history
    msgs_result = await db.execute(select(Message).where(Message.session_id == session_id).order_by(Message.created_at))
    history = [{"role": m.role, "content": m.content} for m in msgs_result.scalars()]
    is_first_message = len(history) == 0
    
    # Save user message
    user_msg = Message(session_id=session_id, role="user", content=req.content)
    db.add(user_msg)
    await db.commit()

    # RAG retrieval - inject document context into prompt
    rag_context = None
    if req.use_rag:
        rag_context, _ = rag_service.retrieve(req.content)

    # Capture full AI response for DB persistence
    full_response = []

    async def generate():
        # STREAMING: yields SSE data chunks from AI provider
        async for chunk in ai_service.stream(
            history=history,
            user_message=req.content,
            model=session.model,
            temperature=session.temperature,
            mode=session.mode,
            system_prompt=session.system_prompt,
            rag_context=rag_context
        ):
            try:
                data = json.loads(chunk.replace("data: ", ""))
                if data.get("content"):
                    full_response.append(data["content"])
            except Exception:
                pass
            yield chunk

        # After streaming: persist assistant message in new DB session
        async with AsyncSessionLocal() as new_db:
            ai_msg = Message(session_id=session_id, role="assistant", content="".join(full_response), meta={"rag_used": req.use_rag})
            new_db.add(ai_msg)
            
            # Auto-title the chat from first message
            if is_first_message and full_response:
                title_prompt = [{"role": "user", "content": f"Summarize this in 4 words max, no quotes: {req.content}"}]
                title = await ai_service.complete(title_prompt)
                sess = await new_db.get(ChatSession, session_id)
                if sess:
                    sess.title = title.strip().strip('"\'')
            
            await new_db.commit()

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
