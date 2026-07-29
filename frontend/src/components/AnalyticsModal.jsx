import { useState, useEffect } from 'react'
import { analyticsAPI } from '../utils/api'

export default function AnalyticsModal({ isOpen, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics()
    }
  }, [isOpen])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await analyticsAPI.getUsage()
      setData(res.data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      setError('Unable to load usage data.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: '#121212', border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 20, width: '100%', maxWidth: 640,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
        padding: 24, color: '#fff', fontFamily: 'Inter, sans-serif',
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 Usage & Resource Analytics
            </h2>
            <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
              Real-time token consumption and rate limit metrics for <span style={{ color: '#d4845e', fontWeight: 600 }}>{data?.username || 'Account'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)', border: 'none',
              color: '#aaa', borderRadius: '50%', width: 32, height: 32,
              cursor: 'pointer', fontSize: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#aaa'}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#888' }}>
            ⚡ Calculating usage metrics...
          </div>
        ) : error ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#f87171' }}>
            {error}
          </div>
        ) : (
          <div>
            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{
                background: 'rgba(212, 132, 94, 0.08)', border: '1px solid rgba(212, 132, 94, 0.2)',
                borderRadius: 14, padding: 16,
              }}>
                <div style={{ fontSize: 12, color: '#d4845e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Estimated Tokens
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 2px', color: '#fff' }}>
                  {(data?.metrics?.estimated_total_tokens || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  Prompt: {(data?.metrics?.estimated_prompt_tokens || 0).toLocaleString()} | Completion: {(data?.metrics?.estimated_completion_tokens || 0).toLocaleString()}
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 14, padding: 16,
              }}>
                <div style={{ fontSize: 12, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Messages
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 2px', color: '#fff' }}>
                  {(data?.metrics?.total_messages || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  Across {data?.metrics?.total_sessions || 0} active conversation sessions
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 14, padding: 16,
              }}>
                <div style={{ fontSize: 12, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  AI Images Generated
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 2px', color: '#fff' }}>
                  {data?.metrics?.generated_images_count || 0}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  FLUX.1 & Imagen 3 creations
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 14, padding: 16,
              }}>
                <div style={{ fontSize: 12, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  RAG Knowledge Docs
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 2px', color: '#fff' }}>
                  {data?.metrics?.rag_documents_count || 0}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  Indexed vectorstore documents
                </div>
              </div>
            </div>

            {/* Rate Limits Section */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ddd', marginBottom: 12 }}>
                ⚡ Live Rate Limit Allowances (Requests / Min)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data?.rate_limits && Object.entries(data.rate_limits).map(([tierKey, tierInfo]) => (
                  <div key={tierKey} style={{
                    background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize', color: '#ececec' }}>
                        {tierKey.replace('_', ' ')}
                      </span>
                      <span style={{ color: tierInfo.is_limited ? '#f87171' : '#10b981', fontWeight: 600 }}>
                        {tierInfo.remaining} / {tierInfo.max_rpm} RPM {tierInfo.is_limited ? '(Limited)' : ''}
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.max(0, Math.min(100, tierInfo.health_percentage))}%`,
                        background: tierInfo.health_percentage > 50 ? '#10b981' : tierInfo.health_percentage > 20 ? '#f59e0b' : '#f87171',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings & Info Footer */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12,
              padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', fontSize: 12, color: '#777',
            }}>
              <div>
                Provider: <strong style={{ color: '#ccc', textTransform: 'capitalize' }}>{data?.settings?.active_provider}</strong>
              </div>
              <div>
                Model: <strong style={{ color: '#ccc' }}>{data?.settings?.default_model}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
