import { useEffect, useState } from 'react'
import { clearAuthSession, refreshAccessToken } from '../services/api'
import { authService } from '../services/authService'
import { AuthContext, type LoginPayload, type User } from './auth.context'

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const bootstrapAuth = async () => {
      try {
        let token = localStorage.getItem('token')
        if (!token) {
          token = await refreshAccessToken()
        }

        if (!token) {
          if (!cancelled) setUser(null)
          return
        }

        const { data } = await authService.getProfile()
        console.debug('[profile-theme] user fetch after modal close/reload', data.user)
        if (!cancelled) setUser(data.user)
      } catch {
        clearAuthSession()
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    bootstrapAuth()
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (payload: LoginPayload) => {
    const { data } = await authService.login(payload)
    localStorage.setItem('token', data.accessToken)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await authService.logout()
    } catch {
      // Bỏ qua lỗi logout vì token có thể đã hết hạn.
    } finally {
      clearAuthSession()
      setUser(null)
      window.location.replace('/login')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
