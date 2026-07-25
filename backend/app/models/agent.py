"""
Agent Model — Custom AI Personas ("Custom GPTs")
Each agent defines a reusable AI persona with a custom system prompt,
model/temperature overrides, tool permission whitelist, avatar, and
optional public sharing.
"""

from sqlalchemy import Column, String, DateTime, Text, Float, Integer, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # Identity
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    avatar_emoji = Column(String(10), default="🤖")
    avatar_color = Column(String(20), default="#d4845e")  # gradient start color

    # AI Configuration
    system_prompt = Column(Text, nullable=False)
    model = Column(String, nullable=True)          # NULL = use provider default
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, nullable=True)
    top_p = Column(Float, nullable=True)

    # Tool permissions — JSON list of tool names, e.g. ["web_search","run_code"] or ["*"] for all
    tools_enabled = Column(JSON, default=lambda: ["*"])

    # UX
    welcome_message = Column(Text, nullable=True)  # shown when chat starts
    conversation_starters = Column(JSON, default=lambda: [])  # list of 4 starter prompts

    # Sharing & Discovery
    is_public = Column(Boolean, default=False)
    share_id = Column(String, unique=True, nullable=True, index=True)
    category = Column(String(50), default="general")
    usage_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", back_populates="agents")
    sessions = relationship("ChatSession", back_populates="agent")
