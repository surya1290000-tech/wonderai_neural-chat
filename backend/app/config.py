"""
Configuration management using environment variables
All sensitive values come from .env file
"""

from pydantic_settings import BaseSettings
from typing import List
import os
import logging

class Settings(BaseSettings):
    # App
    APP_NAME: str = "Wonder AI"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-secret-key-in-production"
    LOG_LEVEL: str = "INFO"
    
    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    JWT_REFRESH_EXPIRY_DAYS: int = 30
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/wonderai.db"
    
    # AI Provider - "openai" or "ollama" or "gemini"
    AI_PROVIDER: str = "openai"
    
    # OpenAI (Option A)
    OPENAI_API_KEY: str = ""
    OPENAI_DEFAULT_MODEL: str = "gpt-4o-mini"
    
    # Ollama (Option B) - local open-source LLMs
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_DEFAULT_MODEL: str = "mistral"
    
    # Gemini (Option C) - Google AI
    GEMINI_API_KEY: str = ""
    GEMINI_DEFAULT_MODEL: str = "gemini-2.0-flash"
    
    # RAG settings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    TOP_K_RESULTS: int = 3
    UPLOAD_DIR: str = "./data/uploads"
    VECTORSTORE_DIR: str = "./data/vectorstore"
    MAX_UPLOAD_SIZE_MB: int = 20
    
    # Rate limiting
    RATE_LIMIT_RPM: int = 60  # requests per minute per IP
    RATE_LIMIT_ENABLED: bool = True
    
    # Input validation limits
    MAX_MESSAGE_LENGTH: int = 32000
    MAX_SESSIONS_PER_USER: int = 200
    MAX_PASSWORD_LENGTH: int = 128
    MIN_PASSWORD_LENGTH: int = 6
    MAX_USERNAME_LENGTH: int = 50
    
    # Context window management
    MAX_HISTORY_MESSAGES: int = 50  # max messages to send as context to AI
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    class Config:
        env_file = ".env"

settings = Settings()

# Production safety check
if not settings.DEBUG and settings.SECRET_KEY == "change-this-secret-key-in-production":
    logging.warning(
        "⚠️  SECRET_KEY is still the default value! "
        "Set a strong SECRET_KEY in your .env for production."
    )

# Ensure data directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.VECTORSTORE_DIR, exist_ok=True)
os.makedirs("./data", exist_ok=True)
