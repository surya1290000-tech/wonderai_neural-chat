"""
AI Service - Core AI Logic Layer
Handles OpenAI, Ollama, and Google Gemini integrations
Supports streaming responses
"""

import json
import httpx
from typing import AsyncGenerator, List, Dict, Optional
from openai import AsyncOpenAI

from app.config import settings

# Role-based system prompts for different modes
ROLE_PROMPTS = {
    "default": "You are a helpful, knowledgeable AI assistant. Be concise, accurate, and friendly.",
    "writer": "You are an expert creative writing assistant. Help with storytelling, style, grammar, and creative expression. Provide detailed feedback and suggestions.",
    "student": "You are a patient educational tutor. Explain concepts clearly with examples, break down complex topics, and encourage learning step by step.",
    "director": "You are a strategic business advisor and project director. Provide structured, actionable insights, prioritize decisions, and think in terms of outcomes and ROI.",
}

class AIService:
    def __init__(self):
        # Initialize OpenAI client (Option A)
        self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
    
    def _build_messages(
        self,
        history: List[Dict],
        user_message: str,
        mode: str = "default",
        system_prompt: Optional[str] = None,
        rag_context: Optional[str] = None
    ) -> List[Dict]:
        """Build the message array including system prompt, RAG context, and history"""
        
        # Use custom system prompt or role-based default
        sys_prompt = system_prompt or ROLE_PROMPTS.get(mode, ROLE_PROMPTS["default"])
        
        # RAG: Inject retrieved context into system prompt if available
        if rag_context:
            sys_prompt += f"\n\nRelevant context from uploaded documents:\n{rag_context}\n\nUse this context to answer the user's question when relevant."
        
        messages = [{"role": "system", "content": sys_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})
        return messages

    # ============================================================
    # OPENAI STREAMING (Option A) - AI logic happens here
    # ============================================================
    async def stream_openai(
        self,
        history: List[Dict],
        user_message: str,
        model: str = None,
        temperature: float = 0.7,
        mode: str = "default",
        system_prompt: Optional[str] = None,
        rag_context: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream response from OpenAI API"""
        
        if not self.openai_client:
            yield "data: " + json.dumps({"error": "OpenAI API key not configured"}) + "\n\n"
            return
        
        messages = self._build_messages(history, user_message, mode, system_prompt, rag_context)
        model = model or settings.OPENAI_DEFAULT_MODEL
        
        try:
            # STREAMING happens here - yields chunks as they arrive
            async with self.openai_client.chat.completions.stream(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=2048,
            ) as stream:
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        yield f"data: {json.dumps({'content': delta, 'done': False})}\n\n"
            
            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    # ============================================================
    # OLLAMA STREAMING (Option B) - Open-source LLM logic here
    # ============================================================
    async def stream_ollama(
        self,
        history: List[Dict],
        user_message: str,
        model: str = None,
        temperature: float = 0.7,
        mode: str = "default",
        system_prompt: Optional[str] = None,
        rag_context: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream response from Ollama (local open-source LLM)"""
        
        messages = self._build_messages(history, user_message, mode, system_prompt, rag_context)
        model = model or settings.OLLAMA_DEFAULT_MODEL
        
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature}
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload) as response:
                    async for line in response.aiter_lines():
                        if line:
                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            done = data.get("done", False)
                            if content:
                                yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
                            if done:
                                yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
        
        except httpx.ConnectError:
            yield f"data: {json.dumps({'error': 'Cannot connect to Ollama. Make sure it is running on ' + settings.OLLAMA_BASE_URL})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    # ============================================================
    # GEMINI STREAMING (Option C) - Google AI
    # ============================================================
    async def stream_gemini(
        self,
        history: List[Dict],
        user_message: str,
        model: str = None,
        temperature: float = 0.7,
        mode: str = "default",
        system_prompt: Optional[str] = None,
        rag_context: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream response from Google Gemini API"""
        
        if not settings.GEMINI_API_KEY:
            yield "data: " + json.dumps({"error": "Gemini API key not configured. Set GEMINI_API_KEY in .env"}) + "\n\n"
            return
        
        model = model or settings.GEMINI_DEFAULT_MODEL
        sys_prompt = system_prompt or ROLE_PROMPTS.get(mode, ROLE_PROMPTS["default"])
        
        if rag_context:
            sys_prompt += f"\n\nRelevant context from uploaded documents:\n{rag_context}\n\nUse this context to answer the user's question when relevant."
        
        # Build Gemini-format contents
        contents = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})
        
        payload = {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": sys_prompt}]},
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 2048,
            },
        }
        
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={settings.GEMINI_API_KEY}"
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", api_url, json=payload) as response:
                    if response.status_code != 200:
                        error_body = ""
                        async for chunk in response.aiter_text():
                            error_body += chunk
                        yield f"data: {json.dumps({'error': f'Gemini API error ({response.status_code}): {error_body[:200]}'})}\n\n"
                        return
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            try:
                                data = json.loads(line[6:])
                                candidates = data.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    for part in parts:
                                        text = part.get("text", "")
                                        if text:
                                            yield f"data: {json.dumps({'content': text, 'done': False})}\n\n"
                            except json.JSONDecodeError:
                                pass
            
            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    async def stream(self, provider: str = None, **kwargs) -> AsyncGenerator[str, None]:
        """Route to the correct AI provider based on config"""
        provider = provider or settings.AI_PROVIDER
        if provider == "ollama":
            async for chunk in self.stream_ollama(**kwargs):
                yield chunk
        elif provider == "gemini":
            async for chunk in self.stream_gemini(**kwargs):
                yield chunk
        else:
            async for chunk in self.stream_openai(**kwargs):
                yield chunk

    async def complete(self, messages: List[Dict], model: str = None) -> str:
        """Non-streaming completion for internal use (e.g., generating chat titles)"""
        if settings.AI_PROVIDER == "ollama":
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json={"model": model or settings.OLLAMA_DEFAULT_MODEL, "messages": messages, "stream": False}
                )
                return resp.json().get("message", {}).get("content", "")
        elif settings.AI_PROVIDER == "gemini":
            if not settings.GEMINI_API_KEY:
                return "Untitled Chat"
            gemini_model = model or settings.GEMINI_DEFAULT_MODEL
            contents = []
            for msg in messages:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})
            payload = {
                "contents": contents,
                "generationConfig": {"maxOutputTokens": 20},
            }
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={settings.GEMINI_API_KEY}"
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(api_url, json=payload)
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "Untitled Chat")
            return "Untitled Chat"
        else:
            if not self.openai_client:
                return "Untitled Chat"
            response = await self.openai_client.chat.completions.create(
                model=model or settings.OPENAI_DEFAULT_MODEL,
                messages=messages,
                max_tokens=20
            )
            return response.choices[0].message.content

ai_service = AIService()
