"""
Image Generator Tool for Agentic System
Allows the AI to generate images upon user request.
"""

from app.services.tools import Tool, ToolParameter, tool_registry
from app.services.image_service import image_service


async def execute_generate_image(prompt: str, width: int = 1024, height: int = 1024) -> dict:
    """Execute image generation using image_service."""
    try:
        res = await image_service.generate_image(prompt, width, height)
        return {
            "status": "success",
            "url": res["url"],
            "filename": res["filename"],
            "prompt": res["prompt"],
            "provider": res["provider"],
            "markdown": f"![{res['prompt']}]({res['url']})"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


generate_image_tool = Tool(
    name="generate_image",
    description="Generate a high-quality AI image from a text description. Use this when the user asks to draw, generate, visualize, create a picture, photo, art, or image.",
    parameters=[
        ToolParameter(
            name="prompt",
            type="string",
            description="Detailed description of the image to generate. Include style, lighting, subject, and color details.",
            required=True
        ),
        ToolParameter(
            name="width",
            type="number",
            description="Width of the image in pixels (default 1024).",
            required=False
        ),
        ToolParameter(
            name="height",
            type="number",
            description="Height of the image in pixels (default 1024).",
            required=False
        )
    ],
    execute=execute_generate_image,
    icon="🎨",
    category="creation"
)

tool_registry.register(generate_image_tool)
