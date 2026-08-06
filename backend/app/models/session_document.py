"""
SessionDocument model — tracks uploaded documents per chat session.
Each document maps to a set of chunks in the session's FAISS vector store.
"""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SessionDocument(Base):
    __tablename__ = "session_documents"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)
    session = relationship("ChatSession", back_populates="documents")

    __table_args__ = (
        Index("idx_session_docs_session", "session_id"),
    )

