from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")

class EmailOTP(Base):
    __tablename__ = "email_otps"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, nullable=False, index=True)
    otp_code = Column(String(6), nullable=False)
    purpose = Column(String, nullable=False) # 'register' or 'login'
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
