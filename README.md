# NeuralChat — Production AI Assistant v2.0

A full-stack AI chat application with RAG support, streaming, auth, multiple LLM backends, and a premium dark/light UI.

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

## AI Provider Options

### Option A: OpenAI
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

### Option B: Ollama (Open Source — Free, Local)
```bash
# Install: https://ollama.ai
ollama pull mistral
ollama serve
```
```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=mistral
```

### Option C: Google Gemini
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key
GEMINI_DEFAULT_MODEL=gemini-2.0-flash
```

---

## Docker Deployment

```bash
cp backend/.env.example .env
docker-compose up --build
docker exec neuralchat-ollama-1 ollama pull mistral
```

---

## Architecture

```
project/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + middleware
│   │   ├── config.py            # Environment config + validation
│   │   ├── database.py          # SQLAlchemy async setup
│   │   ├── middleware/
│   │   │   ├── rate_limit.py    # Per-IP rate limiting
│   │   │   └── logging.py       # Structured request logging
│   │   ├── routes/
│   │   │   ├── auth.py          # JWT login/register/refresh/logout
│   │   │   ├── chat.py          # Sessions + SSE streaming + export + search
│   │   │   ├── rag.py           # PDF upload endpoint
│   │   │   └── models.py        # Model listing
│   │   ├── services/
│   │   │   ├── ai_service.py    # OpenAI + Ollama + Gemini
│   │   │   └── rag_service.py   # FAISS + embeddings
│   │   ├── models/
│   │   │   ├── user.py          # User SQLAlchemy model
│   │   │   └── chat.py          # ChatSession + Message models
│   │   └── utils/
│   │       └── auth.py          # JWT + bcrypt + refresh tokens
│   ├── tests/
│   │   └── test_api.py          # Comprehensive API tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── App.jsx              # Routing + theme + error boundary
│       ├── pages/
│       │   ├── ChatPage.jsx     # Main chat UI + streaming + shortcuts
│       │   ├── AuthPage.jsx     # Login/Register
│       │   └── SettingsPage.jsx # User settings + theme + password
│       ├── components/
│       │   ├── Sidebar.jsx      # Chat history + search + rename
│       │   ├── MessageBubble.jsx # Markdown + code + feedback
│       │   ├── ChatInput.jsx    # Input + drag-drop + slash commands
│       │   ├── ChatHeader.jsx   # Mode/model/temp + export
│       │   └── ErrorBoundary.jsx
│       ├── utils/api.js         # Axios + SSE + auto-refresh
│       ├── context/
│       │   ├── AuthContext.jsx  # Auth state + token management
│       │   └── ThemeContext.jsx  # Dark/light/auto theme
│       ├── hooks/
│       │   └── useNotification.js
│       └── styles/
│           └── globals.css      # Design system + themes
├── docker-compose.yml
└── README.md
```

---

## Features

| Feature | Status |
|---------|--------|
| OpenAI GPT-4o/mini integration | ✅ |
| Ollama (Mistral, LLaMA) | ✅ |
| Google Gemini | ✅ |
| Real-time streaming (SSE) | ✅ |
| JWT auth + refresh tokens | ✅ |
| Token blacklist (logout) | ✅ |
| Input validation & rate limiting | ✅ |
| Change password | ✅ |
| Chat history (SQLite) | ✅ |
| Chat export (Markdown/JSON) | ✅ |
| Message search | ✅ |
| Message feedback (like/dislike) | ✅ |
| PDF upload + RAG | ✅ |
| FAISS vector search | ✅ |
| Role modes (Writer/Student/Director) | ✅ |
| Temperature control | ✅ |
| Model switching | ✅ |
| Markdown + code highlighting | ✅ |
| Dark/Light/Auto theme | ✅ |
| Keyboard shortcuts | ✅ |
| Slash commands (/clear, /export, /mode) | ✅ |
| Drag-and-drop PDF upload | ✅ |
| Read aloud (Web Speech API) | ✅ |
| Conversation search & rename | ✅ |
| Settings page | ✅ |
| Structured logging | ✅ |
| Responsive dark UI | ✅ |
| Docker deployment | ✅ |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New conversation |
| `Ctrl + /` | Focus message input |
| `Ctrl + Shift + S` | Toggle sidebar |
| `Ctrl + Shift + E` | Export chat |
| `Enter` | Send message |
| `Shift + Enter` | New line |

## Slash Commands

| Command | Action |
|---------|--------|
| `/clear` | Clear conversation locally |
| `/export` | Export as Markdown |
| `/export json` | Export as JSON |
| `/mode writer` | Switch to Writer mode |

---

## API Documentation

### Auth
```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"testuser","password":"secret123"}'
# Returns: {"token": "...", "refresh_token": "...", "user": {...}}

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'

# Refresh Token
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"eyJ..."}'

# Logout
curl -X POST http://localhost:8000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Change Password
curl -X POST http://localhost:8000/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"secret123","new_password":"newsecret456"}'
```

### Chat
```bash
TOKEN="eyJ..."

# Create session
curl -X POST http://localhost:8000/api/chat/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Chat","mode":"default","model":"gpt-4o-mini","temperature":0.7}'

# List sessions (with pagination)
curl "http://localhost:8000/api/chat/sessions?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"

# Stream a message (SSE)
curl -N -X POST http://localhost:8000/api/chat/sessions/{ID}/messages/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Explain quantum computing","use_rag":false}'

# Export chat
curl http://localhost:8000/api/chat/sessions/{ID}/export?format=markdown \
  -H "Authorization: Bearer $TOKEN"

# Search messages
curl "http://localhost:8000/api/chat/search?q=quantum&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Message feedback
curl -X POST http://localhost:8000/api/chat/sessions/{SID}/messages/{MID}/feedback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feedback":"up"}'
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
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | `openai`, `ollama`, or `gemini` |
| `OPENAI_API_KEY` | — | Your OpenAI API key |
| `OPENAI_DEFAULT_MODEL` | `gpt-4o-mini` | Default model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_DEFAULT_MODEL` | `mistral` | Default Ollama model |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `GEMINI_DEFAULT_MODEL` | `gemini-2.0-flash` | Default Gemini model |
| `SECRET_KEY` | — | JWT signing key |
| `JWT_EXPIRY_HOURS` | `24` | Access token lifetime |
| `JWT_REFRESH_EXPIRY_DAYS` | `30` | Refresh token lifetime |
| `RATE_LIMIT_RPM` | `60` | Rate limit (requests/min) |
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `MAX_MESSAGE_LENGTH` | `32000` | Max message characters |
| `MAX_HISTORY_MESSAGES` | `50` | Context window limit |
| `CHUNK_SIZE` | `500` | RAG chunk size (words) |
| `TOP_K_RESULTS` | `3` | RAG retrieval count |

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```
