"""
Image Generation Service
Generates ultra-accurate, photorealistic images using Google Imagen 3 and FLUX.1 (Black Forest Labs) engines.
Includes automated AI prompt engineering for maximum image fidelity and prompt adherence.
Saves images to static/generated_images/ and serves static URLs.
"""

import os
import uuid
import urllib.parse
import httpx
import random
from google import genai
from app.config import settings

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "generated_images")
os.makedirs(STATIC_DIR, exist_ok=True)


class ImageService:
    def __init__(self):
        self._genai_client = None
        if settings.GEMINI_API_KEY:
            try:
                self._genai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                print(f"Warning: Failed to init GenAI client for Imagen: {e}")

    def _optimize_prompt(self, raw_prompt: str) -> str:
        """
        Enhances raw user prompts into professional high-precision image generation prompts.
        Adds lighting, resolution, composition, and detail descriptors if missing.
        """
        prompt_clean = raw_prompt.strip()
        
        # Remove meta prefixes
        meta_prefixes = [
            "generate an image of", "generate image of", "draw an image of", 
            "draw image of", "create an image of", "make an image of",
            "draw a", "draw ", "picture of", "photo of"
        ]
        subject = prompt_clean
        for prefix in meta_prefixes:
            if subject.lower().startswith(prefix):
                subject = subject[len(prefix):].strip()
                break

        if not subject or len(subject) < 2:
            subject = "A breathtaking futuristic cyberpunk city with vibrant neon lights and flying cars at night"

        # Check if user already specified quality modifiers
        has_quality_tags = any(tag in subject.lower() for tag in ["8k", "photorealistic", "cinematic", "unreal engine", "masterpiece", "high resolution", "realistic"])
        
        if not has_quality_tags:
            # Append high-accuracy photorealistic prompt modifiers
            enhanced = f"A professional high-definition photograph of {subject}, highly detailed, photorealistic, 8k resolution, cinematic lighting, masterpiece, sharp focus, 85mm lens"
        else:
            enhanced = subject

        return enhanced

    async def generate_image(self, prompt: str, width: int = 1024, height: int = 1024) -> dict:
        """
        Generate an ultra-accurate image from prompt.
        Returns dict with relative image 'url', 'filename', 'prompt', and 'provider'.
        """
        enhanced_prompt = self._optimize_prompt(prompt)
        filename = f"gen_{uuid.uuid4().hex[:12]}.png"
        file_path = os.path.join(STATIC_DIR, filename)

        print(f"DEBUG: Optimized Prompt for Accuracy: '{enhanced_prompt[:80]}...'")

        # 1. Try Google Imagen 3 (High-Fidelity Engine)
        if self._genai_client:
            for imagen_model in ["imagen-3.0-generate-002", "imagen-3.0-fast-generate-001", "imagen-3.0-generate-001"]:
                try:
                    print(f"DEBUG: Attempting Imagen 3 generation with model '{imagen_model}'...")
                    import asyncio
                    res = await asyncio.to_thread(
                        self._genai_client.models.generate_images,
                        model=imagen_model,
                        prompt=enhanced_prompt,
                        config=dict(number_of_images=1, aspect_ratio="1:1" if width == height else "16:9")
                    )
                    if res and res.generated_images:
                        img_bytes = res.generated_images[0].image.image_bytes
                        with open(file_path, "wb") as f:
                            f.write(img_bytes)
                        print(f"DEBUG: Imagen 3 ({imagen_model}) generation succeeded -> {filename}")
                        return {
                            "url": f"/static/generated_images/{filename}",
                            "filename": filename,
                            "prompt": enhanced_prompt,
                            "provider": f"google-imagen-3 ({imagen_model})"
                        }
                except Exception as imagen_err:
                    print(f"DEBUG: Imagen model '{imagen_model}' failed ({imagen_err}). Trying next...")

        # 2. Try FLUX.1 Engine (World SOTA Open Image Model by Black Forest Labs)
        try:
            encoded_prompt = urllib.parse.quote(enhanced_prompt)
            seed = random.randint(100000, 999999)
            flux_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&model=flux&nologo=true&enhance=true&seed={seed}"
            
            print(f"DEBUG: Attempting FLUX.1 generation via Pollinations...")
            async with httpx.AsyncClient(timeout=35.0, follow_redirects=True) as client:
                resp = await client.get(flux_url)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    with open(file_path, "wb") as f:
                        f.write(resp.content)
                    print(f"DEBUG: FLUX.1 generation succeeded -> {filename}")
                    return {
                        "url": f"/static/generated_images/{filename}",
                        "filename": filename,
                        "prompt": enhanced_prompt,
                        "provider": "flux-1-sota"
                    }
        except Exception as flux_err:
            print(f"DEBUG: FLUX.1 failed ({flux_err}). Falling back to Turbo engine...")

        # 3. Fallback to Turbo Engine
        try:
            encoded_prompt = urllib.parse.quote(enhanced_prompt)
            seed = random.randint(100000, 999999)
            turbo_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&model=turbo&nologo=true&seed={seed}"
            
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                resp = await client.get(turbo_url)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    with open(file_path, "wb") as f:
                        f.write(resp.content)
                    return {
                        "url": f"/static/generated_images/{filename}",
                        "filename": filename,
                        "prompt": enhanced_prompt,
                        "provider": "pollinations-turbo"
                    }
        except Exception as turbo_err:
            print(f"DEBUG: Turbo fallback failed: {turbo_err}")

        raise RuntimeError("Failed to generate image across all AI engines")


image_service = ImageService()
