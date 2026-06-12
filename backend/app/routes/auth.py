"""Authentication routes - register, login, refresh, logout, profile, and OTP verify"""

import re
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, EmailStr, field_validator

from app.config import settings
from app.database import get_db
from app.models.user import User, EmailOTP
from app.utils.auth import (
    hash_password, verify_password,
    create_token, create_token_pair,
    get_current_user, blacklist_token, verify_refresh_token,
)
from app.utils.email import send_otp_email

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    
    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        v = v.strip()
        if len(v) < 2 or len(v) > settings.MAX_USERNAME_LENGTH:
            raise ValueError(f"Username must be 2-{settings.MAX_USERNAME_LENGTH} characters")
        if not re.match(r'^[a-zA-Z0-9_.-]+$', v):
            raise ValueError("Username can only contain letters, numbers, dots, hyphens, and underscores")
        return v
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < settings.MIN_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters")
        if len(v) > settings.MAX_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at most {settings.MAX_PASSWORD_LENGTH} characters")
        return v

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str

class RefreshRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    
    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < settings.MIN_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters")
        if len(v) > settings.MAX_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at most {settings.MAX_PASSWORD_LENGTH} characters")
        return v


async def _generate_and_send_otp(db: AsyncSession, email: str, purpose: str):
    """Generate 6-digit OTP, save to DB, and send email."""
    # Delete any existing OTPs for this email and purpose to prevent spam/confusion
    await db.execute(delete(EmailOTP).where(EmailOTP.email == email).where(EmailOTP.purpose == purpose))
    
    otp_code = "".join(str(secrets.randbelow(10)) for _ in range(6))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    otp_record = EmailOTP(
        email=email,
        otp_code=otp_code,
        purpose=purpose,
        expires_at=expires_at
    )
    db.add(otp_record)
    await db.commit()
    
    await send_otp_email(email, otp_code, purpose)


@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == req.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(status_code=400, detail="Email already registered")
        else:
            # If unverified, allow them to restart registration or resend OTP
            pass 
    
    # Check username uniqueness
    result = await db.execute(select(User).where(User.username == req.username))
    existing_user_by_username = result.scalar_one_or_none()
    if existing_user_by_username and existing_user_by_username.email != req.email:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    if existing_user and not existing_user.is_verified:
        # Update existing unverified user
        existing_user.username = req.username
        existing_user.hashed_password = hash_password(req.password)
    else:
        user = User(email=req.email, username=req.username, hashed_password=hash_password(req.password), is_verified=False)
        db.add(user)
    
    await _generate_and_send_otp(db, req.email, "register")
    
    return {
        "message": "Verification code sent to email",
        "require_otp": True,
        "purpose": "register"
    }

@router.post("/verify-email")
async def verify_email(req: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EmailOTP)
        .where(EmailOTP.email == req.email)
        .where(EmailOTP.purpose == "register")
        .where(EmailOTP.otp_code == req.otp_code)
    )
    otp_record = result.scalar_one_or_none()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    if otp_record.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        await db.execute(delete(EmailOTP).where(EmailOTP.id == otp_record.id))
        await db.commit()
        raise HTTPException(status_code=400, detail="Verification code expired")
    
    # Mark user as verified
    user_result = await db.execute(select(User).where(User.email == req.email))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_verified = True
    
    # Clean up OTP
    await db.execute(delete(EmailOTP).where(EmailOTP.email == req.email).where(EmailOTP.purpose == "register"))
    await db.commit()
    
    tokens = create_token_pair(user.id)
    return {
        "token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": {"id": user.id, "email": user.email, "username": user.username}
    }


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if not user.is_verified:
        # If they haven't verified email yet, treat it as a register flow continuation
        await _generate_and_send_otp(db, req.email, "register")
        return {
            "message": "Please verify your email address. Code sent to email.",
            "require_otp": True,
            "purpose": "register"
        }
    
    # User is verified, require 2FA
    await _generate_and_send_otp(db, req.email, "login")
    
    return {
        "message": "2FA code sent to email",
        "require_otp": True,
        "purpose": "login"
    }

@router.post("/verify-2fa")
async def verify_2fa(req: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EmailOTP)
        .where(EmailOTP.email == req.email)
        .where(EmailOTP.purpose == "login")
        .where(EmailOTP.otp_code == req.otp_code)
    )
    otp_record = result.scalar_one_or_none()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid 2FA code")
    
    if otp_record.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        await db.execute(delete(EmailOTP).where(EmailOTP.id == otp_record.id))
        await db.commit()
        raise HTTPException(status_code=400, detail="2FA code expired")
    
    # Issue tokens
    user_result = await db.execute(select(User).where(User.email == req.email))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Clean up OTP
    await db.execute(delete(EmailOTP).where(EmailOTP.email == req.email).where(EmailOTP.purpose == "login"))
    await db.commit()
    
    tokens = create_token_pair(user.id)
    return {
        "token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": {"id": user.id, "email": user.email, "username": user.username}
    }


@router.post("/refresh")
async def refresh_token(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for a new access token."""
    user_id = verify_refresh_token(req.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    new_access = create_token(user_id, "access")
    return {"token": new_access, "user": {"id": user.id, "email": user.email, "username": user.username}}

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """Revoke the current access token."""
    if credentials:
        blacklist_token(credentials.credentials)
    return {"message": "Logged out successfully"}

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "username": current_user.username}

@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password for the currently authenticated user."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    current_user.hashed_password = hash_password(req.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}
