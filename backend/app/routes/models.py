"""Model listing and switching endpoint"""

from fastapi import APIRouter
import httpx
from app.config import settings

router = APIRouter()

OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"]
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-3-pro-preview",
    "gemini-3.5-flash",
]

@router.get("/")
async def list_models():
    models = {"provider": settings.AI_PROVIDER, "models": []}
    
    if settings.AI_PROVIDER == "openai":
        models["models"] = OPENAI_MODELS
        models["default"] = settings.OPENAI_DEFAULT_MODEL
    elif settings.AI_PROVIDER == "gemini":
        # Ensure the configured default model is always in the list
        gem_list = list(GEMINI_MODELS)
        if settings.GEMINI_DEFAULT_MODEL and settings.GEMINI_DEFAULT_MODEL not in gem_list:
            gem_list.insert(0, settings.GEMINI_DEFAULT_MODEL)
        models["models"] = gem_list
        models["default"] = settings.GEMINI_DEFAULT_MODEL
    else:
        # Fetch available models from Ollama
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                data = resp.json()
                models["models"] = [m["name"] for m in data.get("models", [])]
                models["default"] = settings.OLLAMA_DEFAULT_MODEL
        except Exception:
            models["models"] = [settings.OLLAMA_DEFAULT_MODEL]
            models["default"] = settings.OLLAMA_DEFAULT_MODEL
            models["error"] = "Could not connect to Ollama"
    
    return models
