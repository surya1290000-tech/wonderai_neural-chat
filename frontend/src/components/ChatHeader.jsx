import { useState, useEffect } from 'react'
import { modelsAPI, chatAPI } from '../utils/api'

const MODES = [
  { id: 'default', label: 'Default', icon: '✦', desc: 'General assistant' },
  { id: 'writer', label: 'Writer', icon: '✎', desc: 'Creative writing' },
  { id: 'student', label: 'Student', icon: '◎', desc: 'Educational tutor' },
  { id: 'director', label: 'Director', icon: '◆', desc: 'Business advisor' },
]

export default function ChatHeader({ session, onSessionUpdate, onExport, onToggleKB, kbOpen }) {
  const [models, setModels] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [temp, setTemp] = useState(session?.temperature ?? 0.7)
  const [selectedModel, setSelectedModel] = useState(session?.model || '')
  const [selectedMode, setSelectedMode] = useState(session?.mode || 'default')

  useEffect(() => {
    modelsAPI.list().then(({ data }) => setModels(data.models || [])).catch(() => { })
  }, [])

  useEffect(() => {
    if (session) {
      setTemp(session.temperature ?? 0.7)
      setSelectedModel(session.model)
      setSelectedMode(session.mode)
    }
  }, [session?.id])

  const update = async (patch) => {
    if (!session) return
    await chatAPI.updateSession(session.id, patch)
    onSessionUpdate?.({ ...session, ...patch })
  }

  const currentMode = MODES.find(m => m.id === selectedMode) || MODES[0]

  return (
    <>
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(12,12,12,0.8)',
        backdropFilter: 'blur(12px)',
        zIndex: 10,
        minHeight: 52,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'Outfit', fontWeight: 600, fontSize: 15,
            color: session ? '#ccc' : '#888',
            letterSpacing: '-0.01em',
          }}>
            {session?.title || 'New conversation'}
          </span>
          {session && (
            <span style={{
              fontSize: 12, color: '#888',
              background: 'rgba(255,255,255,0.04)',
              padding: '3px 10px', borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.06)',
              fontWeight: 500,
            }}>
              {currentMode.icon} {currentMode.label}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {session && onExport && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => onExport('markdown')}
                style={{
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: '#666',
                  padding: '6px 12px', borderRadius: 10,
                  fontSize: 13, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: 500,
                }}
                onMouseEnter={e => { e.target.style.color = '#aaa'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { e.target.style.color = '#666'; e.target.style.background = 'transparent' }}
                title="Export chat (Ctrl+Shift+E)"
              >
                📥 Export
              </button>
            </div>
          )}
          <button
            onClick={onToggleKB}
            style={{
              background: kbOpen ? 'rgba(212,132,94,0.1)' : 'transparent',
              border: '1px solid ' + (kbOpen ? 'rgba(212,132,94,0.25)' : 'transparent'),
              color: kbOpen ? '#d4845e' : '#666',
              padding: '6px 14px', borderRadius: 10,
              fontSize: 13, cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: 500,
            }}
            onMouseEnter={e => { if (!kbOpen) { e.target.style.color = '#aaa'; e.target.style.background = 'rgba(255,255,255,0.04)' } }}
            onMouseLeave={e => { if (!kbOpen) { e.target.style.color = '#666'; e.target.style.background = 'transparent' } }}
          >
            📚 Knowledge
          </button>
          {session && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                background: showSettings ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: '1px solid ' + (showSettings ? 'rgba(255,255,255,0.12)' : 'transparent'),
                color: showSettings ? '#ccc' : '#666',
                padding: '6px 14px', borderRadius: 10,
                fontSize: 13, cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 500,
              }}
              onMouseEnter={e => { if (!showSettings) { e.target.style.color = '#aaa'; e.target.style.background = 'rgba(255,255,255,0.04)' } }}
              onMouseLeave={e => { if (!showSettings) { e.target.style.color = '#666'; e.target.style.background = 'transparent' } }}
            >
              ⚙ Settings
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && session && (
        <div style={{
          position: 'absolute', top: 56, right: 20,
          background: '#1a1a1d',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: 22, width: 320,
          zIndex: 100,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          animation: 'fadeInUp 0.25s ease',
        }}>
          <div style={{
            fontFamily: 'Outfit', fontWeight: 600, fontSize: 15,
            marginBottom: 20, color: '#ccc',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            Settings
            <button onClick={() => setShowSettings(false)} style={{
              background: 'transparent', border: 'none',
              color: '#666', fontSize: 18, cursor: 'pointer',
              padding: 0, lineHeight: 1,
            }}>×</button>
          </div>

          {/* Mode */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, color: '#777', display: 'block', marginBottom: 10, fontWeight: 500 }}>Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {MODES.map(m => (
                <button key={m.id}
                  onClick={() => { setSelectedMode(m.id); update({ mode: m.id }) }}
                  style={{
                    padding: '10px 10px', borderRadius: 10,
                    background: selectedMode === m.id ? 'rgba(212,132,94,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedMode === m.id ? 'rgba(212,132,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    color: selectedMode === m.id ? '#d4845e' : '#888',
                    cursor: 'pointer', fontSize: 13, textAlign: 'left',
                    transition: 'all 0.2s ease', fontWeight: 500,
                  }}
                >
                  <div>{m.icon} {m.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 3 }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          {models.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#777', display: 'block', marginBottom: 10, fontWeight: 500 }}>Model</label>
              <select
                value={selectedModel}
                onChange={e => { setSelectedModel(e.target.value); update({ model: e.target.value }) }}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, color: '#ccc', padding: '10px 14px', fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Temperature */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              fontSize: 12, color: '#777', display: 'flex',
              justifyContent: 'space-between', marginBottom: 10, fontWeight: 500,
            }}>
              Temperature
              <span style={{ color: '#d4845e', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13 }}>{temp.toFixed(1)}</span>
            </label>
            <input type="range" min="0" max="2" step="0.1" value={temp}
              onChange={e => setTemp(parseFloat(e.target.value))}
              onMouseUp={e => update({ temperature: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#d4845e', height: 4 }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: '#555', marginTop: 6,
            }}>
              <span>Precise</span><span>Balanced</span><span>Creative</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              fontSize: 12, color: '#777', display: 'flex',
              justifyContent: 'space-between', marginBottom: 8, fontWeight: 500,
            }}>
              Max Tokens
              <span style={{ color: '#d4845e', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13 }}>2048</span>
            </label>
            <input type="range" min="512" max="8192" step="256" defaultValue="2048"
              style={{ width: '100%', accentColor: '#d4845e', height: 4 }}
            />
          </div>

          {/* Top-P */}
          <div>
            <label style={{
              fontSize: 12, color: '#777', display: 'flex',
              justifyContent: 'space-between', marginBottom: 8, fontWeight: 500,
            }}>
              Top-P Sampling
              <span style={{ color: '#d4845e', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13 }}>0.95</span>
            </label>
            <input type="range" min="0.1" max="1.0" step="0.05" defaultValue="0.95"
              style={{ width: '100%', accentColor: '#d4845e', height: 4 }}
            />
          </div>
        </div>
      )}
    </>
  )
}
