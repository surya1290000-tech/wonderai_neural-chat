"""
Chat routes - session management and streaming AI responses
Streaming uses Server-Sent Events (SSE)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, field_validator
from typing import Optional, List
import json

from app.config import settings
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
    images: Optional[List[str]] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    
    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        if len(v) > settings.MAX_MESSAGE_LENGTH:
            raise ValueError(f"Message exceeds maximum length of {settings.MAX_MESSAGE_LENGTH} characters")
        return v

class MessageFeedbackRequest(BaseModel):
    feedback: str  # "up", "down", or "none"

@router.get("/sessions")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List user's chat sessions with pagination."""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    sessions = result.scalars().all()
    return [{
        "id": s.id, "title": s.title, "mode": s.mode, "model": s.model,
        "temperature": s.temperature, "created_at": s.created_at, "updated_at": s.updated_at
    } for s in sessions]

@router.post("/sessions")
async def create_session(req: CreateSessionRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check session limit per user
    count_result = await db.execute(
        select(func.count()).select_from(ChatSession).where(ChatSession.user_id == current_user.id)
    )
    session_count = count_result.scalar()
    if session_count >= settings.MAX_SESSIONS_PER_USER:
        raise HTTPException(status_code=400, detail=f"Maximum of {settings.MAX_SESSIONS_PER_USER} sessions reached. Delete some to continue.")
    
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
async def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Get messages for a session with pagination."""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")
    msgs = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
        .limit(limit)
        .offset(offset)
    )
    return [{"id": m.id, "role": m.role, "content": m.content, "meta": m.meta, "created_at": m.created_at} for m in msgs.scalars()]

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    # Clean up the session's FAISS vector store from disk
    rag_service.delete_store(session_id)
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

@router.post("/sessions/{session_id}/messages/{message_id}/feedback")
async def message_feedback(
    session_id: str,
    message_id: str,
    req: MessageFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save like/dislike feedback on a message."""
    # Verify session belongs to user
    sess_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")
    
    msg_result = await db.execute(select(Message).where(Message.id == message_id, Message.session_id == session_id))
    msg = msg_result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    meta = msg.meta or {}
    meta["feedback"] = req.feedback
    msg.meta = meta
    await db.commit()
    return {"message": "Feedback saved"}

@router.get("/sessions/{session_id}/export")
async def export_session(
    session_id: str,
    format: str = Query(default="markdown", pattern="^(markdown|json)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a chat session as Markdown or JSON."""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    msgs = await db.execute(select(Message).where(Message.session_id == session_id).order_by(Message.created_at))
    messages = [{"role": m.role, "content": m.content, "created_at": str(m.created_at)} for m in msgs.scalars()]
    
    if format == "json":
        return {
            "session": {"id": session.id, "title": session.title, "mode": session.mode, "model": session.model},
            "messages": messages,
        }
    
    # Markdown format
    lines = [f"# {session.title}\n", f"*Mode: {session.mode} | Model: {session.model}*\n\n---\n"]
    for m in messages:
        role_label = "**You**" if m["role"] == "user" else "**NeuralChat**"
        lines.append(f"\n{role_label}:\n\n{m['content']}\n")
    return {"content": "\n".join(lines), "filename": f"{session.title or 'chat'}.md"}

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

    # Load conversation history with truncation for AI context
    msgs_result = await db.execute(select(Message).where(Message.session_id == session_id).order_by(Message.created_at))
    all_messages = [{"role": m.role, "content": m.content} for m in msgs_result.scalars()]
    
    # Truncate history to configured max to avoid exceeding model context windows
    max_history = settings.MAX_HISTORY_MESSAGES
    if len(all_messages) > max_history:
        history = all_messages[-max_history:]
    else:
        history = all_messages
    
    is_first_message = len(all_messages) == 0
    
    # Save user message with optional images metadata
    msg_meta = {}
    if req.images:
        msg_meta["images"] = req.images
    user_msg = Message(session_id=session_id, role="user", content=req.content, meta=msg_meta if msg_meta else None)
    db.add(user_msg)
    await db.commit()

    # RAG retrieval - inject document context into prompt
    rag_context = None
    if req.use_rag:
        rag_context, _ = rag_service.retrieve(session_id, req.content)

    # Capture full AI response for DB persistence
    full_response = []

    async def generate():
        # STREAMING: yields SSE data chunks from AI provider
        async for chunk in ai_service.stream(
            history=history,
            user_message=req.content,
            images=req.images,
            max_tokens=req.max_tokens,
            top_p=req.top_p,
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

@router.get("/search")
async def search_messages(
    q: str = Query(..., min_length=1, max_length=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=50),
):
    """Search across all user's messages."""
    # Get user's session IDs
    sessions_result = await db.execute(
        select(ChatSession.id).where(ChatSession.user_id == current_user.id)
    )
    session_ids = [s for s in sessions_result.scalars()]
    
    if not session_ids:
        return []
    
    # Search messages containing the query
    msgs_result = await db.execute(
        select(Message)
        .where(Message.session_id.in_(session_ids), Message.content.ilike(f"%{q}%"))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    
    results = []
    for m in msgs_result.scalars():
        results.append({
            "id": m.id,
            "session_id": m.session_id,
            "role": m.role,
            "content": m.content[:200] + ("..." if len(m.content) > 200 else ""),
            "created_at": m.created_at,
        })
    return results
