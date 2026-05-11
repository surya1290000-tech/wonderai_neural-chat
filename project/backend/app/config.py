"""
Configuration management using environment variables
All sensitive values come from .env file
"""

from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # App
    APP_NAME: str = "Wonder AI"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-secret-key-in-production"
    
    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/wonderai.db"
    
    # AI Provider - "openai" or "ollama"
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
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    class Config:
        env_file = ".env"

settings = Settings()

# Ensure data directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.VECTORSTORE_DIR, exist_ok=True)
os.makedirs("./data", exist_ok=True)
