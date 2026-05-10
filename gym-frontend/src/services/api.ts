import axios from 'axios'
import { API_URL } from '../config/env'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

let refreshPromise: Promise<string | null> | null = null

export const clearAuthSession = () => {
  localStorage.removeItem('token')
}

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh', undefined, {
      skipAuthRefresh: true,
    } as any)
      .then((response) => {
        const accessToken = response.data?.accessToken || null
        if (accessToken) localStorage.setItem('token', accessToken)
        return accessToken
      })
      .catch((error) => {
        clearAuthSession()
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status
    const isRefreshRequest = originalRequest?.skipAuthRefresh || originalRequest?.url?.includes('/auth/refresh')
    const isLoginRequest = originalRequest?.url?.includes('/auth/login')

    if (status === 401 && originalRequest && !originalRequest._retry && !isRefreshRequest && !isLoginRequest) {
      originalRequest._retry = true
      try {
        const newToken = await refreshAccessToken()
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch {
        clearAuthSession()
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      }
    }

    if (status === 401 && isRefreshRequest) {
      clearAuthSession()
    }

    if (status === 403 && String(error.response?.data?.message || '').includes('Tài khoản đã bị khóa')) {
      clearAuthSession()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api
