import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

const ChatInput = forwardRef(function ChatInput({ onSend, disabled, useRag, setUseRag, onUploadPDF, onStop, streaming }, ref) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const textareaRef = useRef()

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [value])

  const send = () => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  const keyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.pdf')) {
      onUploadPDF(file)
    }
  }

  const hasValue = value.trim().length > 0

  return (
    <div
      style={{
        padding: '0 24px 20px',
        background: '#0c0c0c',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(212,132,94,0.05)',
          border: '3px dashed rgba(212,132,94,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(22,22,22,0.95)', borderRadius: 20, padding: '32px 48px',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ color: '#d4845e', fontSize: 16, fontWeight: 600, fontFamily: 'Outfit' }}>
              Drop PDF to upload
            </div>
            <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
              File will be ingested into the knowledge base
            </div>
          </div>
        </div>
      )}

      {/* Tool bar */}
      <div style={{
        maxWidth: 'var(--content-max-width, 780px)',
        width: '100%', marginBottom: 10,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <button
          onClick={() => setUseRag(!useRag)}
          style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 20,
            background: useRag ? 'rgba(212,132,94,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${useRag ? 'rgba(212,132,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
            color: useRag ? '#d4845e' : '#777',
            cursor: 'pointer', transition: 'all 0.25s ease',
            fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          📎 {useRag ? 'RAG: ON' : 'RAG'}
        </button>
        <label style={{
          fontSize: 12, padding: '5px 12px', borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#777', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(255,255,255,0.03)',
          transition: 'all 0.25s ease', fontWeight: 500,
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
        >
          📄 Upload PDF
          <input type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && onUploadPDF(e.target.files[0])} />
        </label>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 11, color: value.length > 30000 ? '#f87171' : '#444',
          fontFamily: 'var(--font-mono)', fontWeight: 500,
          transition: 'color 0.2s',
        }}>
          {value.length > 0 ? `${value.length.toLocaleString()} chars` : ''}
        </span>
      </div>

      {/* Input area */}
      <div style={{
        maxWidth: 'var(--content-max-width, 780px)',
        width: '100%',
        display: 'flex', gap: 10, alignItems: 'flex-end',
        background: focused ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${focused ? 'rgba(212,132,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 16,
        padding: '10px 10px 10px 18px',
        transition: 'all 0.3s ease',
        boxShadow: focused ? '0 0 30px rgba(212,132,94,0.05)' : 'none',
      }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={keyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Message Wonder AI... (try /clear, /export, /mode writer)"
          disabled={disabled}
          rows={1}
          style={{
            flex: 1, background: 'transparent',
            color: '#ececec', fontSize: 15,
            resize: 'none', border: 'none', outline: 'none',
            lineHeight: 1.6, maxHeight: 200,
            fontFamily: 'Inter, sans-serif',
            padding: '4px 0',
          }}
        />

        {/* Send or Stop button */}
        {streaming ? (
          <button
            onClick={onStop}
            style={{
              height: 38, borderRadius: 12,
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.2)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, flexShrink: 0,
              transition: 'all 0.25s ease',
              color: '#f87171',
              padding: '0 14px',
              fontSize: 13, fontWeight: 600,
              fontFamily: 'Outfit',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(248,113,113,0.15)'
              e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(248,113,113,0.1)'
              e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)'
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: '#f87171',
              display: 'inline-block',
            }} />
            Stop
          </button>
        ) : (
          <button
            onClick={send}
            disabled={!hasValue || disabled}
            style={{
              width: 38, height: 38, borderRadius: 12,
              background: hasValue && !disabled
                ? '#d4845e'
                : 'rgba(255,255,255,0.04)',
              border: 'none',
              cursor: hasValue && !disabled ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
              transition: 'all 0.25s ease',
              boxShadow: hasValue && !disabled ? '0 4px 16px rgba(212,132,94,0.25)' : 'none',
              color: hasValue && !disabled ? '#fff' : '#555',
            }}
            onMouseEnter={e => { if (hasValue && !disabled) e.target.style.background = '#e0956f' }}
            onMouseLeave={e => { if (hasValue && !disabled) e.target.style.background = '#d4845e' }}
          >
            ↑
          </button>
        )}
      </div>

      <div style={{
        textAlign: 'center', fontSize: 11, color: '#444',
        marginTop: 10, fontWeight: 400,
        maxWidth: 'var(--content-max-width, 780px)',
      }}>
        Wonder AI can make mistakes. Verify important information.
      </div>
    </div>
  )
})

export default ChatInput
