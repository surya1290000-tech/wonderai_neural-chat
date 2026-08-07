import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const stored = localStorage.getItem('nc_user')
      const token = localStorage.getItem('nc_token')
      if (token) {
        try {
          const { data } = await authAPI.getProfile()
          setUser(data)
          localStorage.setItem('nc_user', JSON.stringify(data))
        } catch (err) {
          if (stored) {
            try { setUser(JSON.parse(stored)) } catch {}
          }
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password })
    // Return early if OTP is required (which it always is now)
    if (data.require_otp) {
      return data
    }
    _saveAuth(data)
    return data
  }

  const register = async (email, username, password) => {
    const { data } = await authAPI.register({ email, username, password })
    // Return early if OTP is required
    if (data.require_otp) {
      return data
    }
    _saveAuth(data)
    return data
  }

  const verifyEmail = async (email, otp_code) => {
    const { data } = await authAPI.verifyEmail({ email, otp_code })
    _saveAuth(data)
    return data
  }

  const verify2FA = async (email, otp_code) => {
    const { data } = await authAPI.verify2FA({ email, otp_code })
    _saveAuth(data)
    return data
  }

  const forgotPassword = async (email) => {
    const { data } = await authAPI.forgotPassword({ email })
    return data
  }

  const resetPassword = async (email, otp_code, new_password) => {
    const { data } = await authAPI.resetPassword({ email, otp_code, new_password })
    return data
  }

  const _saveAuth = (data) => {
    localStorage.setItem('nc_token', data.token)
    localStorage.setItem('nc_refresh_token', data.refresh_token)
    localStorage.setItem('nc_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch { /* ignore errors during logout */ }
    localStorage.removeItem('nc_token')
    localStorage.removeItem('nc_refresh_token')
    localStorage.removeItem('nc_user')
    setUser(null)
  }

  const updateProfile = async (updates) => {
    const { data } = await authAPI.updateProfile(updates)
    const updatedUser = data.user || { ...user, ...updates }
    localStorage.setItem('nc_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
    return data
  }

  return (
    <AuthContext.Provider value={{ user, login, register, verifyEmail, verify2FA, logout, updateProfile, forgotPassword, resetPassword, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
