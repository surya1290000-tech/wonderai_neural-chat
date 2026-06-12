"""Authentication routes - register, login, refresh, logout, profile"""

import re
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, field_validator

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.utils.auth import (
    hash_password, verify_password,
    create_token, create_token_pair,
    get_current_user, blacklist_token, verify_refresh_token,
)

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


@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check username uniqueness
    result = await db.execute(select(User).where(User.username == req.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user = User(email=req.email, username=req.username, hashed_password=hash_password(req.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
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
    
    # Create new access token (keep same refresh token)
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
