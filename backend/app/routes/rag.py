"""
RAG routes - Document upload, query, and vector store management
Documents are scoped to individual chat sessions.
"""

import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, Form
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
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
    session_id: Optional[str] = Form(None),
    query_session_id: Optional[str] = Query(None, alias="session_id"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document and ingest it into the session's FAISS vector store"""
    target_session_id = session_id or query_session_id
    if not target_session_id:
        raise HTTPException(status_code=400, detail="session_id is required as a query parameter or form field")

    await _verify_session_ownership(target_session_id, current_user, db)

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Save file to disk temporarily
    file_path = os.path.join(settings.UPLOAD_DIR, f"{target_session_id}_{file.filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Ingest into RAG pipeline
    result = await rag_service.ingest_document(target_session_id, file_path, file.filename)
    
    # Clean up file after ingestion
    if os.path.exists(file_path):
        os.remove(file_path)

    # Persist a SessionDocument record in the DB
    if "error" not in result:
        doc = SessionDocument(
            id=result["document_id"],
            session_id=target_session_id,
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


class IngestUrlRequest(BaseModel):
    url: str


@router.post("/ingest-url")
async def ingest_url(
    req: IngestUrlRequest,
    session_id: str = Query(..., description="Chat session to attach URL content to"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scrape a webpage URL and ingest its content into the session's vector store"""
    await _verify_session_ownership(session_id, current_user, db)
    
    import httpx
    import re
    from bs4 import BeautifulSoup
    
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WonderAI/1.0"})
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")

    soup = BeautifulSoup(html, "html.parser")
    for s in soup(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
        s.extract()
    
    text = soup.get_text(separator="\n")
    lines = (line.strip() for line in text.splitlines())
    chunks_clean = (phrase.strip() for line in lines for phrase in line.split("  "))
    clean_text = "\n".join(chunk for chunk in chunks_clean if chunk)
    
    if len(clean_text) < 30:
        raise HTTPException(status_code=400, detail="Could not extract meaningful text from URL")

    # Clean display name
    domain_name = url.replace("https://", "").replace("http://", "").split("/")[0]
    doc_label = f"Web: {domain_name}"

    temp_filename = f"url_{re.sub(r'[^a-zA-Z0-9]', '_', url)[:25]}.txt"
    file_path = os.path.join(settings.UPLOAD_DIR, f"{session_id}_{temp_filename}")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"Source Web URL: {url}\n\n" + clean_text)
        
    result = await rag_service.ingest_document(session_id, file_path, doc_label)
    if os.path.exists(file_path):
        os.remove(file_path)

    if "error" not in result:
        doc = SessionDocument(
            id=result["document_id"],
            session_id=session_id,
            filename=doc_label,
            chunk_count=result["chunks"],
        )
        db.add(doc)
        await db.commit()

    return result
