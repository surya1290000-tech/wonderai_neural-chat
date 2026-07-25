"""
Agents API — CRUD, sharing, and discovery for Custom AI Agents.
Enables users to create reusable AI personas with custom system prompts,
model overrides, tool permissions, and public sharing via UUID links.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, field_validator
from typing import Optional, List
import uuid

from app.database import get_db
from app.models.user import User
from app.models.agent import Agent
from app.utils.auth import get_current_user

router = APIRouter()


# ──────────────────────────────────────────────
# Request / Response Schemas
# ──────────────────────────────────────────────

class CreateAgentRequest(BaseModel):
    name: str
    description: Optional[str] = None
    avatar_emoji: str = "🤖"
    avatar_color: str = "#d4845e"
    system_prompt: str
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    tools_enabled: List[str] = ["*"]
    welcome_message: Optional[str] = None
    conversation_starters: List[str] = []
    category: str = "general"

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("Agent name must be 1–100 characters")
        return v

    @field_validator("system_prompt")
    @classmethod
    def validate_prompt(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("System prompt cannot be empty")
        if len(v) > 8000:
            raise ValueError("System prompt must be under 8000 characters")
        return v


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_emoji: Optional[str] = None
    avatar_color: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    tools_enabled: Optional[List[str]] = None
    welcome_message: Optional[str] = None
    conversation_starters: Optional[List[str]] = None
    category: Optional[str] = None


def _agent_to_dict(agent: Agent, include_prompt: bool = True) -> dict:
    """Serialize an Agent to a JSON-safe dict."""
    d = {
        "id": agent.id,
        "user_id": agent.user_id,
        "name": agent.name,
        "description": agent.description,
        "avatar_emoji": agent.avatar_emoji,
        "avatar_color": agent.avatar_color,
        "model": agent.model,
        "temperature": agent.temperature,
        "max_tokens": agent.max_tokens,
        "top_p": agent.top_p,
        "tools_enabled": agent.tools_enabled,
        "welcome_message": agent.welcome_message,
        "conversation_starters": agent.conversation_starters or [],
        "is_public": agent.is_public,
        "share_id": agent.share_id,
        "category": agent.category,
        "usage_count": agent.usage_count,
        "created_at": agent.created_at,
        "updated_at": agent.updated_at,
    }
    if include_prompt:
        d["system_prompt"] = agent.system_prompt
    return d


# ──────────────────────────────────────────────
# CRUD Endpoints
# ──────────────────────────────────────────────

@router.get("/")
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all agents owned by the current user."""
    result = await db.execute(
        select(Agent)
        .where(Agent.user_id == current_user.id)
        .order_by(Agent.updated_at.desc())
    )
    agents = result.scalars().all()
    return [_agent_to_dict(a) for a in agents]


@router.post("/")
async def create_agent(
    req: CreateAgentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new custom agent."""
    # Limit agents per user
    count_result = await db.execute(
        select(func.count()).select_from(Agent).where(Agent.user_id == current_user.id)
    )
    agent_count = count_result.scalar()
    if agent_count >= 50:
        raise HTTPException(status_code=400, detail="Maximum of 50 agents reached. Delete some to continue.")

    agent = Agent(
        user_id=current_user.id,
        name=req.name,
        description=req.description,
        avatar_emoji=req.avatar_emoji,
        avatar_color=req.avatar_color,
        system_prompt=req.system_prompt,
        model=req.model,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        top_p=req.top_p,
        tools_enabled=req.tools_enabled,
        welcome_message=req.welcome_message,
        conversation_starters=req.conversation_starters,
        category=req.category,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return _agent_to_dict(agent)


@router.get("/{agent_id}")
async def get_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single agent by ID (must be owned by user)."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _agent_to_dict(agent)


@router.patch("/{agent_id}")
async def update_agent(
    agent_id: str,
    req: UpdateAgentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing agent."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    for field, value in req.model_dump(exclude_none=True).items():
        setattr(agent, field, value)

    await db.commit()
    await db.refresh(agent)
    return _agent_to_dict(agent)


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an agent."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await db.delete(agent)
    await db.commit()
    return {"message": "Agent deleted"}


# ──────────────────────────────────────────────
# Sharing Endpoints
# ──────────────────────────────────────────────

@router.post("/{agent_id}/share")
async def toggle_share(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle public sharing for an agent. Returns the share_id."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent.is_public:
        # Disable sharing
        agent.is_public = False
        agent.share_id = None
    else:
        # Enable sharing — generate a short share ID
        agent.is_public = True
        agent.share_id = str(uuid.uuid4())[:12]

    await db.commit()
    await db.refresh(agent)
    return {
        "is_public": agent.is_public,
        "share_id": agent.share_id,
        "share_url": f"/agents/shared/{agent.share_id}" if agent.share_id else None,
    }


@router.get("/shared/{share_id}")
async def get_shared_agent(
    share_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a publicly shared agent profile (no auth required)."""
    result = await db.execute(
        select(Agent).where(Agent.share_id == share_id, Agent.is_public == True)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Shared agent not found")

    # Return public-safe info (exclude full system prompt for privacy)
    return _agent_to_dict(agent, include_prompt=False)


@router.post("/shared/{share_id}/clone")
async def clone_shared_agent(
    share_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clone a shared agent into the current user's library."""
    result = await db.execute(
        select(Agent).where(Agent.share_id == share_id, Agent.is_public == True)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Shared agent not found")

    clone = Agent(
        user_id=current_user.id,
        name=f"{source.name} (Copy)",
        description=source.description,
        avatar_emoji=source.avatar_emoji,
        avatar_color=source.avatar_color,
        system_prompt=source.system_prompt,
        model=source.model,
        temperature=source.temperature,
        max_tokens=source.max_tokens,
        top_p=source.top_p,
        tools_enabled=source.tools_enabled,
        welcome_message=source.welcome_message,
        conversation_starters=source.conversation_starters,
        category=source.category,
    )
    db.add(clone)

    # Increment usage count on the original
    source.usage_count = (source.usage_count or 0) + 1

    await db.commit()
    await db.refresh(clone)
    return _agent_to_dict(clone)


# ──────────────────────────────────────────────
# Discovery Endpoints
# ──────────────────────────────────────────────

@router.get("/discover/featured")
async def featured_agents(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=50),
):
    """Get popular/featured public agents sorted by usage count."""
    result = await db.execute(
        select(Agent)
        .where(Agent.is_public == True)
        .order_by(Agent.usage_count.desc())
        .limit(limit)
    )
    agents = result.scalars().all()
    return [_agent_to_dict(a, include_prompt=False) for a in agents]
