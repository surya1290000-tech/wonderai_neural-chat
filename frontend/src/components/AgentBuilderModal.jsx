import { useState, useEffect } from 'react'
import { agentsAPI, modelsAPI } from '../utils/api'

const EMOJI_OPTIONS = [
  '🤖', '🧑‍💻', '✍️', '🎓', '🔬', '📊', '🎨', '🎯', '💡', '🧠',
  '🚀', '⚡', '🔍', '📝', '💬', '🛡️', '🌐', '🏗️', '📈', '🎭',
  '👨‍🔬', '👩‍💼', '🧑‍🏫', '👨‍⚕️', '🧑‍🍳', '👩‍🎨', '🦾', '🤝', '💎', '🏆',
]

const COLOR_OPTIONS = [
  '#d4845e', '#e06c75', '#e5c07b', '#98c379', '#56b6c2',
  '#61afef', '#c678dd', '#ff6b9d', '#c3a6ff', '#f78166',
  '#7ee787', '#79c0ff', '#ffa657', '#ff7eb6', '#d2a8ff',
]

const TOOL_OPTIONS = [
  { name: 'web_search', label: 'Web Search', icon: '🔍', desc: 'Search the internet for current info' },
  { name: 'run_code', label: 'Code Execution', icon: '💻', desc: 'Run Python code in a sandbox' },
  { name: 'generate_image', label: 'Image Generation', icon: '🎨', desc: 'Generate AI images' },
  { name: 'get_weather', label: 'Weather', icon: '🌤️', desc: 'Get current weather data' },
]

const TEMP_PRESETS = [
  { label: 'Precise', value: 0.2, desc: 'Factual, consistent' },
  { label: 'Balanced', value: 0.7, desc: 'Default' },
  { label: 'Creative', value: 1.2, desc: 'Imaginative, varied' },
]

export default function AgentBuilderModal({ isOpen, onClose, onSave, editAgent }) {
  const isEdit = !!editAgent

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('🤖')
  const [avatarColor, setAvatarColor] = useState('#d4845e')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState('')
  const [topP, setTopP] = useState('')
  const [toolsEnabled, setToolsEnabled] = useState(['*'])
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [starters, setStarters] = useState(['', '', '', ''])
  const [category, setCategory] = useState('general')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [models, setModels] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    modelsAPI.list().then(({ data }) => {
      if (data.models) setModels(data.models)
      else if (data.default) setModels([data.default])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (editAgent) {
      setName(editAgent.name || '')
      setDescription(editAgent.description || '')
      setAvatarEmoji(editAgent.avatar_emoji || '🤖')
      setAvatarColor(editAgent.avatar_color || '#d4845e')
      setSystemPrompt(editAgent.system_prompt || '')
      setModel(editAgent.model || '')
      setTemperature(editAgent.temperature ?? 0.7)
      setMaxTokens(editAgent.max_tokens ?? '')
      setTopP(editAgent.top_p ?? '')
      setToolsEnabled(editAgent.tools_enabled || ['*'])
      setWelcomeMessage(editAgent.welcome_message || '')
      setStarters(editAgent.conversation_starters?.length ? [...editAgent.conversation_starters, '', '', '', ''].slice(0, 4) : ['', '', '', ''])
      setCategory(editAgent.category || 'general')
    } else {
      setName(''); setDescription(''); setAvatarEmoji('🤖'); setAvatarColor('#d4845e')
      setSystemPrompt(''); setModel(''); setTemperature(0.7); setMaxTokens(''); setTopP('')
      setToolsEnabled(['*']); setWelcomeMessage(''); setStarters(['', '', '', '']); setCategory('general')
    }
  }, [editAgent, isOpen])

  const allToolsEnabled = toolsEnabled.includes('*')

  const toggleAllTools = () => {
    setToolsEnabled(allToolsEnabled ? [] : ['*'])
  }

  const toggleTool = (toolName) => {
    if (allToolsEnabled) {
      // Switch from "all" to specific selection minus this tool
      setToolsEnabled(TOOL_OPTIONS.map(t => t.name).filter(n => n !== toolName))
    } else {
      setToolsEnabled(prev =>
        prev.includes(toolName) ? prev.filter(n => n !== toolName) : [...prev, toolName]
      )
    }
  }

  const isToolEnabled = (toolName) => {
    return allToolsEnabled || toolsEnabled.includes(toolName)
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Agent name is required'); return }
    if (!systemPrompt.trim()) { setError('System prompt is required'); return }
    setError(null)
    setSaving(true)

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      avatar_emoji: avatarEmoji,
      avatar_color: avatarColor,
      system_prompt: systemPrompt.trim(),
      model: model || null,
      temperature,
      max_tokens: maxTokens ? parseInt(maxTokens) : null,
      top_p: topP ? parseFloat(topP) : null,
      tools_enabled: toolsEnabled,
      welcome_message: welcomeMessage.trim() || null,
      conversation_starters: starters.filter(s => s.trim()),
      category,
    }

    try {
      let result
      if (isEdit) {
        result = await agentsAPI.update(editAgent.id, payload)
      } else {
        result = await agentsAPI.create(payload)
      }
      if (onSave) onSave(result.data)
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save agent')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="agent-builder-overlay" onClick={onClose}>
      <div className="agent-builder-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="agent-builder-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>{avatarEmoji}</div>
            <div>
              <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, color: '#f0f0f0' }}>
                {isEdit ? 'Edit Agent' : 'Create Agent'}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                Build a custom AI persona with specific capabilities
              </div>
            </div>
          </div>
          <button onClick={onClose} className="agent-builder-close">×</button>
        </div>

        {/* Body — two columns */}
        <div className="agent-builder-body">
          {/* Left Column — Identity & Prompt */}
          <div className="agent-builder-col">
            {/* Avatar Picker */}
            <div className="agent-builder-section">
              <label className="agent-builder-label">Avatar</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}66)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, flexShrink: 0,
                  border: '2px solid rgba(255,255,255,0.1)',
                  boxShadow: `0 8px 24px ${avatarColor}33`,
                }}>{avatarEmoji}</div>
                <div>
                  <div className="emoji-picker-grid">
                    {EMOJI_OPTIONS.map(e => (
                      <button
                        key={e}
                        onClick={() => setAvatarEmoji(e)}
                        className={`emoji-picker-btn ${avatarEmoji === e ? 'active' : ''}`}
                      >{e}</button>
                    ))}
                  </div>
                  <div className="color-picker-row">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setAvatarColor(c)}
                        className={`color-picker-btn ${avatarColor === c ? 'active' : ''}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="agent-builder-section">
              <label className="agent-builder-label">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Code Reviewer, Marketing Writer..."
                maxLength={100}
                className="agent-builder-input"
              />
            </div>

            {/* Description */}
            <div className="agent-builder-section">
              <label className="agent-builder-label">Description <span className="agent-builder-optional">optional</span></label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Short description of what this agent does..."
                maxLength={200}
                className="agent-builder-input"
              />
            </div>

            {/* System Prompt */}
            <div className="agent-builder-section" style={{ flex: 1 }}>
              <label className="agent-builder-label">
                System Prompt
                <span style={{ float: 'right', fontSize: 11, color: systemPrompt.length > 7000 ? '#f87171' : '#555', fontFamily: 'JetBrains Mono, monospace' }}>
                  {systemPrompt.length.toLocaleString()} / 8,000
                </span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="You are an expert code reviewer. When reviewing code, always check for..."
                maxLength={8000}
                className="agent-builder-textarea"
                rows={8}
              />
            </div>

            {/* Welcome Message */}
            <div className="agent-builder-section">
              <label className="agent-builder-label">Welcome Message <span className="agent-builder-optional">optional</span></label>
              <input
                value={welcomeMessage}
                onChange={e => setWelcomeMessage(e.target.value)}
                placeholder="Hi! I'm your code reviewer. Paste any code and I'll analyze it."
                maxLength={500}
                className="agent-builder-input"
              />
            </div>

            {/* Conversation Starters */}
            <div className="agent-builder-section">
              <label className="agent-builder-label">Conversation Starters <span className="agent-builder-optional">up to 4</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {starters.map((s, i) => (
                  <input
                    key={i}
                    value={s}
                    onChange={e => {
                      const next = [...starters]
                      next[i] = e.target.value
                      setStarters(next)
                    }}
                    placeholder={`Starter ${i + 1}...`}
                    maxLength={150}
                    className="agent-builder-input"
                    style={{ fontSize: 13 }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column — Settings */}
          <div className="agent-builder-col" style={{ maxWidth: 340 }}>
            {/* Model Selector */}
            <div className="agent-builder-section">
              <label className="agent-builder-label">Model <span className="agent-builder-optional">override</span></label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="agent-builder-select"
              >
                <option value="">Use default model</option>
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div className="agent-builder-section">
              <label className="agent-builder-label">
                Temperature
                <span style={{ float: 'right', color: '#d4845e', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                  {temperature.toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="agent-builder-slider"
              />
              <div className="temp-presets">
                {TEMP_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setTemperature(p.value)}
                    className={`temp-preset-btn ${Math.abs(temperature - p.value) < 0.05 ? 'active' : ''}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tool Permissions */}
            <div className="agent-builder-section">
              <label className="agent-builder-label">Tool Permissions</label>
              <button
                onClick={toggleAllTools}
                className={`tool-toggle-all ${allToolsEnabled ? 'active' : ''}`}
              >
                {allToolsEnabled ? '✓ All Tools Enabled' : 'Enable All Tools'}
              </button>
              <div className="tool-permission-grid">
                {TOOL_OPTIONS.map(tool => (
                  <button
                    key={tool.name}
                    onClick={() => toggleTool(tool.name)}
                    className={`tool-permission-item ${isToolEnabled(tool.name) ? 'active' : ''}`}
                  >
                    <span className="tool-permission-icon">{tool.icon}</span>
                    <div>
                      <div className="tool-permission-name">{tool.label}</div>
                      <div className="tool-permission-desc">{tool.desc}</div>
                    </div>
                    <div className={`tool-permission-check ${isToolEnabled(tool.name) ? 'checked' : ''}`}>
                      {isToolEnabled(tool.name) ? '✓' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'transparent', border: 'none', color: '#888',
                fontSize: 12, cursor: 'pointer', padding: '8px 0',
                display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
              }}
            >
              <span style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>▸</span>
              Advanced Settings
            </button>

            {showAdvanced && (
              <>
                <div className="agent-builder-section">
                  <label className="agent-builder-label">Max Tokens <span className="agent-builder-optional">optional</span></label>
                  <input
                    value={maxTokens}
                    onChange={e => setMaxTokens(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 4096"
                    className="agent-builder-input"
                    type="number"
                  />
                </div>
                <div className="agent-builder-section">
                  <label className="agent-builder-label">Top-P <span className="agent-builder-optional">optional</span></label>
                  <input
                    value={topP}
                    onChange={e => setTopP(e.target.value)}
                    placeholder="e.g. 0.95"
                    className="agent-builder-input"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                  />
                </div>
                <div className="agent-builder-section">
                  <label className="agent-builder-label">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="agent-builder-select">
                    <option value="general">General</option>
                    <option value="coding">Coding</option>
                    <option value="writing">Writing</option>
                    <option value="business">Business</option>
                    <option value="education">Education</option>
                    <option value="research">Research</option>
                    <option value="creative">Creative</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="agent-builder-footer">
          {error && (
            <div style={{ color: '#f87171', fontSize: 13, flex: 1 }}>{error}</div>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="agent-builder-btn-cancel">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="agent-builder-btn-save">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
