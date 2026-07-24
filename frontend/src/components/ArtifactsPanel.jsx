import { useState } from 'react'

export default function ArtifactsPanel({ artifact, onClose }) {
  const [activeTab, setActiveTab] = useState('preview') // 'preview' or 'code'
  const [copied, setCopied] = useState(false)

  if (!artifact) return null

  const { title, language, code } = artifact

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const ext = language === 'html' ? 'html' : language === 'svg' ? 'svg' : language === 'javascript' || language === 'js' ? 'js' : 'txt'
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'artifact').toLowerCase().replace(/[^a-z0-9]/g, '_')}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Construct srcDoc for sandboxed HTML iframe preview
  const isWebCode = ['html', 'htm', 'svg', 'javascript', 'js', 'react'].includes(language?.toLowerCase())
  const srcDoc = language?.toLowerCase() === 'svg'
    ? `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d0d0d;">${code}</body></html>`
    : language?.toLowerCase() === 'html' || language?.toLowerCase() === 'htm'
    ? code
    : `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;padding:20px;color:#fff;background:#0d0d0d;}</style></head><body><script>${code}</script></body></html>`

  return (
    <div style={{
      width: '45%', maxWidth: 680, minWidth: 360,
      height: '100vh', background: '#121214',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', zIndex: 25,
      boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
    }}>
      {/* Panel Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#161618',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div>
            <div style={{
              fontFamily: 'Outfit', fontWeight: 600, fontSize: 14, color: '#f0f0f0',
            }}>
              {title || 'Interactive Artifact'}
            </div>
            <div style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {language}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Tab Switcher */}
          {isWebCode && (
            <div style={{
              display: 'flex', background: 'rgba(255,255,255,0.04)',
              borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <button
                onClick={() => setActiveTab('preview')}
                style={{
                  background: activeTab === 'preview' ? 'rgba(212,132,94,0.2)' : 'transparent',
                  color: activeTab === 'preview' ? '#d4845e' : '#888',
                  border: 'none', borderRadius: 6, padding: '4px 10px',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                👁 Preview
              </button>
              <button
                onClick={() => setActiveTab('code')}
                style={{
                  background: activeTab === 'code' ? 'rgba(212,132,94,0.2)' : 'transparent',
                  color: activeTab === 'code' ? '#d4845e' : '#888',
                  border: 'none', borderRadius: 6, padding: '4px 10px',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {'</> Code'}
              </button>
            </div>
          )}

          <button
            onClick={handleCopy}
            title="Copy code"
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: copied ? '#4ade80' : '#aaa', padding: '6px 10px', borderRadius: 8,
              fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>

          <button
            onClick={handleDownload}
            title="Download file"
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#aaa', padding: '6px 10px', borderRadius: 8,
              fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}
          >
            💾
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#666',
              fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'preview' && isWebCode ? (
          <iframe
            title={title}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-modals allow-same-origin"
            style={{
              width: '100%', height: '100%', border: 'none',
              background: '#fff',
            }}
          />
        ) : (
          <pre style={{
            flex: 1, margin: 0, padding: 20, overflow: 'auto',
            background: '#0d0d0f', color: '#e0e0e0',
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            fontSize: 13, lineHeight: 1.6,
          }}>
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
