"""
RAG routes - Document upload, query, and vector store management
Documents are scoped to individual chat sessions.
"""

import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.services.rag_service import rag_service
from app.models.user import User
from app.models.chat import ChatSession
from app.models.session_document import SessionDocument
from app.utils.auth import get_current_user

router = APIRouter()

ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.md', '.docx'}


async def _verify_session_ownership(
    session_id: str, current_user: User, db: AsyncSession
) -> ChatSession:
    """Verify that the given session exists and belongs to the current user."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/upload")
async def upload_document(
    session_id: str = Query(..., description="Chat session to attach document to"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document and ingest it into the session's FAISS vector store"""
    await _verify_session_ownership(session_id, current_user, db)

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Save file to disk temporarily
    file_path = os.path.join(settings.UPLOAD_DIR, f"{session_id}_{file.filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Ingest into RAG pipeline
    result = await rag_service.ingest_document(session_id, file_path, file.filename)
    
    # Clean up file after ingestion
    if os.path.exists(file_path):
        os.remove(file_path)

    # Persist a SessionDocument record in the DB
    if "error" not in result:
        doc = SessionDocument(
            id=result["document_id"],
            session_id=session_id,
            filename=file.filename,
            chunk_count=result["chunks"],
        )
        db.add(doc)
        await db.commit()

    return result


@router.get("/documents")
async def list_documents(
    session_id: str = Query(..., description="Chat session to list documents for"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all documents attached to a chat session"""
    await _verify_session_ownership(session_id, current_user, db)
    docs = rag_service.list_documents(session_id)
    return docs


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    session_id: str = Query(..., description="Chat session that owns the document"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a document from a session's knowledge base"""
    await _verify_session_ownership(session_id, current_user, db)

    success = rag_service.delete_document(session_id, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove DB record
    doc_result = await db.execute(
        select(SessionDocument).where(SessionDocument.id == document_id)
    )
    doc = doc_result.scalar_one_or_none()
    if doc:
        await db.delete(doc)
        await db.commit()

    return {"message": "Document deleted successfully"}


@router.get("/stats")
async def rag_stats(
    session_id: str = Query(..., description="Chat session to get stats for"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a session's vector store statistics"""
    await _verify_session_ownership(session_id, current_user, db)
    return rag_service.get_stats(session_id)


@router.post("/query")
async def query_rag(
    query: dict,
    session_id: str = Query(..., description="Chat session to query against"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test RAG retrieval against a specific session's documents"""
    await _verify_session_ownership(session_id, current_user, db)
    text = query.get("text", "")
    context, sources = rag_service.retrieve(session_id, text)
    return {"context": context, "sources": sources}
