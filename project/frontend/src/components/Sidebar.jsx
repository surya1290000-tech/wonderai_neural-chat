import { useState, useEffect } from 'react'
import { chatAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ activeSession, onSelectSession, onNewChat, sessions, setSessions }) {
  const { user, logout } = useAuth()
  const [hoveredId, setHoveredId] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const loadSessions = async () => {
    try {
      const { data } = await chatAPI.getSessions()
      setSessions(data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { loadSessions() }, [])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await chatAPI.deleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSession === id) onSelectSession(null)
  }

  const groupByDate = (sessions) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const week = new Date(today); week.setDate(week.getDate() - 7)
    const groups = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Earlier': [] }
    sessions.forEach(s => {
      const d = new Date(s.updated_at)
      if (d >= today) groups['Today'].push(s)
      else if (d >= yesterday) groups['Yesterday'].push(s)
      else if (d >= week) groups['This Week'].push(s)
      else groups['Earlier'].push(s)
    })
    return groups
  }

  const groups = groupByDate(sessions)

  if (collapsed) {
    return (
      <div style={{
        width: 60, background: '#111', borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 16, height: '100vh', transition: 'width 0.3s ease',
      }}>
        <button onClick={() => setCollapsed(false)} style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', color: '#888',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, border: 'none', cursor: 'pointer', marginBottom: 12,
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
        >☰</button>
        <button onClick={onNewChat} style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'rgba(212,132,94,0.12)', color: '#d4845e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, border: 'none', cursor: 'pointer',
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => e.target.style.background = 'rgba(212,132,94,0.2)'}
          onMouseLeave={e => e.target.style.background = 'rgba(212,132,94,0.12)'}
        >+</button>
      </div>
    )
  }

  return (
    <div style={{
      width: 270, background: '#111',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', transition: 'width 0.3s ease',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg,#d4845e,#c07050)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff',
          }}>✦</div>
          <span style={{
            fontFamily: 'Outfit', fontWeight: 700, fontSize: 18,
            color: '#ececec', letterSpacing: '-0.01em'
          }}>NeuralChat</span>
        </div>
        <button onClick={() => setCollapsed(true)} style={{
          background: 'transparent', color: '#666', fontSize: 18,
          padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', border: 'none',
          cursor: 'pointer', transition: 'color 0.2s',
        }}
          onMouseEnter={e => e.target.style.color = '#aaa'}
          onMouseLeave={e => e.target.style.color = '#666'}
        >⊟</button>
      </div>

      {/* New Chat */}
      <div style={{ padding: '0 12px 8px' }}>
        <button
          onClick={onNewChat}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.1)',
            color: '#aaa', borderRadius: 12,
            padding: '11px 14px',
            fontWeight: 500, fontSize: 14,
            fontFamily: 'Outfit', display: 'flex',
            alignItems: 'center', gap: 10,
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,132,94,0.08)'; e.currentTarget.style.borderColor = 'rgba(212,132,94,0.25)'; e.currentTarget.style.color = '#d4845e' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#aaa' }}
        >
          <span style={{ fontSize: 16 }}>+</span> New conversation
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {Object.entries(groups).map(([label, items]) => items.length > 0 && (
          <div key={label}>
            <div style={{
              fontSize: 11, color: '#555', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              padding: '14px 8px 6px',
            }}>{label}</div>
            {items.map(session => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                onMouseEnter={() => setHoveredId(session.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: '9px 10px', borderRadius: 10,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  background: activeSession === session.id ? 'rgba(255,255,255,0.06)' : hoveredId === session.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                  marginBottom: 1,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                {activeSession === session.id && (
                  <div style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 20, borderRadius: 3,
                    background: '#d4845e',
                  }} />
                )}
                <span style={{
                  fontSize: 13, color: activeSession === session.id ? '#ececec' : '#999',
                  fontWeight: activeSession === session.id ? 500 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', flex: 1, paddingLeft: 4,
                  transition: 'color 0.15s',
                }}>{session.title || 'New Chat'}</span>
                {hoveredId === session.id && (
                  <button
                    onClick={e => handleDelete(e, session.id)}
                    style={{
                      color: '#666', fontSize: 14, padding: '2px 6px',
                      borderRadius: 6, background: 'rgba(255,255,255,0.05)',
                      cursor: 'pointer', flexShrink: 0,
                      transition: 'all 0.15s', border: 'none',
                      animation: 'fadeIn 0.15s ease',
                    }}
                    onMouseEnter={e => { e.target.style.color = '#f87171'; e.target.style.background = 'rgba(248,113,113,0.1)' }}
                    onMouseLeave={e => { e.target.style.color = '#666'; e.target.style.background = 'rgba(255,255,255,0.05)' }}
                  >×</button>
                )}
              </div>
            ))}
          </div>
        ))}
        {sessions.length === 0 && (
          <div style={{
            textAlign: 'center', color: '#555',
            fontSize: 13, padding: '40px 16px',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.5 }}>💬</div>
            No conversations yet
          </div>
        )}
      </div>

      {/* Footer with profile dropdown */}
      <div style={{
        padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
      }}>
        {/* Profile dropdown */}
        {showProfile && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 12, right: 12,
            background: '#1a1a1d',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: 0, marginBottom: 8,
            zIndex: 100,
            boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
            animation: 'fadeInUp 0.25s ease',
            overflow: 'hidden',
          }}>
            {/* Profile header */}
            <div style={{
              padding: '18px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: 'linear-gradient(135deg,#d4845e,#c07050)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>{user?.username?.[0]?.toUpperCase() || 'U'}</div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ececec', fontFamily: 'Outfit' }}>
                  {user?.username}
                </div>
                <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#666' }}>Conversations</span>
                <span style={{ fontSize: 12, color: '#d4845e', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                  {sessions.length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#666' }}>Status</span>
                <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }}></span>
                  Online
                </span>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={() => { setShowProfile(false); logout() }}
              style={{
                width: '100%', padding: '12px 16px',
                background: 'transparent', border: 'none',
                color: '#f87171', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.2s',
                fontFamily: 'Outfit',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ⏻ Sign out
            </button>
          </div>
        )}

        {/* User button */}
        <div
          onClick={() => setShowProfile(!showProfile)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px', borderRadius: 12,
            transition: 'background 0.2s',
            cursor: 'pointer',
            background: showProfile ? 'rgba(255,255,255,0.04)' : 'transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          onMouseLeave={e => { if (!showProfile) e.currentTarget.style.background = 'transparent' }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,#d4845e,#c07050)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{user?.username?.[0]?.toUpperCase() || 'U'}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.username}</div>
            <div style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
          <span style={{
            color: '#555', fontSize: 10,
            transform: showProfile ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}>▲</span>
        </div>
      </div>

      {/* Click outside to close profile */}
      {showProfile && (
        <div
          onClick={() => setShowProfile(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'transparent',
          }}
        />
      )}
    </div>
  )
}
