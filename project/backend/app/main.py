"""
Wonder AI Assistant - FastAPI Backend
Handles authentication, chat sessions, and AI service integration.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.routes import auth, chat, rag, models

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and resources on startup"""
    await init_db()
    yield

app = FastAPI(
    title="Wonder AI API",
    description="Production-ready AI assistant backend with RAG support",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration - allows frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(rag.router, prefix="/api/rag", tags=["RAG"])
app.include_router(models.router, prefix="/api/models", tags=["Models"])

@app.get("/")
async def root():
    return {"message": "Wonder AI API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
