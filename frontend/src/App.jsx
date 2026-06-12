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

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
              <Route path="/" element={<Protected><ChatPage /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
