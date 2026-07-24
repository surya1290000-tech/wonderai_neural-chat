import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useState } from 'react'

function ImageCard({ src, alt }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const imgSrc = src?.startsWith('/static') ? `http://127.0.0.1:8000${src}` : src

  return (
    <div
      className={`chatgpt-image-container ${loading ? 'chatgpt-image-generating' : ''}`}
      style={{
        margin: '18px 0',
        borderRadius: 18,
        overflow: 'hidden',
        border: loading ? '1px solid rgba(212,132,94,0.4)' : '1px solid rgba(255,255,255,0.1)',
        background: '#0d0d12',
        boxShadow: loading ? '0 10px 40px rgba(212,132,94,0.2)' : '0 10px 30px rgba(0,0,0,0.5)',
        maxWidth: 512,
        position: 'relative',
        transition: 'all 0.4s ease',
      }}
    >
      {/* Header bar */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.03)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#d4845e', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ animation: loading ? 'chatgptSparklePulse 2s infinite ease-in-out' : 'none', display: 'inline-block' }}>
            ✦
          </span>
          {loading ? 'Creating image...' : 'AI Generated Image'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {!loading && !error && (
            <button
              onClick={() => setLightbox(true)}
              style={{
                fontSize: 11, color: '#aaa',
                padding: '4px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer', fontWeight: 500
              }}
            >
              🔍 View Full
            </button>
          )}
          {!loading && !error && (
            <a
              href={imgSrc}
              download="ai_generated_image.png"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 11, color: '#aaa', textDecoration: 'none',
                padding: '4px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontWeight: 500
              }}
            >
              ⬇ Download
            </a>
          )}
        </div>
      </div>

      {/* Main Container Area */}
      <div style={{
        position: 'relative',
        minHeight: error ? 140 : loading ? 280 : 'auto',
        background: '#08080c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden'
      }}>
        {/* ChatGPT Shimmer Light Beam */}
        {loading && !error && <div className="chatgpt-shimmer-beam" />}

        {/* ChatGPT Central Creation Animation */}
        {loading && !error && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 14, padding: 40, color: '#ececec', zIndex: 2
          }}>
            <div style={{ position: 'relative', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Outer Rotating Gradient Ring */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'conic-gradient(from 0deg, transparent 0%, #d4845e 50%, #e0956f 80%, transparent 100%)',
                animation: 'chatgptSpin 1.4s linear infinite',
                opacity: 0.85
              }} />
              {/* Inner Dark Mask */}
              <div style={{
                position: 'absolute', inset: 3, borderRadius: '50%',
                background: '#0d0d12',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: 20, color: '#d4845e',
                  animation: 'chatgptSparklePulse 1.8s ease-in-out infinite'
                }}>
                  ✨
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#eee', fontFamily: 'Outfit, sans-serif', letterSpacing: '0.02em' }}>
                Creating image with FLUX.1 AI...
              </div>
              <div style={{ fontSize: 11, color: '#777', marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
                Synthesizing photorealistic 8K artwork
              </div>
            </div>
          </div>
        )}

        {error ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#f87171', fontSize: 13 }}>
            ⚠️ Could not load image preview.
            <div style={{ marginTop: 8 }}>
              <a href={imgSrc} target="_blank" rel="noreferrer" style={{ color: '#d4845e', textDecoration: 'underline' }}>
                Open Direct Link
              </a>
            </div>
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={alt || 'Generated Image'}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true) }}
            className={!loading ? 'chatgpt-image-loaded' : ''}
            style={{
              width: '100%',
              height: 'auto',
              display: loading ? 'none' : 'block',
              cursor: 'pointer',
              borderRadius: '0 0 16px 16px',
            }}
            onClick={() => setLightbox(true)}
          />
        )}
      </div>

      {alt && !loading && (
        <div style={{ padding: '8px 16px', fontSize: 12, color: '#888', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)' }}>
          "{alt}"
        </div>
      )}

      {/* Lightbox Modal */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out'
          }}
        >
          <img
            src={imgSrc}
            alt={alt}
            style={{
              maxHeight: '90vh', maxWidth: '90vw', borderRadius: 18,
              boxShadow: '0 25px 70px rgba(0,0,0,0.9)',
              objectFit: 'contain',
              animation: 'chatgptImageReveal 0.4s ease forwards'
            }}
          />
        </div>
      )}
    </div>
  )
}

function CodeBlock({ language, children, onOpenArtifact }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isArtifactLanguage = ['html', 'htm', 'svg', 'javascript', 'js', 'react', 'jsx', 'css', 'json', 'markdown'].includes(language?.toLowerCase()) || (children && children.length > 100)

  return (
    <div style={{ position: 'relative', marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.03)',
        padding: '8px 14px',
      }}>
        <span style={{
          fontSize: 11, color: '#777',
          fontFamily: 'JetBrains Mono',
          textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500,
        }}>{language || 'code'}</span>
        
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isArtifactLanguage && onOpenArtifact && (
            <button
              onClick={() => onOpenArtifact({
                title: `${language?.toUpperCase() || 'Code'} Artifact`,
                language: language || 'html',
                code: children,
              })}
              style={{
                background: 'rgba(212,132,94,0.15)',
                color: '#d4845e',
                fontSize: 12, padding: '3px 10px', borderRadius: 6,
                border: '1px solid rgba(212,132,94,0.3)',
                cursor: 'pointer', fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              ⚡ Open Artifact
            </button>
          )}

          <button onClick={copy} style={{
            background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
            color: copied ? '#4ade80' : '#888',
            fontSize: 12, padding: '3px 10px', borderRadius: 6,
            border: `1px solid ${copied ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)'}`,
            cursor: 'pointer', fontWeight: 500,
            transition: 'all 0.2s ease',
          }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0, borderRadius: 0,
          background: '#111114',
          fontSize: 13.5, padding: '16px',
          border: 'none',
        }}
        showLineNumbers={true}
        lineNumberStyle={{ color: '#333', fontSize: 12, marginRight: 8 }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

function ActionButton({ icon, label, onClick, active, activeColor }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 8,
        background: active
          ? `${activeColor || 'rgba(212,132,94,0.1)'}`
          : hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: 'none',
        color: active ? (activeColor === 'rgba(74,222,128,0.1)' ? '#4ade80' : activeColor === 'rgba(248,113,113,0.1)' ? '#f87171' : '#d4845e')
          : hovered ? '#ccc' : '#555',
        fontSize: 13, cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontWeight: 500,
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label && <span style={{ fontSize: 12 }}>{label}</span>}
    </button>
  )
}

export default function MessageBubble({ message, isStreaming, onRegenerate, onFeedback, onOpenArtifact }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState(message.meta?.feedback || null)
  const images = message.meta?.images || message.images || []

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = () => {
    if (onRegenerate) onRegenerate(message.id)
  }

  const handleLike = (type) => {
    const newValue = liked === type ? null : type
    setLiked(newValue)
    if (onFeedback) onFeedback(message.id, newValue || 'none')
  }

  const handleReadAloud = () => {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(message.content)
      utter.rate = 1.0
      utter.pitch = 1.0
      window.speechSynthesis.speak(utter)
    }
  }

  return (
    <div className="fade-in" style={{
      display: 'flex', justifyContent: 'center',
      marginBottom: 4, padding: '14px 24px',
      animation: 'fadeInUp 0.35s ease forwards',
    }}>
      <div style={{
        maxWidth: 'var(--content-max-width, 780px)',
        width: '100%', display: 'flex', gap: 16,
        alignItems: 'flex-start',
      }}>
        {/* Avatar */}
        <div style={{
          width: 30, height: 30, borderRadius: 10,
          background: isUser
            ? 'rgba(255,255,255,0.08)'
            : 'linear-gradient(135deg,#d4845e,#c07050)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isUser ? 13 : 12,
          flexShrink: 0, marginTop: 2,
          color: isUser ? '#999' : '#fff',
          fontWeight: 600,
          border: isUser ? '1px solid rgba(255,255,255,0.08)' : 'none',
        }}>
          {isUser ? 'U' : '✦'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          {/* Role label */}
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: isUser ? '#999' : '#d4845e',
            marginBottom: 6,
            fontFamily: 'Outfit',
          }}>
            {isUser ? 'You' : 'NeuralChat'}
          </div>

          {/* User attached images */}
          {images.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              {images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt="Attachment"
                  style={{
                    maxHeight: 180, maxWidth: 280, borderRadius: 12,
                    objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </div>
          )}

          {isUser ? (
            <p style={{
              color: '#ddd', whiteSpace: 'pre-wrap', margin: 0,
              fontSize: 15, lineHeight: 1.7,
            }}>{message.content}</p>
          ) : (
            <div className={`message-content ${isStreaming ? 'typing-cursor' : ''}`}
              style={{ color: '#ccc', fontSize: 15 }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <CodeBlock language={match[1]} onOpenArtifact={onOpenArtifact}>
                        {String(children).replace(/\n$/, '')}
                      </CodeBlock>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    )
                  },
                  img({ node, src, alt, ...props }) {
                    return <ImageCard src={src} alt={alt} />
                  }
                }}
              >
                {message.content.replace(/```tool[\s\S]*?```/g, '').trim()}
              </ReactMarkdown>
            </div>
          )}

          {/* Timestamp */}
          {message.created_at && (
            <div style={{
              fontSize: 11, color: '#444', marginTop: 8,
              fontFamily: 'JetBrains Mono',
            }}>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Action buttons for assistant messages */}
          {!isUser && !isStreaming && message.content && (
            <div style={{
              display: 'flex', gap: 2, marginTop: 10,
              animation: 'fadeIn 0.3s ease',
            }}>
              <ActionButton
                icon={copied ? '✓' : '📋'}
                label={copied ? 'Copied!' : 'Copy'}
                onClick={handleCopy}
                active={copied}
                activeColor="rgba(74,222,128,0.1)"
              />
              <ActionButton
                icon="🔄"
                label="Regenerate"
                onClick={handleRegenerate}
              />
              <ActionButton
                icon="🔊"
                label="Read"
                onClick={handleReadAloud}
              />
              <ActionButton
                icon="👍"
                onClick={() => handleLike('up')}
                active={liked === 'up'}
                activeColor="rgba(74,222,128,0.1)"
              />
              <ActionButton
                icon="👎"
                onClick={() => handleLike('down')}
                active={liked === 'down'}
                activeColor="rgba(248,113,113,0.1)"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
