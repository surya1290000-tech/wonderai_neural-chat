import axios from 'axios'

const BASE = '/api'

// Axios instance with auth token injection
const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('nc_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nc_token')
      localStorage.removeItem('nc_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authAPI = {
  register: (d) => api.post('/auth/register', d),
  login: (d) => api.post('/auth/login', d),
  me: () => api.get('/auth/me'),
}

// Chat sessions
export const chatAPI = {
  getSessions: () => api.get('/chat/sessions'),
  createSession: (d) => api.post('/chat/sessions', d),
  deleteSession: (id) => api.delete(`/chat/sessions/${id}`),
  updateSession: (id, d) => api.patch(`/chat/sessions/${id}`, d),
  getMessages: (id) => api.get(`/chat/sessions/${id}/messages`),
}

// Models
export const modelsAPI = {
  list: () => api.get('/models/'),
}

// RAG
export const ragAPI = {
  upload: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/rag/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  stats: () => api.get('/rag/stats'),
}

/**
 * STREAMING: Opens a fetch SSE connection to the streaming endpoint
 * Returns an EventSource-like stream via ReadableStream
 * Now supports AbortController signal for stop generation
 */
export async function streamMessage(sessionId, content, useRag, onChunk, onDone, onError, signal) {
  const token = localStorage.getItem('nc_token')
  try {
    const response = await fetch(`${BASE}/chat/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content, use_rag: useRag }),
      signal,
    })

    if (!response.ok) {
      onError('API error: ' + response.statusText)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value)
      const lines = text.split('\n').filter(l => l.startsWith('data: '))

      for (const line of lines) {
        try {
          const data = JSON.parse(line.replace('data: ', ''))
          if (data.error) { onError(data.error); return }
          if (data.done) { onDone(); return }
          if (data.content) onChunk(data.content)
        } catch { /* partial chunk */ }
      }
    }
    onDone()
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone()
    } else {
      onError(err.message)
    }
  }
}

export default api
