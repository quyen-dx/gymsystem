import { useEffect, useState } from 'react'
import { clearAuthSession, clearLegacyAuthStorage, getAuthToken, setAuthToken, startRefreshScheduler } from '../services/api'
import { authService } from '../services/authService'
import { AuthContext, type LoginPayload, type User } from './auth.context'

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    const { data } = await authService.getProfile()
    setUser(data.user)
    return data.user
  }

  useEffect(() => {
    let cancelled = false

    const bootstrapAuth = async () => {
      try {
        clearLegacyAuthStorage()
        const token = getAuthToken()

        if (!token) {
          if (!cancelled) setUser(null)
          return
        }

        const { data } = await authService.getProfile()
        if (!cancelled) setUser(data.user)
        startRefreshScheduler()
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
    setAuthToken(data.accessToken)
    startRefreshScheduler()
    try {
      const freshUser = await refreshUser()
      return freshUser || data.user
    } catch {
      setUser(data.user)
      return data.user
    }
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
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser: setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
