import { useState, useEffect, useCallback } from 'react'
import { chatAPI } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Sidebar({ activeSession, onSelectSession, onNewChat, sessions, setSessions, onOpenAgents, onOpenBuilder, selectedAgent, onOpenAnalytics }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [hoveredId, setHoveredId] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')

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

  const handleRename = async (id) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    try {
      await chatAPI.updateSession(id, { title: editTitle.trim() })
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: editTitle.trim() } : s))
    } catch (e) { console.error(e) }
    setEditingId(null)
  }

  const startRename = (e, session) => {
    e.stopPropagation()
    setEditingId(session.id)
    setEditTitle(session.title || 'New Chat')
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

  // Filter sessions by search query
  const filteredSessions = searchQuery.trim()
    ? sessions.filter(s => s.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions

  const groups = groupByDate(filteredSessions)

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
      <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={onNewChat}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.1)',
            color: '#aaa', borderRadius: 12,
            padding: '10px 14px',
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

        <button
          onClick={onOpenAgents}
          style={{
            width: '100%',
            background: selectedAgent ? `${selectedAgent.avatar_color || '#d4845e'}18` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${selectedAgent ? (selectedAgent.avatar_color || '#d4845e') + '35' : 'rgba(255,255,255,0.06)'}`,
            color: selectedAgent ? (selectedAgent.avatar_color || '#d4845e') : '#aaa',
            borderRadius: 12,
            padding: '9px 14px',
            fontWeight: 500, fontSize: 13,
            fontFamily: 'Outfit', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,132,94,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = selectedAgent ? (selectedAgent.avatar_color || '#d4845e') + '35' : 'rgba(255,255,255,0.06)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span style={{ fontSize: 15 }}>{selectedAgent ? selectedAgent.avatar_emoji : '🤖'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedAgent ? selectedAgent.name : 'AI Agent Studio'}
            </span>
          </div>
          <span style={{ fontSize: 11, opacity: 0.6, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 6 }}>
            Browse
          </span>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 8px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#555', fontSize: 13, pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            style={{
              width: '100%', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '8px 12px 8px 34px',
              color: '#ccc', fontSize: 13, transition: 'all 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(212,132,94,0.25)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: '#666',
                cursor: 'pointer', fontSize: 12, padding: 2,
              }}
            >✕</button>
          )}
        </div>
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
                onClick={() => editingId !== session.id && onSelectSession(session.id)}
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
                {editingId === session.id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(session.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(session.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(212,132,94,0.3)',
                      borderRadius: 6, padding: '3px 8px', color: '#ececec',
                      fontSize: 13, fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <span style={{
                    fontSize: 13, color: activeSession === session.id ? '#ececec' : '#999',
                    fontWeight: activeSession === session.id ? 500 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', flex: 1, paddingLeft: 4,
                    transition: 'color 0.15s',
                  }}>{session.title || 'New Chat'}</span>
                )}
                {hoveredId === session.id && editingId !== session.id && (
                  <div style={{ display: 'flex', gap: 2, animation: 'fadeIn 0.15s ease' }}>
                    <button
                      onClick={e => startRename(e, session)}
                      style={{
                        color: '#666', fontSize: 12, padding: '2px 6px',
                        borderRadius: 6, background: 'rgba(255,255,255,0.05)',
                        cursor: 'pointer', flexShrink: 0,
                        transition: 'all 0.15s', border: 'none',
                      }}
                      onMouseEnter={e => { e.target.style.color = '#d4845e'; e.target.style.background = 'rgba(212,132,94,0.1)' }}
                      onMouseLeave={e => { e.target.style.color = '#666'; e.target.style.background = 'rgba(255,255,255,0.05)' }}
                      title="Rename"
                    >✎</button>
                    <button
                      onClick={e => handleDelete(e, session.id)}
                      style={{
                        color: '#666', fontSize: 14, padding: '2px 6px',
                        borderRadius: 6, background: 'rgba(255,255,255,0.05)',
                        cursor: 'pointer', flexShrink: 0,
                        transition: 'all 0.15s', border: 'none',
                      }}
                      onMouseEnter={e => { e.target.style.color = '#f87171'; e.target.style.background = 'rgba(248,113,113,0.1)' }}
                      onMouseLeave={e => { e.target.style.color = '#666'; e.target.style.background = 'rgba(255,255,255,0.05)' }}
                      title="Delete"
                    >×</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {filteredSessions.length === 0 && (
          <div style={{
            textAlign: 'center', color: '#555',
            fontSize: 13, padding: '40px 16px',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.5 }}>
              {searchQuery ? '🔍' : '💬'}
            </div>
            {searchQuery ? 'No matching conversations' : 'No conversations yet'}
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

            {/* Usage & Analytics */}
            <button
              onClick={() => { setShowProfile(false); onOpenAnalytics && onOpenAnalytics() }}
              style={{
                width: '100%', padding: '12px 16px',
                background: 'transparent', border: 'none',
                color: '#aaa', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.2s',
                fontFamily: 'Outfit',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,132,94,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              📊 Usage & Analytics
            </button>

            {/* Settings */}
            <button
              onClick={() => { setShowProfile(false); navigate('/settings') }}
              style={{
                width: '100%', padding: '12px 16px',
                background: 'transparent', border: 'none',
                color: '#aaa', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.2s',
                fontFamily: 'Outfit',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ⚙ Settings
            </button>

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
