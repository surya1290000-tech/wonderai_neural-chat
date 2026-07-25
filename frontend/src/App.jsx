import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import ChatPage from './pages/ChatPage'
import AuthPage from './pages/AuthPage'
import SettingsPage from './pages/SettingsPage'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--accent)', fontFamily: 'Outfit' }}>Loading...</div>
  return user ? children : <Navigate to="/login" />
}

function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: 'var(--bg-base)',
      fontFamily: 'var(--font-body)', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 80, marginBottom: 16, opacity: 0.3,
      }}>404</div>
      <h1 style={{
        fontFamily: 'Outfit', fontSize: 24, fontWeight: 700,
        color: 'var(--text-primary)', marginBottom: 8,
      }}>Page not found</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 24 }}>
        The page you're looking for doesn't exist.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'var(--accent)', color: '#fff', border: 'none',
          borderRadius: 12, padding: '12px 28px', fontWeight: 600, fontSize: 14,
          cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s',
          boxShadow: '0 4px 16px rgba(212,132,94,0.25)',
        }}
      >
        Go Home
      </button>
    </div>
  )
}

import { useParams } from 'react'
import { agentsAPI } from './utils/api'
import { useState, useEffect } from 'react'

function SharedAgentHandler() {
  const { shareId } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cloning, setCloning] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (shareId) {
      agentsAPI.getShared(shareId)
        .then(({ data }) => setAgent(data))
        .catch(err => setError(err.response?.data?.detail || 'Shared agent not found'))
        .finally(() => setLoading(false))
    }
  }, [shareId])

  const handleClone = async () => {
    setCloning(true)
    try {
      await agentsAPI.clone(shareId)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clone agent')
      setCloning(false)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#d4845e', fontFamily: 'Outfit' }}>Loading shared agent...</div>
  }

  if (error || !agent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0c0c0c', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontFamily: 'Outfit', color: '#f87171', marginBottom: 8 }}>{error || 'Agent Not Found'}</h2>
        <button onClick={() => navigate('/')} style={{ background: '#d4845e', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600 }}>
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0c0c0c', padding: 24 }}>
      <div style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 40, maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 25px 70px rgba(0,0,0,0.8)' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: `linear-gradient(135deg, ${agent.avatar_color || '#d4845e'}, ${agent.avatar_color || '#d4845e'}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 42, margin: '0 auto 20px',
          boxShadow: `0 10px 30px ${agent.avatar_color || '#d4845e'}44`,
        }}>{agent.avatar_emoji || '🤖'}</div>
        <h2 style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 700, color: '#f0f0f0', margin: '0 0 8px' }}>{agent.name}</h2>
        <p style={{ color: '#888', fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>{agent.description || 'Shared AI Agent persona'}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 12, color: '#aaa', background: 'rgba(255,255,255,0.04)', padding: '4px 12px', borderRadius: 20 }}>Model: {agent.model || 'Default'}</span>
          <span style={{ fontSize: 12, color: '#aaa', background: 'rgba(255,255,255,0.04)', padding: '4px 12px', borderRadius: 20 }}>Temp: {agent.temperature}</span>
        </div>
        <button
          onClick={handleClone}
          disabled={cloning}
          style={{ width: '100%', background: '#d4845e', color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 600, fontFamily: 'Outfit', cursor: 'pointer', boxShadow: '0 4px 16px rgba(212,132,94,0.25)' }}
        >
          {cloning ? 'Adding to your agents...' : 'Add to My Agents & Chat'}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
              <Route path="/agents/shared/:shareId" element={<Protected><SharedAgentHandler /></Protected>} />
              <Route path="/" element={<Protected><ChatPage /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
