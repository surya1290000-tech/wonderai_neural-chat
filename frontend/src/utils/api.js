import axios from 'axios'

const BASE = '/api'

// Axios instance with auth token injection
const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('nc_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-refresh token on 401, then retry the request once
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  r => r,
  async err => {
    const originalRequest = err.config
    
    if (err.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('nc_refresh_token')
      
      if (!refreshToken) {
        localStorage.removeItem('nc_token')
        localStorage.removeItem('nc_refresh_token')
        localStorage.removeItem('nc_user')
        window.location.href = '/login'
        return Promise.reject(err)
      }
      
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      try {
        const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: refreshToken })
        const newToken = data.token
        localStorage.setItem('nc_token', newToken)
        localStorage.setItem('nc_user', JSON.stringify(data.user))
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        localStorage.removeItem('nc_token')
        localStorage.removeItem('nc_refresh_token')
        localStorage.removeItem('nc_user')
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(err)
  }
)

// Auth
export const authAPI = {
  register: (d) => api.post('/auth/register', d),
  verifyEmail: (d) => api.post('/auth/verify-email', d),
  login: (d) => api.post('/auth/login', d),
  verify2FA: (d) => api.post('/auth/verify-2fa', d),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (d) => api.post('/auth/change-password', d),
  forgotPassword: (d) => api.post('/auth/forgot-password', d),
  resetPassword: (d) => api.post('/auth/reset-password', d),
}

// Chat sessions
export const chatAPI = {
  getSessions: (limit = 50, offset = 0) => api.get(`/chat/sessions?limit=${limit}&offset=${offset}`),
  createSession: (d) => api.post('/chat/sessions', d),
  deleteSession: (id) => api.delete(`/chat/sessions/${id}`),
  updateSession: (id, d) => api.patch(`/chat/sessions/${id}`, d),
  getMessages: (id, limit = 100, offset = 0) => api.get(`/chat/sessions/${id}/messages?limit=${limit}&offset=${offset}`),
  exportSession: (id, format = 'markdown') => api.get(`/chat/sessions/${id}/export?format=${format}`),
  messageFeedback: (sessionId, messageId, feedback) => api.post(`/chat/sessions/${sessionId}/messages/${messageId}/feedback`, { feedback }),
  search: (q, limit = 20) => api.get(`/chat/search?q=${encodeURIComponent(q)}&limit=${limit}`),
}

// Models
export const modelsAPI = {
  list: () => api.get('/models/'),
}

// RAG (session-scoped)
export const ragAPI = {
  upload: (file, sessionId) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post(`/rag/upload?session_id=${sessionId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  ingestUrl: (url, sessionId) => api.post(`/rag/ingest-url?session_id=${sessionId}`, { url }),
  getDocuments: (sessionId) => api.get(`/rag/documents?session_id=${sessionId}`),
  deleteDocument: (id, sessionId) => api.delete(`/rag/documents/${id}?session_id=${sessionId}`),
  stats: (sessionId) => api.get(`/rag/stats?session_id=${sessionId}`),
}

// Images API
export const imagesAPI = {
  generate: (d) => api.post('/images/generate', d),
}

// Agents API (Custom GPTs / Persona Studio)
export const agentsAPI = {
  list: () => api.get('/agents/'),
  create: (d) => api.post('/agents/', d),
  get: (id) => api.get(`/agents/${id}`),
  update: (id, d) => api.patch(`/agents/${id}`, d),
  delete: (id) => api.delete(`/agents/${id}`),
  share: (id) => api.post(`/agents/${id}/share`),
  getShared: (shareId) => api.get(`/agents/shared/${shareId}`),
  clone: (shareId) => api.post(`/agents/shared/${shareId}/clone`),
  featured: () => api.get('/agents/discover/featured'),
}

/**
 * STREAMING: Opens a fetch SSE connection to the streaming endpoint
 * Returns an EventSource-like stream via ReadableStream
 * Supports AbortController signal, images, max_tokens, top_p
 */
export async function streamMessage(sessionId, content, useRag, onChunk, onDone, onError, signal, opts = {}) {
  const token = localStorage.getItem('nc_token')
  try {
    const body = {
      content,
      use_rag: useRag,
      images: opts.images || null,
      max_tokens: opts.maxTokens || null,
      top_p: opts.topP || null,
    }
    const response = await fetch(`${BASE}/chat/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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
          // Emit web search sources for citation rendering
          if (data.web_sources && opts.onSources) {
            opts.onSources(data.web_sources)
          }
          // Emit tool result for search animation indicators
          if (data.tool_result && opts.onToolResult) {
            opts.onToolResult(data.tool_result)
          }
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
