import { useEffect, useState } from 'react'
import { authService } from '../services/authService'
import { AuthContext, type LoginPayload, type User } from './auth.context'

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async () => {
    try {
      const { data } = await authService.getProfile()
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetchProfile()
    } else {
      setLoading(false)
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
      if (localStorage.getItem('token')) {
        await authService.logout()
      }
    } catch {
      // Bỏ qua lỗi logout vì token có thể đã hết hạn.
    } finally {
      localStorage.removeItem('token')
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
