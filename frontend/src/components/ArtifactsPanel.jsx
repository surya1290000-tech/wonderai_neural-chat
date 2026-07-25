import { useState, useEffect, useRef } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function ArtifactsPanel({ artifact, onClose }) {
  const [activeTab, setActiveTab] = useState('preview') // 'preview' | 'code' | 'console'
  const [codeContent, setCodeContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState([])
  const iframeRef = useRef(null)

  useEffect(() => {
    if (artifact?.code) {
      setCodeContent(artifact.code)
      setConsoleLogs([])
    }
  }, [artifact])

  // Listen to postMessages from sandboxed iframe for live console logs
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'NEURAL_CONSOLE_LOG') {
        setConsoleLogs(prev => [...prev, {
          level: event.data.level || 'log',
          args: event.data.args || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }])
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  if (!artifact) return null

  const { title, language } = artifact
  const langLower = (language || 'html').toLowerCase()

  const isWebCode = ['html', 'htm', 'svg', 'javascript', 'js', 'react', 'jsx', 'css'].includes(langLower)
  const isReact = ['react', 'jsx'].includes(langLower)
  const isSvg = langLower === 'svg'

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    let ext = 'txt'
    if (isSvg) ext = 'svg'
    else if (langLower === 'html' || langLower === 'htm') ext = 'html'
    else if (isReact || langLower === 'js' || langLower === 'javascript') ext = 'jsx'
    else if (langLower === 'python' || langLower === 'py') ext = 'py'
    else if (langLower === 'json') ext = 'json'

    const blob = new Blob([codeContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'artifact').toLowerCase().replace(/[^a-z0-9]/g, '_')}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Construct iframe srcDoc with console logger script injection & React Babel compiler
  const consoleScript = `
    <script>
      (function() {
        const _log = console.log;
        const _warn = console.warn;
        const _error = console.error;
        function send(level, args) {
          try {
            window.parent.postMessage({
              type: 'NEURAL_CONSOLE_LOG',
              level: level,
              args: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))
            }, '*');
          } catch(e){}
        }
        console.log = function(...args) { send('info', args); _log.apply(console, args); };
        console.warn = function(...args) { send('warn', args); _warn.apply(console, args); };
        console.error = function(...args) { send('error', args); _error.apply(console, args); };
        window.addEventListener('error', function(err) {
          send('error', [err.message + ' at line ' + err.lineno]);
        });
      })();
    </script>
  `

  let srcDoc = ''
  if (isSvg) {
    srcDoc = `<!DOCTYPE html><html><head>${consoleScript}</head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d0d12;color:#fff;">${codeContent}</body></html>`
  } else if (isReact) {
    srcDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          ${consoleScript}
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: #0c0c0e; color: #ececec; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel">
            try {
              ${codeContent}
              if (typeof App !== 'undefined') {
                ReactDOM.createRoot(document.getElementById('root')).render(<App />);
              }
            } catch (err) {
              console.error(err.message);
              document.getElementById('root').innerHTML = '<div style="color:#f87171;padding:20px;">⚠️ Render Error: ' + err.message + '</div>';
            }
          </script>
        </body>
      </html>
    `
  } else if (langLower === 'html' || langLower === 'htm') {
    srcDoc = codeContent.includes('<head>')
      ? codeContent.replace('<head>', `<head>${consoleScript}`)
      : `<!DOCTYPE html><html><head>${consoleScript}</head><body>${codeContent}</body></html>`
  } else {
    srcDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          ${consoleScript}
          <style>body { font-family: sans-serif; padding: 20px; background: #0d0d12; color: #fff; }</style>
        </head>
        <body>
          <script>
            try {
              ${codeContent}
            } catch (err) {
              console.error(err.message);
            }
          </script>
        </body>
      </html>
    `
  }

  return (
    <div style={{
      width: isFullscreen ? '100vw' : '48%',
      maxWidth: isFullscreen ? '100vw' : 760,
      minWidth: isFullscreen ? '100vw' : 380,
      height: '100vh',
      background: '#121215',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      position: isFullscreen ? 'fixed' : 'relative',
      inset: isFullscreen ? 0 : 'auto',
      zIndex: isFullscreen ? 9999 : 25,
      boxShadow: '-10px 0 50px rgba(0,0,0,0.6)',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      {/* Panel Top Header Bar */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        background: '#16161a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(212,132,94,0.15)',
            border: '1px solid rgba(212,132,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#d4845e',
          }}>
            ⚡
          </div>
          <div>
            <div style={{
              fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 14, color: '#f0f0f0',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              {title || 'Interactive Canvas'}
              {isEditing && (
                <span style={{ fontSize: 10, background: '#d4845e', color: '#111', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                  EDITING
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'JetBrains Mono, monospace' }}>
              {language} · Claude Sandbox
            </div>
          </div>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Main Workspace Tabs */}
          <div style={{
            display: 'flex', background: 'rgba(0,0,0,0.3)',
            borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {isWebCode && (
              <button
                onClick={() => setActiveTab('preview')}
                style={{
                  background: activeTab === 'preview' ? 'rgba(212,132,94,0.2)' : 'transparent',
                  color: activeTab === 'preview' ? '#d4845e' : '#888',
                  border: 'none', borderRadius: 6, padding: '5px 12px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                👁 Preview
              </button>
            )}
            <button
              onClick={() => setActiveTab('code')}
              style={{
                background: activeTab === 'code' ? 'rgba(212,132,94,0.2)' : 'transparent',
                color: activeTab === 'code' ? '#d4845e' : '#888',
                border: 'none', borderRadius: 6, padding: '5px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {'</> Code'}
            </button>
            <button
              onClick={() => setActiveTab('console')}
              style={{
                background: activeTab === 'console' ? 'rgba(212,132,94,0.2)' : 'transparent',
                color: activeTab === 'console' ? '#d4845e' : '#888',
                border: 'none', borderRadius: 6, padding: '5px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              💻 Console {consoleLogs.length > 0 && <span style={{ fontSize: 10, background: '#d4845e', color: '#000', borderRadius: '50%', padding: '1px 5px', fontWeight: 700 }}>{consoleLogs.length}</span>}
            </button>
          </div>

          {/* Edit / Edit Mode Switcher */}
          {activeTab === 'code' && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                background: isEditing ? 'rgba(212,132,94,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isEditing ? '#d4845e' : 'rgba(255,255,255,0.08)'}`,
                color: isEditing ? '#d4845e' : '#aaa',
                padding: '5px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600
              }}
            >
              {isEditing ? '✏️ Editing' : '✏️ Edit'}
            </button>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title="Copy code"
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: copied ? '#4ade80' : '#aaa', padding: '5px 10px', borderRadius: 8,
              fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            title="Download file"
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#aaa', padding: '5px 10px', borderRadius: 8,
              fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}
          >
            💾
          </button>

          {/* Fullscreen Expand Button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Expand"}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#aaa', padding: '5px 10px', borderRadius: 8,
              fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}
          >
            {isFullscreen ? '↘↙' : '↖↘'}
          </button>

          {/* Close Panel Button */}
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#777',
              fontSize: 22, cursor: 'pointer', padding: '0 6px', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Main Sandbox Content Display */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', background: '#0a0a0c' }}>
        {activeTab === 'preview' && isWebCode ? (
          <iframe
            ref={iframeRef}
            title={title}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-modals allow-same-origin"
            style={{
              width: '100%', height: '100%', border: 'none',
              background: '#0a0a0c',
            }}
          />
        ) : activeTab === 'console' ? (
          <div style={{
            flex: 1, padding: 20, overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, background: '#09090b', color: '#ccc'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #222', pb: 8 }}>
              <span style={{ color: '#d4845e', fontWeight: 600 }}>Interactive Console Logs</span>
              <button
                onClick={() => setConsoleLogs([])}
                style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer' }}
              >
                Clear
              </button>
            </div>
            {consoleLogs.length === 0 ? (
              <div style={{ color: '#555', fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
                No console output received yet. Open the Preview tab to run scripts.
              </div>
            ) : (
              consoleLogs.map((log, idx) => (
                <div key={idx} style={{
                  display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  color: log.level === 'error' ? '#f87171' : log.level === 'warn' ? '#fbbf24' : '#4ade80'
                }}>
                  <span style={{ color: '#555', fontSize: 11 }}>[{log.timestamp}]</span>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>{log.level}:</span>
                  <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{log.args.join(' ')}</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {isEditing ? (
              <textarea
                value={codeContent}
                onChange={(e) => setCodeContent(e.target.value)}
                style={{
                  flex: 1, width: '100%', height: '100%', background: '#09090b', color: '#e0e0e0',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 13.5, padding: 20,
                  border: 'none', resize: 'none', outline: 'none', lineHeight: 1.6
                }}
              />
            ) : (
              <SyntaxHighlighter
                language={language || 'javascript'}
                style={oneDark}
                customStyle={{
                  margin: 0, height: '100%', borderRadius: 0,
                  background: '#09090b', fontSize: 13.5, padding: '20px',
                }}
                showLineNumbers={true}
                lineNumberStyle={{ color: '#333', fontSize: 12, marginRight: 12 }}
              >
                {codeContent}
              </SyntaxHighlighter>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
