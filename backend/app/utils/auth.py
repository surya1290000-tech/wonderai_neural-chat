"""JWT authentication utilities with refresh token support"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Set
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

# In-memory token blacklist (for production, use Redis or DB)
_blacklisted_tokens: Set[str] = set()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: str, token_type: str = "access") -> str:
    """Create JWT token. token_type can be 'access' or 'refresh'."""
    if token_type == "refresh":
        expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRY_DAYS)
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS)
    payload = {"sub": user_id, "exp": expire, "type": token_type}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_token_pair(user_id: str) -> dict:
    """Create both access and refresh tokens."""
    return {
        "access_token": create_token(user_id, "access"),
        "refresh_token": create_token(user_id, "refresh"),
    }

def blacklist_token(token: str) -> None:
    """Add a token to the blacklist (logout)."""
    _blacklisted_tokens.add(token)

def is_token_blacklisted(token: str) -> bool:
    """Check if a token has been revoked."""
    return token in _blacklisted_tokens

def verify_refresh_token(token: str) -> Optional[str]:
    """Verify a refresh token and return the user_id, or None if invalid."""
    if is_token_blacklisted(token):
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload.get("sub")
    except JWTError:
        return None

def decode_access_token(token: str) -> Optional[dict]:
    """Decode an access token and return payload, or None if invalid/blacklisted."""
    if is_token_blacklisted(token):
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type", "access") != "access":
            return None
        return payload
    except JWTError:
        return None

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Validates JWT and returns current user - used as FastAPI dependency"""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    raw_token = credentials.credentials
    if is_token_blacklisted(raw_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    
    try:
        payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        token_type = payload.get("type", "access")
        if not user_id or token_type != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
