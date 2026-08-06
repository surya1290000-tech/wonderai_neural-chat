"""
Wonder AI Assistant - FastAPI Backend
Handles authentication, chat sessions, and AI service integration.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
import os
from fastapi.staticfiles import StaticFiles
from app.routes import auth, chat, rag, models, tools, images, agents, audio
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.logging import LoggingMiddleware

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and resources on startup"""
    await init_db()
    yield

app = FastAPI(
    title="Wonder AI API",
    description="Production-ready AI assistant backend with RAG support",
    version="3.0.0",
    lifespan=lifespan
)

# Serve static generated images
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Middleware stack (order matters: last added = first executed)
# 1. Logging (outermost — logs everything)
app.add_middleware(LoggingMiddleware)

# 2. Rate limiting
app.add_middleware(RateLimitMiddleware)

# 3. CORS configuration - allows frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes import auth, chat, rag, models, tools, images, agents, audio, analytics

# Register route modules
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(rag.router, prefix="/api/rag", tags=["RAG"])
app.include_router(models.router, prefix="/api/models", tags=["Models"])
app.include_router(tools.router, prefix="/api/tools", tags=["Tools"])
app.include_router(images.router, prefix="/api/images", tags=["Images"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(audio.router, prefix="/api/audio", tags=["Audio"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

from sqlalchemy import text
from app.database import AsyncSessionLocal

@app.get("/")
async def root():
    return {"message": "Wonder AI API is running", "version": "3.0.0"}

@app.get("/health")
async def health_check():
    db_status = "healthy"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "provider": settings.AI_PROVIDER,
        "version": "3.0.0"
    }
