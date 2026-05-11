# NeuralChat — Production AI Assistant

A full-stack AI chat application with RAG support, streaming, auth, and multiple LLM backends.

---

## Quick Start (Local Dev)

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — add your OPENAI_API_KEY or set AI_PROVIDER=ollama

uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — Register an account and start chatting.

---

## Option A: OpenAI Backend

In `backend/.env`:
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

## Option B: Ollama (Open Source — Free, Local)

```bash
# Install Ollama: https://ollama.ai
ollama pull mistral    # or llama3, gemma2, etc.
ollama serve
```

In `backend/.env`:
```
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=mistral
```

---

## Docker Deployment

```bash
# Copy and configure environment
cp backend/.env.example .env
# Edit .env with your settings

# Build and run everything
docker-compose up --build

# Pull Ollama model (if using Ollama)
docker exec neuralchat-ollama-1 ollama pull mistral
```

---

## Architecture

```
project/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + CORS
│   │   ├── config.py            # Environment config
│   │   ├── database.py          # SQLAlchemy async setup
│   │   ├── routes/
│   │   │   ├── auth.py          # JWT login/register
│   │   │   ├── chat.py          # Sessions + SSE streaming ← STREAMING HERE
│   │   │   ├── rag.py           # PDF upload endpoint
│   │   │   └── models.py        # Model listing
│   │   ├── services/
│   │   │   ├── ai_service.py    # OpenAI + Ollama ← AI LOGIC HERE
│   │   │   └── rag_service.py   # FAISS + embeddings ← RAG HERE
│   │   ├── models/
│   │   │   ├── user.py          # User SQLAlchemy model
│   │   │   └── chat.py          # ChatSession + Message models
│   │   └── utils/
│   │       └── auth.py          # JWT + bcrypt utilities
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       │   ├── ChatPage.jsx     # Main chat UI + streaming client
│       │   └── AuthPage.jsx     # Login/Register
│       ├── components/
│       │   ├── Sidebar.jsx      # Chat history + navigation
│       │   ├── MessageBubble.jsx # Markdown + code rendering
│       │   ├── ChatInput.jsx    # Input + RAG toggle + PDF upload
│       │   └── ChatHeader.jsx   # Mode/model/temp settings
│       ├── utils/api.js         # Axios + SSE streaming client
│       └── context/AuthContext.jsx
├── docker-compose.yml
└── README.md
```

---

## API Documentation

### Auth
```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"testuser","password":"secret123"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'
# Returns: {"token": "eyJ...", "user": {...}}
```

### Chat
```bash
TOKEN="eyJ..."

# Create session
curl -X POST http://localhost:8000/api/chat/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Chat","mode":"default","model":"gpt-4o-mini","temperature":0.7}'

# List sessions
curl http://localhost:8000/api/chat/sessions \
  -H "Authorization: Bearer $TOKEN"

# Stream a message (SSE)
curl -N -X POST http://localhost:8000/api/chat/sessions/{SESSION_ID}/messages/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Explain quantum computing","use_rag":false}'
```

### RAG
```bash
# Upload PDF
curl -X POST http://localhost:8000/api/rag/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.pdf"

# Check vector store stats
curl http://localhost:8000/api/rag/stats \
  -H "Authorization: Bearer $TOKEN"

# Then send message with use_rag: true to query documents
```

### Models
```bash
curl http://localhost:8000/api/models/ -H "Authorization: Bearer $TOKEN"
```

---

## Features

| Feature | Status |
|---------|--------|
| OpenAI GPT-4o/mini integration | ✅ |
| Ollama (Mistral, LLaMA) | ✅ |
| Real-time streaming (SSE) | ✅ |
| JWT authentication | ✅ |
| Chat history (SQLite) | ✅ |
| PDF upload + RAG | ✅ |
| FAISS vector search | ✅ |
| Role modes (Writer/Student/Director) | ✅ |
| Temperature control | ✅ |
| Model switching | ✅ |
| Markdown + code highlighting | ✅ |
| Responsive dark UI | ✅ |
| Docker deployment | ✅ |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | `openai` or `ollama` |
| `OPENAI_API_KEY` | — | Your OpenAI API key |
| `OPENAI_DEFAULT_MODEL` | `gpt-4o-mini` | Default model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_DEFAULT_MODEL` | `mistral` | Default Ollama model |
| `SECRET_KEY` | — | JWT signing key |
| `CHUNK_SIZE` | `500` | RAG chunk size (words) |
| `TOP_K_RESULTS` | `3` | RAG retrieval count |
