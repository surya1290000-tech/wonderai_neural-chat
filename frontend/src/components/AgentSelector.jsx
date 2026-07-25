import { useState, useEffect } from 'react'
import { agentsAPI } from '../utils/api'

export default function AgentSelector({ isOpen, onClose, onSelectAgent, onCreateAgent, onEditAgent }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState(null)
  const [menuId, setMenuId] = useState(null)
  const [shareNotif, setShareNotif] = useState(null)

  const loadAgents = async () => {
    try {
      setLoading(true)
      const { data } = await agentsAPI.list()
      setAgents(data)
    } catch (e) {
      console.error('Failed to load agents:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) loadAgents()
  }, [isOpen])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    setMenuId(null)
    try {
      await agentsAPI.delete(id)
      setAgents(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      console.error('Failed to delete agent:', e)
    }
  }

  const handleShare = async (e, agent) => {
    e.stopPropagation()
    setMenuId(null)
    try {
      const { data } = await agentsAPI.share(agent.id)
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, is_public: data.is_public, share_id: data.share_id } : a))
      if (data.is_public && data.share_id) {
        const shareUrl = `${window.location.origin}/agents/shared/${data.share_id}`
        navigator.clipboard.writeText(shareUrl)
        setShareNotif('Share link copied!')
        setTimeout(() => setShareNotif(null), 3000)
      }
    } catch (e) {
      console.error('Failed to toggle share:', e)
    }
  }

  if (!isOpen) return null

  return (
    <div className="agent-selector-overlay" onClick={onClose}>
      <div className="agent-selector-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="agent-selector-header">
          <div>
            <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, color: '#f0f0f0' }}>
              AI Agents
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              Choose a persona or create your own
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={onCreateAgent} className="agent-selector-create-btn">
              + Create
            </button>
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', color: '#666',
              fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
            }}>×</button>
          </div>
        </div>

        {/* Share notification toast */}
        {shareNotif && (
          <div style={{
            padding: '8px 16px', margin: '0 16px 8px', borderRadius: 10,
            background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
            color: '#4ade80', fontSize: 12, fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}>{shareNotif}</div>
        )}

        {/* Agent Cards */}
        <div className="agent-selector-list">
          {/* Default "NeuralChat" agent */}
          <button
            className={`agent-card ${!hoveredId ? '' : ''}`}
            onClick={() => { onSelectAgent(null); onClose() }}
            onMouseEnter={() => setHoveredId('default')}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="agent-card-avatar" style={{
              background: 'linear-gradient(135deg, #d4845e, #c07050)',
            }}>✦</div>
            <div className="agent-card-info">
              <div className="agent-card-name">NeuralChat</div>
              <div className="agent-card-desc">Default AI assistant — helpful, knowledgeable, and friendly</div>
            </div>
          </button>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 13 }}>
              Loading agents...
            </div>
          ) : agents.length === 0 ? (
            <div style={{
              padding: '32px 16px', textAlign: 'center', color: '#555',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>🤖</div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>No custom agents yet</div>
              <div style={{ fontSize: 12, color: '#444' }}>
                Create your first agent to get started
              </div>
            </div>
          ) : (
            agents.map(agent => (
              <div
                key={agent.id}
                className={`agent-card ${hoveredId === agent.id ? 'hovered' : ''}`}
                onClick={() => { onSelectAgent(agent); onClose() }}
                onMouseEnter={() => setHoveredId(agent.id)}
                onMouseLeave={() => { setHoveredId(null); setMenuId(null) }}
                style={{ position: 'relative' }}
              >
                <div className="agent-card-avatar" style={{
                  background: `linear-gradient(135deg, ${agent.avatar_color || '#d4845e'}, ${agent.avatar_color || '#d4845e'}88)`,
                }}>{agent.avatar_emoji || '🤖'}</div>
                <div className="agent-card-info">
                  <div className="agent-card-name">
                    {agent.name}
                    {agent.is_public && (
                      <span style={{
                        fontSize: 9, color: '#56b6c2', marginLeft: 6,
                        padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(86,182,194,0.1)',
                        border: '1px solid rgba(86,182,194,0.2)',
                        fontWeight: 600, letterSpacing: '0.03em',
                      }}>PUBLIC</span>
                    )}
                  </div>
                  <div className="agent-card-desc">{agent.description || 'No description'}</div>
                  <div className="agent-card-meta">
                    <span>{agent.model || 'Default model'}</span>
                    <span>·</span>
                    <span>Temp {agent.temperature}</span>
                    {agent.usage_count > 0 && (
                      <>
                        <span>·</span>
                        <span>{agent.usage_count} chats</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {hoveredId === agent.id && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, animation: 'fadeIn 0.15s ease' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditAgent(agent) }}
                      className="agent-card-action"
                      title="Edit"
                    >✎</button>
                    <button
                      onClick={(e) => handleShare(e, agent)}
                      className="agent-card-action"
                      title={agent.is_public ? 'Disable sharing' : 'Share'}
                      style={{ color: agent.is_public ? '#56b6c2' : undefined }}
                    >🔗</button>
                    <button
                      onClick={(e) => handleDelete(e, agent.id)}
                      className="agent-card-action agent-card-action-danger"
                      title="Delete"
                    >×</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
