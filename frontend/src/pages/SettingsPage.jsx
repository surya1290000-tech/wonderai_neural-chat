import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { authAPI } from '../utils/api'
import { useNavigate } from 'react-router-dom'

const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/bottts/svg?seed=wonder1",
  "https://api.dicebear.com/7.x/bottts/svg?seed=wonder2",
  "https://api.dicebear.com/7.x/bottts/svg?seed=wonder3",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=surya",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
  "https://api.dicebear.com/7.x/identicon/svg?seed=neural",
]

export default function SettingsPage() {
  const { user, logout, updateProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [tab, setTab] = useState('general')
  const [notification, setNotification] = useState(null)
  
  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    avatar_url: user?.avatar_url || AVATAR_PRESETS[0]
  })
  const [profileLoading, setProfileLoading] = useState(false)

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username || '',
        full_name: user.full_name || '',
        avatar_url: user.avatar_url || AVATAR_PRESETS[0]
      })
    }
  }, [user])

  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3500)
  }

  const handleSaveProfile = async () => {
    if (!profileForm.username.trim()) {
      showNotif('Username cannot be empty', 'error')
      return
    }
    setProfileLoading(true)
    try {
      await updateProfile({
        username: profileForm.username.trim(),
        full_name: profileForm.full_name.trim(),
        avatar_url: profileForm.avatar_url.trim()
      })
      showNotif('Profile updated successfully')
    } catch (e) {
      showNotif(e.response?.data?.detail || 'Failed to update profile', 'error')
    }
    setProfileLoading(false)
  }

  const handleChangePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      showNotif('New passwords do not match', 'error')
      return
    }
    if (passwordForm.new.length < 6) {
      showNotif('Password must be at least 6 characters', 'error')
      return
    }
    setPasswordLoading(true)
    try {
      await authAPI.changePassword({
        current_password: passwordForm.current,
        new_password: passwordForm.new,
      })
      showNotif('Password changed successfully')
      setPasswordForm({ current: '', new: '', confirm: '' })
    } catch (e) {
      showNotif(e.response?.data?.detail || 'Failed to change password', 'error')
    }
    setPasswordLoading(false)
  }

  const inputStyle = {
    width: '100%', background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 12, padding: '12px 16px',
    color: 'var(--text-primary)', fontSize: 14,
    transition: 'all 0.25s ease',
  }

  const sectionStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 16, padding: 24,
    marginBottom: 16,
  }

  const tabs = [
    { id: 'general', label: '⚙ General & Profile' },
    { id: 'security', label: '🔒 Security' },
    { id: 'appearance', label: '🎨 Appearance' },
  ]

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 24px', fontFamily: 'var(--font-body)',
    }}>
      {/* Header */}
      <div style={{ maxWidth: 640, width: '100%', marginBottom: 32 }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            fontSize: 14, cursor: 'pointer', marginBottom: 16, display: 'flex',
            alignItems: 'center', gap: 6, fontWeight: 500,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          ← Back to chat
        </button>
        <h1 style={{
          fontFamily: 'Outfit', fontSize: 28, fontWeight: 700,
          color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em',
        }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
          Manage your account, profile, and preferences
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        maxWidth: 640, width: '100%', marginBottom: 24,
        display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)',
        borderRadius: 14, padding: 4,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 12,
              background: tab === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              border: 'none', transition: 'all 0.25s ease',
              fontFamily: 'Outfit',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, width: '100%' }}>
        {tab === 'general' && (
          <div style={{ animation: 'fadeInUp 0.3s ease' }}>
            <div style={sectionStyle}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Profile Information</h3>
              
              {/* Avatar Selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Avatar</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <img
                    src={profileForm.avatar_url}
                    alt="Avatar Preview"
                    style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--accent)', background: '#232326' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Select Avatar Preset</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {AVATAR_PRESETS.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt="Preset"
                          onClick={() => setProfileForm(p => ({ ...p, avatar_url: url }))}
                          style={{
                            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                            border: profileForm.avatar_url === url ? '2px solid var(--accent)' : '1px solid var(--border)',
                            opacity: profileForm.avatar_url === url ? 1 : 0.6,
                            transition: 'all 0.2s',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <input
                  type="text" style={inputStyle}
                  value={profileForm.avatar_url}
                  onChange={e => setProfileForm(p => ({ ...p, avatar_url: e.target.value }))}
                  placeholder="Or enter custom avatar image URL..."
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Email</label>
                <div style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)' }}>
                  {user?.email}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Display Name</label>
                <input
                  type="text" style={inputStyle}
                  value={profileForm.full_name}
                  onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Enter full name..."
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Username</label>
                <input
                  type="text" style={inputStyle}
                  value={profileForm.username}
                  onChange={e => setProfileForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="Enter username..."
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={profileLoading}
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 12, padding: '12px 24px', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s',
                  opacity: profileLoading ? 0.5 : 1,
                }}
              >
                {profileLoading ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>

            <div style={sectionStyle}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Keyboard Shortcuts</h3>
              {[
                ['Ctrl + N', 'New conversation'],
                ['Ctrl + /', 'Focus message input'],
                ['Ctrl + Shift + S', 'Toggle sidebar'],
                ['Enter', 'Send message'],
                ['Shift + Enter', 'New line'],
              ].map(([key, desc]) => (
                <div key={key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc}</span>
                  <kbd style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '3px 8px', fontSize: 12, color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}>{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div style={{ animation: 'fadeInUp 0.3s ease' }}>
            <div style={sectionStyle}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Change Password</h3>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Current Password</label>
                <input
                  type="password" style={inputStyle}
                  value={passwordForm.current}
                  onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>New Password</label>
                <input
                  type="password" style={inputStyle}
                  value={passwordForm.new}
                  onChange={e => setPasswordForm(p => ({ ...p, new: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Confirm New Password</label>
                <input
                  type="password" style={inputStyle}
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading || !passwordForm.current || !passwordForm.new}
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 12, padding: '12px 24px', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s',
                  opacity: passwordLoading || !passwordForm.current || !passwordForm.new ? 0.5 : 1,
                }}
              >
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </button>
            </div>

            <div style={{ ...sectionStyle, borderColor: 'rgba(248,113,113,0.15)' }}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 600, color: '#f87171', marginBottom: 8 }}>Danger Zone</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Logging out will invalidate your current session token.
              </p>
              <button
                onClick={() => { logout(); navigate('/login') }}
                style={{
                  background: 'rgba(248,113,113,0.1)', color: '#f87171',
                  border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12,
                  padding: '10px 20px', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s',
                }}
              >
                ⏻ Sign Out
              </button>
            </div>
          </div>
        )}

        {tab === 'appearance' && (
          <div style={{ animation: 'fadeInUp 0.3s ease' }}>
            <div style={sectionStyle}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Theme</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { id: 'dark', label: 'Dark', icon: '🌙' },
                  { id: 'light', label: 'Light', icon: '☀️' },
                  { id: 'auto', label: 'System', icon: '💻' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    style={{
                      padding: '16px 12px', borderRadius: 14,
                      background: theme === t.id ? 'var(--accent-soft)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${theme === t.id ? 'rgba(212,132,94,0.25)' : 'var(--border)'}`,
                      color: theme === t.id ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer', textAlign: 'center', fontWeight: 500,
                      transition: 'all 0.25s ease', fontSize: 13, fontFamily: 'Outfit',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: notification.type === 'error' ? '#2a1515' : '#152a1f',
          color: notification.type === 'error' ? '#f87171' : '#4ade80',
          border: `1px solid ${notification.type === 'error' ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`,
          padding: '12px 20px', borderRadius: 14,
          fontSize: 13, fontWeight: 500, zIndex: 1000,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          animation: 'fadeInUp 0.3s ease forwards',
        }}>
          {notification.msg}
        </div>
      )}
    </div>
  )
}
