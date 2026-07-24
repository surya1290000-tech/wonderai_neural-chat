import { useState, useEffect } from 'react'
import { ragAPI } from '../utils/api'

export default function KnowledgePanel({ isOpen, onClose, onUploadDocument, showNotif, sessionId, refreshTrigger }) {
  const [documents, setDocuments] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlIngesting, setUrlIngesting] = useState(false)

  const handleIngestUrl = async () => {
    if (!urlInput.trim() || !sessionId) return
    try {
      setUrlIngesting(true)
      showNotif(`Fetching & scraping URL...`, "info")
      await ragAPI.ingestUrl(urlInput.trim(), sessionId)
      showNotif(`✓ Web page content ingested into Knowledge Base!`)
      setUrlInput('')
      loadData()
    } catch (e) {
      showNotif(e.response?.data?.detail || "Failed to scrape URL", "error")
    } finally {
      setUrlIngesting(false)
    }
  }

  const loadData = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const [docRes, statRes] = await Promise.all([
        ragAPI.getDocuments(sessionId),
        ragAPI.stats(sessionId)
      ])
      setDocuments(docRes.data || [])
      setStats(statRes.data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen && sessionId) {
      loadData()
    } else if (!isOpen) {
      // Reset state when session changes or panel closes
      setDocuments([])
      setStats(null)
    }
  }, [isOpen, sessionId, refreshTrigger])

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this document from the knowledge base?")) return
    try {
      await ragAPI.deleteDocument(id, sessionId)
      showNotif("Document deleted")
      loadData()
    } catch (e) {
      showNotif("Failed to delete document", "error")
    }
  }

  const handleUpload = async (file) => {
    try {
      showNotif(`Uploading ${file.name}...`, "info")
      await onUploadDocument(file)
      showNotif(`✓ "${file.name}" ingested into knowledge base.`)
      loadData()
    } catch (e) {
      showNotif("Upload failed", "error")
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      width: 300, background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'relative',
      fontFamily: 'var(--font-body)',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
      zIndex: 20,
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 16px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 18,
          fontWeight: 600, color: 'var(--text-primary)', margin: 0,
        }}>Knowledge Base</h2>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer',
        }}>×</button>
      </div>

      {/* No session placeholder */}
      {!sessionId ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.5 }}>📂</div>
          <div style={{
            fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
            marginBottom: 8,
          }}>No session selected</div>
          <div style={{
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
          }}>
            Select or start a chat session first to manage its attached documents.
          </div>
        </div>
      ) : (
        <>
          {/* Upload Zone */}
          <div style={{ padding: 16 }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => {
                e.preventDefault()
                setDragActive(false)
                const file = e.dataTransfer.files[0]
                if (file) handleUpload(file)
              }}
              style={{
                border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: '20px 16px',
                textAlign: 'center', background: dragActive ? 'var(--accent-glow)' : 'transparent',
                transition: 'all 0.2s', cursor: 'pointer',
              }}
              onClick={() => document.getElementById('kb-file-upload').click()}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                Upload Document
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                PDF, TXT, MD, DOCX
              </div>
              <input
                id="kb-file-upload" type="file"
                accept=".pdf,.txt,.md,.docx"
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files[0]) handleUpload(e.target.files[0])
                  e.target.value = null
                }}
              />
            </div>

            {/* URL Ingestion Box */}
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="https://example.com/doc"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 8, padding: '6px 10px',
                  fontSize: 12, color: 'var(--text-primary)', outline: 'none',
                }}
              />
              <button
                onClick={handleIngestUrl}
                disabled={!urlInput.trim() || urlIngesting}
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '6px 12px', fontSize: 12,
                  fontWeight: 600, cursor: urlInput.trim() ? 'pointer' : 'default',
                  opacity: urlInput.trim() && !urlIngesting ? 1 : 0.5,
                }}
              >
                {urlIngesting ? '...' : '🌐 Fetch'}
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div style={{
              padding: '0 16px 16px', display: 'flex', gap: 8,
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, background: 'var(--bg-active)', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>DOCUMENTS</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {stats.documents}
                </div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-active)', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>CHUNKS</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {stats.total_chunks}
                </div>
              </div>
            </div>
          )}

          {/* Document List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <h3 style={{
              fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)',
              fontWeight: 600, letterSpacing: '0.05em', marginBottom: 12,
            }}>Session Documents</h3>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                Loading...
              </div>
            ) : documents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No documents attached to this session yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{
                    background: 'var(--bg-active)', borderRadius: 10,
                    padding: '12px 14px', display: 'flex', alignItems: 'center',
                    gap: 12,
                  }}>
                    <div style={{ fontSize: 20 }}>📑</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {doc.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {doc.chunks} chunks
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      style={{
                        background: 'transparent', border: 'none',
                        color: 'var(--error)', fontSize: 14, cursor: 'pointer',
                        padding: 4, borderRadius: 6,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      title="Delete Document"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
