import axios from 'axios'
import { message } from 'antd'
import { API_URL } from '../config/env'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
})

let refreshPromise: Promise<string | null> | null = null
let lastFeatureDisabledToastAt = 0
const authTokenKey = 'token'
const legacyAuthKeys = ['token', 'accessToken', 'refreshToken', 'auth', 'user', 'role']

export const getAuthToken = () => sessionStorage.getItem(authTokenKey)

export const clearLegacyAuthStorage = () => {
  legacyAuthKeys.forEach((key) => localStorage.removeItem(key))
}

export const setAuthToken = (token: string) => {
  sessionStorage.setItem(authTokenKey, token)
  clearLegacyAuthStorage()
}

export const clearAuthSession = () => {
  sessionStorage.removeItem(authTokenKey)
  clearLegacyAuthStorage()
}

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh', undefined, {
      skipAuthRefresh: true,
    } as any)
      .then((response) => {
        const accessToken = response.data?.accessToken || null
        if (accessToken) setAuthToken(accessToken)
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
  const token = getAuthToken()
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
    const errorCode = error.response?.data?.code
    const isRefreshRequest = originalRequest?.skipAuthRefresh || originalRequest?.url?.includes('/auth/refresh')
    const isLoginRequest = originalRequest?.url?.includes('/auth/login')

    if (errorCode === 'ACCOUNT_LOCKED') {
      clearAuthSession()
      return Promise.reject(error)
    }

    if (errorCode === 'FEATURE_DISABLED' || errorCode === 'MAINTENANCE_MODE') {
      const translatedMessage = errorCode === 'MAINTENANCE_MODE'
        ? (
          error.response?.data?.maintenanceMessage?.vi ||
          (typeof error.response?.data?.message === 'object' ? error.response?.data?.message?.vi : '') ||
          'Hệ thống đang bảo trì. Vui lòng quay lại sau.'
        )
        : 'Tính năng này hiện đã bị tắt.'
      error.response.data.message = translatedMessage
      const now = Date.now()
      if (now - lastFeatureDisabledToastAt > 1200) {
        lastFeatureDisabledToastAt = now
        message.warning(translatedMessage)
      }
      if (errorCode === 'MAINTENANCE_MODE' && window.location.pathname !== '/maintenance') {
        window.location.href = '/maintenance'
      }
      return Promise.reject(error)
    }

    if (status === 401 && originalRequest && !originalRequest._retry && !isRefreshRequest && !isLoginRequest && getAuthToken()) {
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
      return Promise.reject(error)
    }
    return Promise.reject(error)
  },
)

export default api
