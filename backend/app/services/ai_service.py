"""
AI Service - Core AI Logic Layer
Handles OpenAI, Ollama, and Google Gemini (via google-genai SDK) integrations
Supports streaming responses and agentic tool use
"""

import json
import asyncio
import httpx
from typing import AsyncGenerator, List, Dict, Optional
from openai import AsyncOpenAI
from google import genai
from google.genai import types

from app.config import settings

# Known valid Gemini models — used to catch invalid/deprecated models stored in DB sessions
VALID_GEMINI_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
    "gemini-pro-latest",
}

# Reliable fallback model when the selected model is rate limited (429) or unavailable (503/404)
GEMINI_FALLBACK_MODEL = "gemini-flash-latest"

# Import tool registry and register all tools
from app.services.tools import tool_registry
import app.services.tools.web_search    # registers web_search
import app.services.tools.code_executor  # registers run_code
import app.services.tools.weather        # registers get_weather
import app.services.tools.image_generator  # registers generate_image

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
        
        # Initialize Gemini client (Option C) via official google-genai SDK
        self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None
    
    def _build_messages(
        self,
        history: List[Dict],
        user_message: str,
        mode: str = "default",
        system_prompt: Optional[str] = None,
        rag_context: Optional[str] = None,
        enable_tools: bool = True
    ) -> List[Dict]:
        """Build the message array including system prompt, RAG context, tool descriptions, and history"""
        
        # Use custom system prompt or role-based default
        sys_prompt = system_prompt or ROLE_PROMPTS.get(mode, ROLE_PROMPTS["default"])
        
        # RAG: Inject retrieved context into system prompt if available
        if rag_context:
            sys_prompt += (
                "\n\n## DOCUMENT CONTEXT (from user-uploaded files)\n"
                "You have access to the following retrieved passages from the user's uploaded documents. "
                "Each passage includes its source filename, page number (if available), and relevance score.\n\n"
                f"{rag_context}\n\n"
                "## INSTRUCTIONS FOR USING DOCUMENT CONTEXT\n"
                "1. **Prioritize document context**: When the user's question relates to the uploaded documents, "
                "base your answer primarily on the retrieved passages above rather than your general knowledge.\n"
                "2. **Cite your sources**: Reference the source filename and page number when answering "
                "(e.g., 'According to report.pdf (Page 3), ...').\n"
                "3. **Handle tables and data**: If the context contains tabular data, present it clearly "
                "in your response using markdown tables or structured formatting.\n"
                "4. **Admit gaps**: If the retrieved context does not contain enough information to fully answer "
                "the question, clearly state: 'The uploaded documents do not contain sufficient information about [topic]. "
                "Based on my general knowledge: ...' and then provide your best answer.\n"
                "5. **Synthesize across chunks**: If multiple passages are relevant, synthesize the information "
                "into a coherent answer rather than repeating each chunk separately.\n"
                "6. **Be precise**: Quote exact figures, dates, and names from the documents when available."
            )
        
        # Tools: Inject tool descriptions into system prompt
        if enable_tools:
            tool_desc = tool_registry.get_tool_descriptions()
            if tool_desc:
                sys_prompt += f"\n\n{tool_desc}"
        
        messages = [{"role": "system", "content": sys_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})
        return messages

    # ============================================================
    # TOOL EXECUTION PIPELINE
    # ============================================================
    async def _handle_tool_calls(self, response_text: str) -> Optional[List[Dict]]:
        """Check if the AI response contains tool calls and execute them."""
        tool_calls = tool_registry.parse_tool_calls(response_text)
        if not tool_calls:
            return None
        
        results = []
        for call in tool_calls:
            tool_name = call.get("tool")
            args = call.get("args", {})
            result = await tool_registry.execute_tool(tool_name, args)
            results.append(result)
        
        return results

    # ============================================================
    # OPENAI STREAMING (Option A)
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
        """Stream response from OpenAI API with tool support"""
        
        if not self.openai_client:
            yield "data: " + json.dumps({"error": "OpenAI API key not configured"}) + "\n\n"
            return
        
        messages = self._build_messages(history, user_message, mode, system_prompt, rag_context)
        model = model or settings.OPENAI_DEFAULT_MODEL
        
        try:
            async with self.openai_client.chat.completions.stream(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=2048,
            ) as stream:
                accumulated = ""
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        accumulated += delta
                        yield f"data: {json.dumps({'content': delta, 'done': False})}\n\n"
            
            # Check for tool calls in the response
            tool_results = await self._handle_tool_calls(accumulated)
            if tool_results:
                for result in tool_results:
                    yield f"data: {json.dumps({'tool_result': result, 'done': False})}\n\n"
                
                # Follow-up: send tool results back to the AI for a final answer
                messages.append({"role": "assistant", "content": accumulated})
                tool_context = "\n\n".join([
                    f"Tool '{r['tool']}' returned:\n{json.dumps(r.get('result', r.get('error', '')), indent=2)}"
                    for r in tool_results
                ])
                messages.append({"role": "user", "content": f"Here are the tool results. Use them to provide a complete answer to the user. Do NOT call any more tools.\n\n{tool_context}"})
                
                async with self.openai_client.chat.completions.stream(
                    model=model, messages=messages, temperature=temperature, max_tokens=2048,
                ) as follow_up:
                    async for chunk in follow_up:
                        delta = chunk.choices[0].delta.content
                        if delta:
                            yield f"data: {json.dumps({'content': delta, 'done': False})}\n\n"
            
            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    # ============================================================
    # OLLAMA STREAMING (Option B)
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
        """Stream response from Ollama with tool support"""
        
        messages = self._build_messages(history, user_message, mode, system_prompt, rag_context)
        model = model or settings.OLLAMA_DEFAULT_MODEL
        
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature}
        }
        
        try:
            accumulated = ""
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload) as response:
                    async for line in response.aiter_lines():
                        if line:
                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            done = data.get("done", False)
                            if content:
                                accumulated += content
                                yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
                            if done:
                                break
            
            # Check for tool calls in the accumulated response
            tool_results = await self._handle_tool_calls(accumulated)
            if tool_results:
                for result in tool_results:
                    yield f"data: {json.dumps({'tool_result': result, 'done': False})}\n\n"
                
                # Follow-up call with tool results
                messages.append({"role": "assistant", "content": accumulated})
                tool_context = "\n\n".join([
                    f"Tool '{r['tool']}' returned:\n{json.dumps(r.get('result', r.get('error', '')), indent=2)}"
                    for r in tool_results
                ])
                messages.append({"role": "user", "content": f"Here are the tool results. Use them to provide a complete answer to the user. Do NOT call any more tools.\n\n{tool_context}"})
                
                follow_payload = {
                    "model": model, "messages": messages,
                    "stream": True, "options": {"temperature": temperature}
                }
                
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream("POST", f"{settings.OLLAMA_BASE_URL}/api/chat", json=follow_payload) as response:
                        async for line in response.aiter_lines():
                            if line:
                                data = json.loads(line)
                                content = data.get("message", {}).get("content", "")
                                done = data.get("done", False)
                                if content:
                                    yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
                                if done:
                                    break
            
            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
        
        except httpx.ConnectError:
            yield f"data: {json.dumps({'error': 'Cannot connect to Ollama. Make sure it is running on ' + settings.OLLAMA_BASE_URL})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    # ============================================================
    # GEMINI STREAMING (Option C) — via official google-genai SDK
    # ============================================================
    async def stream_gemini(
        self,
        history: List[Dict],
        user_message: str,
        images: Optional[List[str]] = None,
        max_tokens: Optional[int] = None,
        top_p: Optional[float] = None,
        model: str = None,
        temperature: float = 0.7,
        mode: str = "default",
        system_prompt: Optional[str] = None,
        rag_context: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream response from Google Gemini via google-genai SDK with multimodal vision and tool support"""
        
        if not self.gemini_client:
            yield "data: " + json.dumps({"error": "Gemini API key not configured. Set GEMINI_API_KEY in .env"}) + "\n\n"
            return
        
        model = model or settings.GEMINI_DEFAULT_MODEL
        # Strip redundant "models/" prefix — the SDK adds it automatically
        if model.startswith("models/"):
            model = model[len("models/"):]
        # Validate: fall back to .env default if model is not in the known valid list
        if model not in VALID_GEMINI_MODELS and model != settings.GEMINI_DEFAULT_MODEL:
            print(f"DEBUG: Model '{model}' not found in valid list, falling back to default: {settings.GEMINI_DEFAULT_MODEL}")
            model = settings.GEMINI_DEFAULT_MODEL
        print(f"DEBUG: Using model: {model}")
        sys_prompt = system_prompt or ROLE_PROMPTS.get(mode, ROLE_PROMPTS["default"])
        
        if rag_context:
            sys_prompt += (
                "\n\n## DOCUMENT CONTEXT (from user-uploaded files)\n"
                "CRITICAL SYSTEM DIRECTIVE: You HAVE full access to read, analyze, and answer questions about the user's uploaded files and PDFs provided in the context below. "
                "NEVER claim that you cannot view, open, or process direct file attachments or uploaded PDFs. "
                "The text content of the uploaded files is extracted and attached below for your immediate inspection.\n\n"
                f"{rag_context}\n\n"
                "## INSTRUCTIONS FOR USING DOCUMENT CONTEXT\n"
                "1. **Prioritize document context**: Base your answers on the retrieved passages above.\n"
                "2. **Cite your sources**: Reference the source filename and page number when answering.\n"
                "3. **Handle tables and data**: Present tabular data using clean markdown tables.\n"
                "4. **Summarize or answer directly**: If the user asks general questions like 'i uploaded pdf' or 'summarize my file', summarize the key points of the attached document passages above.\n"
                "5. **Be precise**: Quote exact figures, dates, and names from the documents when available."
            )
        
        # Add tool descriptions
        tool_desc = tool_registry.get_tool_descriptions()
        if tool_desc:
            sys_prompt += f"\n\n{tool_desc}"
        
        # Build Gemini-format contents
        contents = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))
        
        # Build user parts including text and optional multimodal images
        user_parts = [types.Part.from_text(text=user_message)]
        if images:
            import base64
            for img_str in images:
                try:
                    if "," in img_str:
                        mime_type = img_str.split(";")[0].replace("data:", "")
                        b64_data = img_str.split(",")[1]
                    else:
                        mime_type = "image/jpeg"
                        b64_data = img_str
                    img_bytes = base64.b64decode(b64_data)
                    user_parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime_type))
                except Exception as img_err:
                    print(f"Warning: failed to decode image part: {img_err}")
        
        contents.append(types.Content(role="user", parts=user_parts))
        
        config_kwargs = {
            "system_instruction": sys_prompt,
            "temperature": temperature,
            "max_output_tokens": max_tokens or 2048,
        }
        if top_p is not None:
            config_kwargs["top_p"] = top_p
            
        config = types.GenerateContentConfig(**config_kwargs)
        
        try:
            accumulated = ""
            last_error = None
            # Retry up to 3 times with exponential backoff for 503/UNAVAILABLE errors
            for attempt in range(3):
                try:
                    response = await self.gemini_client.aio.models.generate_content_stream(
                        model=model,
                        contents=contents,
                        config=config,
                    )
                    async for chunk in response:
                        text = chunk.text or ""
                        if text:
                            accumulated += text
                            yield f"data: {json.dumps({'content': text, 'done': False})}\n\n"
                    last_error = None
                    break  # Success — exit retry loop
                except Exception as retry_err:
                    err_str = str(retry_err)
                    is_transient = any(k in err_str for k in ["503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "404", "NOT_FOUND"])
                    if is_transient:
                        last_error = retry_err
                        # Try fallback models in priority order
                        fallback_candidates = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
                        succeeded = False
                        for fb in fallback_candidates:
                            if fb == model:
                                continue
                            print(f"DEBUG: Model '{model}' failed ({err_str[:80]}), trying fallback '{fb}'...")
                            switch_msg = f"⚠️ *Note: {model} reached rate limit. Switched to {fb} for a seamless response.*\n\n"
                            yield f"data: {json.dumps({'content': switch_msg, 'done': False})}\n\n"
                            try:
                                accumulated = ""
                                response = await self.gemini_client.aio.models.generate_content_stream(
                                    model=fb, contents=contents, config=config,
                                )
                                async for chunk in response:
                                    text = chunk.text or ""
                                    if text:
                                        accumulated += text
                                        yield f"data: {json.dumps({'content': text, 'done': False})}\n\n"
                                model = fb
                                last_error = None
                                succeeded = True
                                break
                            except Exception as fb_err:
                                print(f"DEBUG: Fallback '{fb}' failed too: {fb_err}")
                                last_error = fb_err
                        if succeeded:
                            break
                    else:
                        raise
            
            if last_error:
                yield f"data: {json.dumps({'error': str(last_error)})}\n\n"
                return
            
            # Check for tool calls
            tool_results = await self._handle_tool_calls(accumulated)
            if tool_results:
                for result in tool_results:
                    yield f"data: {json.dumps({'tool_result': result, 'done': False})}\n\n"
                    # If an image was generated, yield markdown directly to render the image card
                    if result.get("tool") == "generate_image" and isinstance(result.get("result"), dict):
                        md = result["result"].get("markdown")
                        if md:
                            img_content = "\n\n" + md
                            yield f"data: {json.dumps({'content': img_content, 'done': False})}\n\n"
                
                # If tool was generate_image, image card is already emitted; skip redundant follow-up call
                has_image_tool = any(r.get("tool") == "generate_image" for r in tool_results)
                if not has_image_tool:
                    contents.append(types.Content(role="model", parts=[types.Part.from_text(text=accumulated)]))
                    tool_context = "\n\n".join([
                        f"Tool '{r['tool']}' returned:\n{json.dumps(r.get('result', r.get('error', '')), indent=2)}"
                        for r in tool_results
                    ])
                    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=f"Here are the tool results. Use them to provide a complete answer. Do NOT call any more tools.\n\n{tool_context}")]))
                    
                    try:
                        follow_up = await self.gemini_client.aio.models.generate_content_stream(
                            model=model,
                            contents=contents,
                            config=config,
                        )
                        async for chunk in follow_up:
                            text = chunk.text or ""
                            if text:
                                yield f"data: {json.dumps({'content': text, 'done': False})}\n\n"
                    except Exception as follow_err:
                        print(f"DEBUG: Follow-up stream error ignored: {follow_err}")
            else:
                # Direct Image Prompt Fallback: If user asks to generate an image but LLM didn't call tool block
                msg_lower = user_message.lower()
                is_image_req = any(k in msg_lower for k in ["generate an image", "generate image", "draw an image", "draw image", "create an image", "make an image"]) or msg_lower.startswith("draw ")
                if is_image_req:
                    print(f"DEBUG: Triggering direct image generation fallback for: '{user_message}'")
                    try:
                        from app.services.image_service import image_service
                        img_res = await image_service.generate_image(user_message)
                        md = f"![{img_res['prompt']}]({img_res['url']})"
                        direct_img_content = "\n\nHere is your generated image:\n\n" + md
                        yield f"data: {json.dumps({'content': direct_img_content, 'done': False})}\n\n"
                    except Exception as direct_img_err:
                        print(f"DEBUG: Direct image fallback error: {direct_img_err}")
            
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
            if not self.gemini_client:
                return "Untitled Chat"
            gemini_model = model or settings.GEMINI_DEFAULT_MODEL
            # Strip redundant "models/" prefix — the SDK adds it automatically
            if gemini_model.startswith("models/"):
                gemini_model = gemini_model[len("models/"):]
            # Validate: fall back to .env default if model is not in the known valid list
            if gemini_model not in VALID_GEMINI_MODELS and gemini_model != settings.GEMINI_DEFAULT_MODEL:
                print(f"DEBUG: Model '{gemini_model}' not found in valid list, falling back to default: {settings.GEMINI_DEFAULT_MODEL}")
                gemini_model = settings.GEMINI_DEFAULT_MODEL
            print(f"DEBUG: Using model (complete): {gemini_model}")
            contents = []
            for msg in messages:
                role = "user" if msg["role"] == "user" else "model"
                contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))
            try:
                response = await self.gemini_client.aio.models.generate_content(
                    model=gemini_model,
                    contents=contents,
                    config=types.GenerateContentConfig(max_output_tokens=20),
                )
                return response.text or "Untitled Chat"
            except Exception:
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
