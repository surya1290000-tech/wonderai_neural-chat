"""Tool listing endpoint"""

from fastapi import APIRouter
from app.services.tools import tool_registry

router = APIRouter()

@router.get("/")
async def list_tools():
    """List all available agent tools"""
    tools = tool_registry.list_tools()
    return {
        "tools": [
            {
                "name": t.name,
                "description": t.description,
                "icon": t.icon,
                "category": t.category,
                "parameters": [
                    {"name": p.name, "type": p.type, "description": p.description, "required": p.required}
                    for p in t.parameters
                ]
            }
            for t in tools
        ]
    }
