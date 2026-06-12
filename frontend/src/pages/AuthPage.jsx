import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function PasswordStrength({ password }) {
  const getStrength = (pw) => {
    let score = 0
    if (pw.length >= 6) score++
    if (pw.length >= 10) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return score
  }

  const strength = getStrength(password)
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  const colors = ['', '#f87171', '#fbbf24', '#fbbf24', '#4ade80', '#22d3ee']

  if (!password) return null

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 3,
            background: i <= strength ? colors[strength] : 'rgba(255,255,255,0.06)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>
      <span style={{
        fontSize: 11, color: colors[strength], fontWeight: 500,
        transition: 'color 0.3s ease',
      }}>{labels[strength]}</span>
    </div>
  )
}

export default function AuthPage() {
  const [tab, setTab] = useState('login')
  const [step, setStep] = useState('credentials') // 'credentials' | 'otp'
  const [form, setForm] = useState({ email: '', username: '', password: '', otp: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const { login, register, verifyEmail, verify2FA } = useAuth()
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submitCredentials = async () => {
    setError(''); setSuccess(''); setLoading(true)
    try {
      let data;
      if (tab === 'login') {
        data = await login(form.email, form.password)
      } else {
        data = await register(form.email, form.username, form.password)
      }
      
      if (data && data.require_otp) {
        setSuccess(data.message)
        setStep('otp')
      } else {
        navigate('/') // Just in case it succeeded without OTP
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong')
    }
    setLoading(false)
  }

  const submitOTP = async () => {
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (tab === 'login') {
        await verify2FA(form.email, form.otp)
      } else {
        await verifyEmail(form.email, form.otp)
      }
      navigate('/')
    } catch (e) {
      setError(e.response?.data?.detail || 'Invalid verification code')
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: '12px 16px',
    color: '#ececec', fontSize: 15,
    transition: 'all 0.25s ease',
    textAlign: step === 'otp' ? 'center' : 'left',
    letterSpacing: step === 'otp' ? '4px' : 'normal'
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: '#0c0c0c',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient background effects */}
      <div style={{
        position: 'absolute', top: '-30%', left: '-10%',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(212,132,94,0.06) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none',
        animation: 'breathe 8s ease infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(147,130,220,0.05) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none',
        animation: 'breathe 10s ease infinite 2s',
      }} />
      
      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 4 + (i % 3) * 2,
          height: 4 + (i % 3) * 2,
          borderRadius: '50%',
          background: `rgba(212,132,94,${0.08 + (i % 3) * 0.04})`,
          top: `${15 + i * 13}%`,
          left: `${10 + i * 15}%`,
          animation: `breathe ${3 + i}s ease infinite ${i * 0.5}s`,
          pointerEvents: 'none',
        }} />
      ))}

      <div style={{
        animation: 'fadeInUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
        width: '100%',
        maxWidth: '420px',
        padding: '0 24px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 20,
            background: 'linear-gradient(135deg, #d4845e, #c07050)',
            marginBottom: 20, fontSize: 28, color: '#fff',
            boxShadow: '0 8px 30px rgba(212,132,94,0.25), 0 0 60px rgba(212,132,94,0.1)',
            animation: 'breathe 3s ease infinite',
          }}>✦</div>
          <h1 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: 32, fontWeight: 700,
            color: '#ececec', margin: 0, marginBottom: 8,
            letterSpacing: '-0.02em'
          }}>Wonder AI</h1>
          <p style={{ color: '#666', fontSize: 15, margin: 0, fontWeight: 400 }}>
            {step === 'otp' ? 'Verification Required' : 'Your intelligent AI assistant'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(22,22,22,0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 24,
          padding: '36px 32px',
          boxShadow: '0 16px 60px rgba(0,0,0,0.4)',
        }}>
          {step === 'credentials' ? (
            <>
              {/* Tabs */}
              <div style={{
                display: 'flex', gap: 4,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 14, padding: 4,
                marginBottom: 28
              }}>
                {['login', 'register'].map(t => (
                  <button key={t}
                    onClick={() => { setTab(t); setError(''); setSuccess('') }}
                    style={{
                      flex: 1, padding: '11px 16px', borderRadius: 12,
                      background: tab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: tab === t ? '#ececec' : '#666',
                      fontWeight: 600, fontSize: 14,
                      cursor: 'pointer', border: 'none',
                      transition: 'all 0.25s ease',
                      fontFamily: 'Outfit',
                    }}>{t === 'login' ? 'Sign In' : 'Create Account'}</button>
                ))}
              </div>

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#888', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Email</label>
                <input
                  style={inputStyle}
                  type="email" value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                  onKeyDown={e => e.key === 'Enter' && submitCredentials()}
                  onFocus={e => { e.target.style.borderColor = 'rgba(212,132,94,0.4)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
                />
              </div>

              {/* Username (register only) */}
              {tab === 'register' && (
                <div style={{ marginBottom: 16, animation: 'fadeInUp 0.3s ease' }}>
                  <label style={{ display: 'block', color: '#888', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Username</label>
                  <input
                    style={inputStyle}
                    type="text" value={form.username}
                    onChange={set('username')}
                    placeholder="username"
                    onKeyDown={e => e.key === 'Enter' && submitCredentials()}
                    onFocus={e => { e.target.style.borderColor = 'rgba(212,132,94,0.4)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
                  />
                </div>
              )}

              {/* Password */}
              <div style={{ marginBottom: tab === 'register' ? 12 : 20 }}>
                <label style={{ display: 'block', color: '#888', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: 44 }}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="••••••••"
                    onKeyDown={e => e.key === 'Enter' && submitCredentials()}
                    onFocus={e => { e.target.style.borderColor = 'rgba(212,132,94,0.4)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none',
                      color: '#666', cursor: 'pointer',
                      fontSize: 16, padding: '4px',
                      transition: 'color 0.2s',
                      display: 'flex', alignItems: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#aaa'}
                    onMouseLeave={e => e.currentTarget.style.color = '#666'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
                {tab === 'register' && <PasswordStrength password={form.password} />}
              </div>

              {/* Remember me (login only) */}
              {tab === 'login' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 24,
                }}>
                  <button
                    type="button"
                    onClick={() => setRememberMe(!rememberMe)}
                    style={{
                      width: 18, height: 18, borderRadius: 5,
                      border: `1.5px solid ${rememberMe ? '#d4845e' : 'rgba(255,255,255,0.12)'}`,
                      background: rememberMe ? 'rgba(212,132,94,0.15)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      padding: 0, flexShrink: 0,
                    }}
                  >
                    {rememberMe && (
                      <span style={{ color: '#d4845e', fontSize: 11, fontWeight: 700 }}>✓</span>
                    )}
                  </button>
                  <span style={{ fontSize: 13, color: '#888', userSelect: 'none', cursor: 'pointer' }}
                    onClick={() => setRememberMe(!rememberMe)}
                  >
                    Remember me
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* OTP Step */}
              <div style={{ marginBottom: 20, textAlign: 'center' }}>
                <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20 }}>
                  We've sent a 6-digit code to <strong style={{ color: '#ececec' }}>{form.email}</strong>. 
                  Please enter it below to verify your identity.
                </p>
                <input
                  style={inputStyle}
                  type="text"
                  maxLength={6}
                  value={form.otp}
                  onChange={e => setForm(f => ({ ...f, otp: e.target.value.replace(/\D/g, '') }))}
                  placeholder="000000"
                  onKeyDown={e => e.key === 'Enter' && submitOTP()}
                  onFocus={e => { e.target.style.borderColor = 'rgba(212,132,94,0.4)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
                />
              </div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                 <button 
                   type="button"
                   onClick={() => { setStep('credentials'); setForm(f => ({ ...f, otp: '' })); setError(''); setSuccess(''); }}
                   style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
                   Go back
                 </button>
              </div>
            </>
          )}

          {/* Messages */}
          {success && (
            <div style={{
              color: '#4ade80', fontSize: 13, marginBottom: 16,
              textAlign: 'center', padding: '10px 14px',
              background: 'rgba(74,222,128,0.08)', borderRadius: 10,
              border: '1px solid rgba(74,222,128,0.15)',
              animation: 'fadeInUp 0.3s ease',
            }}>{success}</div>
          )}

          {error && (
            <div style={{
              color: '#f87171', fontSize: 13, marginBottom: 16,
              textAlign: 'center', padding: '10px 14px',
              background: 'rgba(248,113,113,0.08)', borderRadius: 10,
              border: '1px solid rgba(248,113,113,0.15)',
              animation: 'fadeInUp 0.3s ease',
            }}>{error}</div>
          )}

          {/* Submit */}
          <button
            onClick={step === 'credentials' ? submitCredentials : submitOTP}
            disabled={loading || (step === 'otp' && form.otp.length !== 6)}
            style={{
              width: '100%',
              background: loading || (step === 'otp' && form.otp.length !== 6) ? '#333' : 'linear-gradient(135deg, #d4845e, #c07050)',
              color: loading || (step === 'otp' && form.otp.length !== 6) ? '#888' : '#fff',
              border: 'none', borderRadius: 14,
              padding: '14px 24px',
              fontWeight: 600, fontSize: 15,
              fontFamily: 'Outfit, sans-serif',
              cursor: loading || (step === 'otp' && form.otp.length !== 6) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: loading || (step === 'otp' && form.otp.length !== 6) ? 'none' : '0 4px 24px rgba(212,132,94,0.3)',
              letterSpacing: '0.01em',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => { if (!loading && !(step === 'otp' && form.otp.length !== 6)) e.target.style.boxShadow = '0 6px 30px rgba(212,132,94,0.4)' }}
            onMouseLeave={e => { if (!loading && !(step === 'otp' && form.otp.length !== 6)) e.target.style.boxShadow = '0 4px 24px rgba(212,132,94,0.3)' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  display: 'inline-block',
                }} />
                Please wait...
              </span>
            ) : (
              step === 'otp' ? 'Verify Code' : (tab === 'login' ? 'Sign In' : 'Create Account')
            )}
          </button>
        </div>

        <p style={{ textAlign: 'center', color: '#444', fontSize: 12, marginTop: 24 }}>
          Powered by Wonder AI · Privacy first · Secured with JWT
        </p>
      </div>
    </div>
  )
}
