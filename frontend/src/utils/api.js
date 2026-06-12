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
  login: (d) => api.post('/auth/login', d),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (d) => api.post('/auth/change-password', d),
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
  getDocuments: (sessionId) => api.get(`/rag/documents?session_id=${sessionId}`),
  deleteDocument: (id, sessionId) => api.delete(`/rag/documents/${id}?session_id=${sessionId}`),
  stats: (sessionId) => api.get(`/rag/stats?session_id=${sessionId}`),
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
