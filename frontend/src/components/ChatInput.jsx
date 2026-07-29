import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { audioAPI } from '../utils/api'

const ChatInput = forwardRef(function ChatInput({ onSend, disabled, useRag, setUseRag, onUploadPDF, onStop, streaming }, ref) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [images, setImages] = useState([])
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingMode, setRecordingMode] = useState('mediaRecorder')
  
  const textareaRef = useRef()
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

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

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setImages(prev => [...prev, { url: e.target.result, name: file.name }])
    }
    reader.readAsDataURL(file)
  }

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const startFallbackWebSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Try Chrome or Edge.')
      return
    }
    setRecordingMode('webSpeech')
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let transcript = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setValue(prev => (prev ? prev + ' ' + transcript : transcript))
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    try {
      rec.start()
      recognitionRef.current = rec
      setIsListening(true)
    } catch (err) {
      setIsListening(false)
    }
  }

  const toggleListening = async () => {
    if (isListening) {
      if (recordingMode === 'mediaRecorder' && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
      } else if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setIsListening(false)
      return
    }

    // Try MediaRecorder + Whisper API first
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop())
          const mimeType = mediaRecorder.mimeType || 'audio/webm'
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          if (audioBlob.size === 0) return

          const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm'
          const file = new File([audioBlob], `speech_input.${extension}`, { type: mimeType })

          setIsTranscribing(true)
          try {
            const { data } = await audioAPI.transcribe(file)
            if (data?.text) {
              setValue(prev => prev ? `${prev} ${data.text}` : data.text)
            }
          } catch (err) {
            console.warn('Whisper API failed, falling back to local speech recognition:', err)
            startFallbackWebSpeech()
          } finally {
            setIsTranscribing(false)
          }
        }

        mediaRecorder.start()
        setRecordingMode('mediaRecorder')
        setIsListening(true)
        return
      } catch (err) {
        console.warn('Mic access denied or unsupported, using WebSpeech fallback:', err)
      }
    }

    // Fallback to Web Speech API
    startFallbackWebSpeech()
  }

  const send = () => {
    if ((!value.trim() && images.length === 0) || disabled) return
    const imagePayload = images.map(img => img.url)
    onSend(value.trim(), imagePayload)
    setValue('')
    setImages([])
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
    if (file) {
      if (file.name.endsWith('.pdf')) {
        onUploadPDF(file)
      } else if (file.type.startsWith('image/')) {
        handleImageFile(file)
      }
    }
  }

  const hasValue = value.trim().length > 0 || images.length > 0

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
      {/* Drag overlay indicator */}
      {isDragOver && (
        <div style={{
          maxWidth: 'var(--content-max-width, 780px)',
          width: '100%', marginBottom: 12, padding: '16px',
          borderRadius: 16, border: '2px dashed #d4845e',
          background: 'rgba(212,132,94,0.08)',
          textAlign: 'center', color: '#d4845e', fontSize: 14, fontWeight: 500,
          animation: 'fadeIn 0.2s ease',
        }}>
          📥 Drop PDF or Image here to upload
        </div>
      )}

      {/* Attached Images Preview Area */}
      {images.length > 0 && (
        <div style={{
          maxWidth: 'var(--content-max-width, 780px)',
          width: '100%', marginBottom: 10,
          display: 'flex', gap: 10, flexWrap: 'wrap',
        }}>
          {images.map((img, idx) => (
            <div key={idx} style={{
              position: 'relative', width: 64, height: 64, borderRadius: 10,
              overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)',
              background: '#1a1a1a',
            }}>
              <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => removeImage(idx)}
                style={{
                  position: 'absolute', top: 2, right: 2,
                  background: 'rgba(0,0,0,0.7)', border: 'none',
                  color: '#fff', borderRadius: '50%', width: 18, height: 18,
                  fontSize: 12, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tool bar */}
      <div style={{
        maxWidth: 'var(--content-max-width, 780px)',
        width: '100%', marginBottom: 10,
        display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap'
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
          📄 PDF
          <input type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && onUploadPDF(e.target.files[0])} />
        </label>

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
          🖼️ Image
          <input type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && handleImageFile(e.target.files[0])} />
        </label>

        <button
          onClick={toggleListening}
          disabled={isTranscribing}
          title={isTranscribing ? "Transcribing speech..." : isListening ? "Stop listening" : "Voice input (Whisper STT)"}
          style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 20,
            background: isTranscribing ? 'rgba(212,132,94,0.15)' : isListening ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isTranscribing ? 'rgba(212,132,94,0.3)' : isListening ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.06)'}`,
            color: isTranscribing ? '#d4845e' : isListening ? '#f87171' : '#777',
            cursor: isTranscribing ? 'wait' : 'pointer', transition: 'all 0.25s ease',
            fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
            animation: isListening ? 'pulse 1.5s infinite' : 'none',
          }}
        >
          {isTranscribing ? '⚡ Transcribing...' : isListening ? '🔴 Recording...' : '🎙️ Voice'}
        </button>

        <button
          onClick={() => {
            setValue(prev => prev ? `Generate an image of ${prev}` : 'Generate an image of a futuristic cyberpunk city with neon lights at night')
            if (textareaRef.current) textareaRef.current.focus()
          }}
          title="Generate AI Image"
          style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 20,
            background: 'rgba(212,132,94,0.08)',
            border: '1px solid rgba(212,132,94,0.2)',
            color: '#d4845e',
            cursor: 'pointer', transition: 'all 0.25s ease',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,132,94,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(212,132,94,0.08)'}
        >
          🎨 Draw Image
        </button>

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
