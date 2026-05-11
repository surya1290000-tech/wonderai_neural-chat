"""
RAG routes - PDF upload and vector store management
"""

import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.config import settings
from app.services.rag_service import rag_service
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter()

@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a PDF and ingest it into the FAISS vector store"""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Save file to disk
    file_path = os.path.join(settings.UPLOAD_DIR, f"{current_user.id}_{file.filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Ingest into RAG pipeline
    result = await rag_service.ingest_pdf(file_path, file.filename)
    return result

@router.get("/stats")
async def rag_stats(current_user: User = Depends(get_current_user)):
    """Get vector store statistics"""
    return rag_service.get_stats()

@router.post("/query")
async def query_rag(query: dict, current_user: User = Depends(get_current_user)):
    """Test RAG retrieval directly"""
    text = query.get("text", "")
    context, sources = rag_service.retrieve(text)
    return {"context": context, "sources": sources}
