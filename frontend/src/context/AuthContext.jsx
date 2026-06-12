import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('nc_user')
    const token = localStorage.getItem('nc_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password })
    localStorage.setItem('nc_token', data.token)
    localStorage.setItem('nc_refresh_token', data.refresh_token)
    localStorage.setItem('nc_user', JSON.stringify(data.user))
    setUser(data.user)
    return data
  }

  const register = async (email, username, password) => {
    const { data } = await authAPI.register({ email, username, password })
    localStorage.setItem('nc_token', data.token)
    localStorage.setItem('nc_refresh_token', data.refresh_token)
    localStorage.setItem('nc_user', JSON.stringify(data.user))
    setUser(data.user)
    return data
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

  const updateProfile = (updates) => {
    const updated = { ...user, ...updates }
    localStorage.setItem('nc_user', JSON.stringify(updated))
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
