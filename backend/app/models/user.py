from sqlalchemy import Column, String, DateTime, Boolean, Index, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

JSON_TYPE = JSON().with_variant(JSONB, "postgresql")

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    avatar_url = Column(String(1024), nullable=True)
    
    # Roles & Access Control
    role = Column(String(20), default="user", nullable=False) # 'user', 'pro', 'admin'
    tier = Column(String(20), default="free", nullable=False) # 'free', 'pro', 'enterprise'
    auth_provider = Column(String(20), default="local", nullable=False) # 'local', 'google', 'github'
    
    # User Custom Settings & UI Preferences
    preferences = Column(JSON_TYPE, default=lambda: {"theme": "dark", "default_model": "gemini-flash-latest", "notifications": True})
    
    # Status & Activity
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    # Relationships
    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    agents = relationship("Agent", back_populates="user", cascade="all, delete-orphan")
    user_sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    usage_records = relationship("UserUsage", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")

class EmailOTP(Base):
    __tablename__ = "email_otps"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, index=True)
    otp_code = Column(String(6), nullable=False)
    purpose = Column(String(50), nullable=False) # 'register' or 'login'
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        Index("idx_email_otp_lookup", "email", "purpose"),
    )

class UserSession(Base):
    __tablename__ = "user_sessions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token_hash = Column(String(255), unique=True, nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(512), nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    last_active_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="user_sessions")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    is_used = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="reset_tokens")

class UserUsage(Base):
    __tablename__ = "user_usage"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    chat_count = Column(Integer, default=0, nullable=False)
    image_count = Column(Integer, default=0, nullable=False)
    period_month = Column(String(7), nullable=False, index=True) # e.g. "2026-07"
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="usage_records")

    __table_args__ = (
        Index("idx_usage_user_period", "user_id", "period_month", unique=True),
    )

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event = Column(String(50), nullable=False, index=True) # e.g. "login_success", "login_failed", "password_change"
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(512), nullable=True)
    extra_data = Column(JSON_TYPE, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)

    user = relationship("User", back_populates="audit_logs")



