import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useState } from 'react'

function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
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

export default function MessageBubble({ message, isStreaming, onRegenerate }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState(null) // null, 'up', 'down'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = () => {
    if (onRegenerate) onRegenerate(message.id)
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
                      <CodeBlock language={match[1]}>{String(children).replace(/\n$/, '')}</CodeBlock>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    )
                  }
                }}
              >
                {message.content}
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
                icon="👍"
                onClick={() => setLiked(liked === 'up' ? null : 'up')}
                active={liked === 'up'}
                activeColor="rgba(74,222,128,0.1)"
              />
              <ActionButton
                icon="👎"
                onClick={() => setLiked(liked === 'down' ? null : 'down')}
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
