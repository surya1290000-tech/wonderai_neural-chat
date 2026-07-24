import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import ChatHeader from '../components/ChatHeader'
import MessageBubble from '../components/MessageBubble'
import ChatInput from '../components/ChatInput'
import KnowledgePanel from '../components/KnowledgePanel'
import ArtifactsPanel from '../components/ArtifactsPanel'
import { chatAPI, streamMessage, ragAPI, modelsAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'

const SUGGESTIONS = [
  { icon: '💡', label: 'Explain quantum computing', desc: 'in simple terms' },
  { icon: '✍️', label: 'Write a creative story', desc: 'about time travel' },
  { icon: '🎓', label: 'Help me study', desc: 'for my exams' },
  { icon: '🚀', label: 'Plan a side project', desc: 'from idea to launch' },
]

function WelcomeScreen({ username, onSuggestionClick }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', animation: 'fadeIn 0.6s ease',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{
          fontFamily: 'Outfit', fontSize: 42, fontWeight: 700,
          margin: 0, marginBottom: 8, letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #d4845e 0%, #e8b89a 50%, #d4845e 100%)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          animation: 'shimmer 4s linear infinite',
        }}>
          {greeting}, {username || 'there'}
        </h1>
        <p style={{
          color: '#666', fontSize: 17, margin: 0, fontWeight: 400,
          fontFamily: 'Inter',
        }}>
          How can I help you today?
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12, maxWidth: 560, width: '100%',
      }}>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(s.label + ' ' + s.desc)}
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16, padding: '18px 20px',
              textAlign: 'left', cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
              animation: `fadeInUp 0.5s ease ${i * 0.08}s both`,
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(212,132,94,0.06)'
              e.currentTarget.style.borderColor = 'rgba(212,132,94,0.2)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 10 }}>{s.icon}</div>
            <div style={{
              fontSize: 14, fontWeight: 600, color: '#ccc',
              marginBottom: 4, fontFamily: 'Outfit',
            }}>{s.label}</div>
            <div style={{
              fontSize: 13, color: '#666', fontWeight: 400,
            }}>{s.desc}</div>
          </button>
        ))}
      </div>

      <div style={{
        marginTop: 48, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6,
          background: 'linear-gradient(135deg,#d4845e,#c07050)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#fff',
        }}>✦</div>
        <span style={{ fontSize: 12, color: '#444', fontWeight: 500 }}>
          Powered by Wonder AI
        </span>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [useRag, setUseRag] = useState(false)
  const [notification, setNotification] = useState(null)
  const [defaultModel, setDefaultModel] = useState('mistral')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const [kbRefresh, setKbRefresh] = useState(0)
  const [activeArtifact, setActiveArtifact] = useState(null)
  const bottomRef = useRef()
  const abortRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => { scrollToBottom() }, [messages])

  // Fetch default model from backend on mount
  useEffect(() => {
    modelsAPI.list().then(({ data }) => {
      if (data.default) setDefaultModel(data.default)
    }).catch(() => { })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Ctrl+N: New chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        createNewChat()
      }
      // Ctrl+/: Focus input
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      // Ctrl+Shift+S: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        setSidebarCollapsed(prev => !prev)
      }
      // Ctrl+Shift+E: Export chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        if (activeSessionId) handleExport('markdown')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeSessionId])

  const loadSession = async (id) => {
    if (!id) {
      setActiveSessionId(null)
      setActiveSession(null)
      setMessages([])
      return
    }
    try {
      const { data: msgs } = await chatAPI.getMessages(id)
      const session = sessions.find(s => s.id === id)
      setActiveSession(session)
      setActiveSessionId(id)
      setMessages(msgs)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { if (activeSessionId) loadSession(activeSessionId) }, [activeSessionId])

  const createNewChat = async () => {
    setActiveSessionId(null)
    setActiveSession(null)
    setMessages([])
  }

  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleExport = async (format = 'markdown') => {
    if (!activeSessionId) return
    try {
      const { data } = await chatAPI.exportSession(activeSessionId, format)
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activeSession?.title || 'chat'}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const blob = new Blob([data.content], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.filename || 'chat.md'
        a.click()
        URL.revokeObjectURL(url)
      }
      showNotif('Chat exported successfully')
    } catch (e) {
      showNotif('Failed to export chat', 'error')
    }
  }

  const handleFeedback = useCallback(async (messageId, feedback) => {
    if (!activeSessionId) return
    try {
      await chatAPI.messageFeedback(activeSessionId, messageId, feedback)
    } catch (e) { console.error('Failed to save feedback:', e) }
  }, [activeSessionId])

  const handleSend = useCallback(async (content, images = null) => {
    if (streaming) return

    // Slash commands
    if (content && content.startsWith('/')) {
      const cmd = content.toLowerCase().trim()
      if (cmd === '/clear') {
        setMessages([])
        showNotif('Conversation cleared locally')
        return
      }
      if (cmd === '/export' || cmd === '/export md') {
        handleExport('markdown')
        return
      }
      if (cmd === '/export json') {
        handleExport('json')
        return
      }
      if (cmd.startsWith('/mode ')) {
        const mode = cmd.replace('/mode ', '').trim()
        if (['default', 'writer', 'student', 'director'].includes(mode) && activeSessionId) {
          await chatAPI.updateSession(activeSessionId, { mode })
          setActiveSession(prev => ({ ...prev, mode }))
          showNotif(`Mode changed to ${mode}`)
          return
        }
      }
    }

    let sessionId = activeSessionId
    let session = activeSession

    if (!sessionId) {
      try {
        const { data } = await chatAPI.createSession({
          title: 'New Chat',
          mode: 'default',
          model: defaultModel,
          temperature: 0.7
        })
        sessionId = data.id
        session = data
        setSessions(prev => [data, ...prev])
        setActiveSessionId(data.id)
        setActiveSession(data)
      } catch (e) { showNotif('Failed to create session', 'error'); return }
    }

    const userMsg = { id: Date.now().toString(), role: 'user', content, meta: { images }, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])

    const aiMsgId = Date.now().toString() + '-ai'
    setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', created_at: new Date().toISOString() }])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    await streamMessage(
      sessionId, content, useRag,
      (chunk) => {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + chunk } : m))
      },
      () => {
        setStreaming(false)
        abortRef.current = null
        setMessages(prev => {
          const finished = prev.map(m => m.id === aiMsgId ? { ...m, id: aiMsgId + '-done' } : m)
          const last = finished.find(m => m.id === aiMsgId + '-done')
          if (last && !last.content.trim()) {
            return finished.map(m => m.id === aiMsgId + '-done' ? {
              ...m,
              content: "⚠️ **Empty Response Received**\n\nThe AI provider returned an empty response. This can happen if the model process crashed or timed out. Please try regenerating or check your `backend/.env` settings."
            } : m)
          }
          return finished
        })
        chatAPI.getSessions().then(({ data }) => setSessions(data)).catch(() => { })
      },
      (err) => {
        setStreaming(false)
        abortRef.current = null
        setMessages(prev => prev.map(m => m.id === aiMsgId
          ? { ...m, content: `⚠️ **Connection Error**\n\n${err}\n\n_Make sure your AI provider is running. Check \`backend/.env\` for configuration._` }
          : m
        ))
        showNotif('AI provider error — check your backend configuration', 'error')
      },
      controller.signal,
      { images }
    )
  }, [activeSessionId, activeSession, streaming, useRag, defaultModel])

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      setStreaming(false)
      abortRef.current = null
    }
  }, [])

  const handleRegenerate = useCallback((messageId) => {
    const idx = messages.findIndex(m => m.id === messageId)
    if (idx <= 0) return
    const userMsg = messages[idx - 1]
    if (userMsg?.role !== 'user') return

    setMessages(prev => prev.filter(m => m.id !== messageId))
    setTimeout(() => handleSend(userMsg.content), 100)
  }, [messages, handleSend])

  const handleUploadPDF = async (file) => {
    let sessionId = activeSessionId
    // Auto-create a session if none is active
    if (!sessionId) {
      try {
        const { data } = await chatAPI.createSession({
          title: 'New Chat',
          mode: 'default',
          model: defaultModel,
          temperature: 0.7
        })
        sessionId = data.id
        setSessions(prev => [data, ...prev])
        setActiveSessionId(data.id)
        setActiveSession(data)
      } catch (e) {
        showNotif('Failed to create session for upload', 'error')
        return
      }
    }
    try {
      showNotif('Uploading PDF...', 'info')
      await ragAPI.upload(file, sessionId)
      setUseRag(true)  // Auto-enable RAG after successful document upload
      showNotif(`✓ "${file.name}" ingested. RAG mode auto-enabled — ask questions about it!`)
      setKbRefresh(prev => prev + 1) // Trigger KB panel update
    } catch (e) {
      showNotif('Failed to upload PDF', 'error')
    }
  }

  const isWelcome = messages.length === 0

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
      <Sidebar
        activeSession={activeSessionId}
        onSelectSession={(id) => { setActiveSessionId(id); loadSession(id) }}
        onNewChat={createNewChat}
        sessions={sessions}
        setSessions={setSessions}
      />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
        background: '#0c0c0c',
      }}>
        <ChatHeader
          session={activeSession}
          onSessionUpdate={(s) => {
            setActiveSession(s)
            setSessions(prev => prev.map(p => p.id === s.id ? s : p))
          }}
          onExport={handleExport}
          onToggleKB={() => setKbOpen(!kbOpen)}
          kbOpen={kbOpen}
        />

        {isWelcome ? (
          <WelcomeScreen
            username={user?.username}
            onSuggestionClick={handleSend}
          />
        ) : (
          <div style={{
            flex: 1, overflowY: 'auto',
            paddingTop: 20, paddingBottom: 20,
            background: '#0c0c0c',
          }}>
            {messages.map((msg, i) => (
              <div key={msg.id || i}>
                {i > 0 && msg.role !== messages[i - 1]?.role && (
                  <div style={{
                    display: 'flex', justifyContent: 'center', padding: '0 24px',
                  }}>
                    <div style={{
                      maxWidth: 'var(--content-max-width, 780px)', width: '100%',
                      borderTop: '1px solid rgba(255,255,255,0.04)',
                    }} />
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isStreaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
                  onRegenerate={handleRegenerate}
                  onFeedback={handleFeedback}
                  onOpenArtifact={(art) => setActiveArtifact(art)}
                />
              </div>
            ))}

            {streaming && messages[messages.length - 1]?.content === '' && (
              <div style={{
                display: 'flex', justifyContent: 'center',
                padding: '14px 24px',
              }}>
                <div style={{
                  maxWidth: 'var(--content-max-width, 780px)', width: '100%',
                  display: 'flex', gap: 16, alignItems: 'center',
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 10,
                    background: 'linear-gradient(135deg,#d4845e,#c07050)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#fff',
                    animation: 'breathe 2s ease infinite',
                  }}>✦</div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: '#d4845e',
                        animation: 'pulse 1.4s ease infinite',
                        animationDelay: `${i * 0.2}s`,
                      }} />
                    ))}
                    <span style={{ color: '#777', fontSize: 13, marginLeft: 8, fontWeight: 400 }}>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        <ChatInput
          ref={inputRef}
          onSend={handleSend}
          disabled={streaming}
          useRag={useRag}
          setUseRag={setUseRag}
          onUploadPDF={handleUploadPDF}
          onStop={handleStop}
          streaming={streaming}
        />
      </div>

      {/* Artifacts Side Panel */}
      <ArtifactsPanel
        artifact={activeArtifact}
        onClose={() => setActiveArtifact(null)}
      />

      {/* Notification toast */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: 100, right: 24,
          background: notification.type === 'error' ? '#2a1515' : notification.type === 'info' ? '#1a1a26' : '#152a1f',
          color: notification.type === 'error' ? '#f87171' : notification.type === 'info' ? '#93a7f5' : '#4ade80',
          border: `1px solid ${notification.type === 'error' ? 'rgba(248,113,113,0.2)' : notification.type === 'info' ? 'rgba(147,167,245,0.2)' : 'rgba(74,222,128,0.2)'}`,
          padding: '12px 20px', borderRadius: 14,
          fontSize: 13, fontWeight: 500,
          zIndex: 1000,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          animation: 'fadeInUp 0.3s ease forwards',
          backdropFilter: 'blur(12px)',
          maxWidth: 400,
        }}>
          {notification.msg}
        </div>
      )}

      <KnowledgePanel
        isOpen={kbOpen}
        onClose={() => setKbOpen(false)}
        onUploadDocument={handleUploadPDF}
        showNotif={showNotif}
        sessionId={activeSessionId}
        refreshTrigger={kbRefresh}
      />
    </div>
  )
}
