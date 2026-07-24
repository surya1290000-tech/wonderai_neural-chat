"""
Image Generation API Router
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from app.services.image_service import image_service
from app.utils.auth import get_current_user
from app.models.user import User

router = APIRouter()


class GenerateImageRequest(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Prompt cannot be empty")
        if len(v) > 1000:
            raise ValueError("Prompt must be 1000 characters or fewer")
        return v


@router.post("/generate")
async def generate_image(req: GenerateImageRequest, current_user: User = Depends(get_current_user)):
    """Generate an AI image from a text prompt."""
    try:
        result = await image_service.generate_image(req.prompt, req.width, req.height)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
