import axios from 'axios'
import { jwtDecode } from 'jwt-decode'
import { message } from 'antd'
import { API_URL } from '../config/env'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
})

let refreshPromise: Promise<string | null> | null = null
let lastFeatureDisabledToastAt = 0
const authTokenKey = 'token'
const authRefreshTokenKey = 'refreshToken'
const legacyAuthKeys = ['token', 'accessToken', 'refreshToken', 'auth', 'user', 'role']

export const getAuthToken = () => sessionStorage.getItem(authTokenKey)

// Refresh token lưu theo từng TAB (sessionStorage) — không dùng chung cookie,
// tránh việc 2 tab đăng nhập 2 tài khoản khác nhau ghi đè lẫn nhau
export const getRefreshToken = () => sessionStorage.getItem(authRefreshTokenKey)

export const clearLegacyAuthStorage = () => {
  legacyAuthKeys.forEach((key) => localStorage.removeItem(key))
}

export const setAuthToken = (token: string, refreshToken?: string) => {
  sessionStorage.setItem(authTokenKey, token)
  if (refreshToken) sessionStorage.setItem(authRefreshTokenKey, refreshToken)
  clearLegacyAuthStorage()
}

export const clearAuthSession = () => {
  sessionStorage.removeItem(authTokenKey)
  sessionStorage.removeItem(authRefreshTokenKey)
  clearLegacyAuthStorage()
}

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh', {
      refreshToken: getRefreshToken(),
      accessToken: getAuthToken(),
    }, {
      skipAuthRefresh: true,
    } as any)
      .then((response) => {
        const accessToken = response.data?.accessToken || null
        if (accessToken) {
          setAuthToken(accessToken, response.data?.refreshToken)
        }
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

let refreshTimer: ReturnType<typeof setTimeout> | null = null

const scheduleTokenRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  const token = getAuthToken()
  if (!token) return
  try {
    const decoded = jwtDecode<{ exp: number }>(token)
    const expiresIn = decoded.exp * 1000 - Date.now()
    if (expiresIn <= 0) {
      refreshAccessToken().catch(() => {})
      return
    }
    const refreshAt = Math.max(expiresIn - 60000, 10000)
    refreshTimer = setTimeout(() => {
      refreshAccessToken()
        .then((newToken) => {
          if (newToken) scheduleTokenRefresh()
        })
        .catch(() => {})
    }, refreshAt)
  } catch {
    // invalid token
  }
}

export const startRefreshScheduler = scheduleTokenRefresh

/** Returns headers for raw fetch calls that need auth (SSE, streaming) */
function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
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

export const sendChatMessage = async (message: string, sessionId?: string) => {
  const { data } = await api.post('/ai/chat', { message, sessionId })
  return data as {
    reply: string
    cards?: Array<{ type: string; title: string; data: Record<string, unknown>; deeplink?: string; suggestions?: string[] }>
    suggestions?: string[]
    deeplinks?: string[]
    actions?: Array<{ label: string; route: string; icon: string; variant: string }>
  }
}

export const sendVisionImage = async (file: File, prompt?: string) => {
  const formData = new FormData()
  formData.append('image', file)
  if (prompt) formData.append('prompt', prompt)
  const { data } = await api.post('/ai/vision', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { analysis: string; fileName: string; fileSize: number }
}

type StreamCallbacks = {
  onToken: (text: string) => void
  onCard: (card: unknown) => void
  onSuggestion: (text: string) => void
  onDeeplink: (url: string) => void
  onAction: (action: { label: string; route: string; icon: string; variant: string }) => void
  onDone: (reply: string) => void
  onError: (message: string) => void
}

export async function streamChatMessage(
  message: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<{ reply: string } | null> {
  try {
    const res = await fetch(`${API_URL}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ message }),
      signal,
    })

    if (!res.ok) {
      if (signal?.aborted) return null
      const statusText = res.status === 401 ? 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.'
        : res.status >= 500 ? 'Hệ thống đang gặp sự cố, vui lòng thử lại sau.'
        : 'Không thể kết nối đến trợ lý GymPro.'
      callbacks.onError(statusText)
      return null
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let reply = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let eventType = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const dataStr = line.slice(6)
          try {
            const data = JSON.parse(dataStr)
            if (eventType === 'token') callbacks.onToken(data.text)
            else if (eventType === 'card') callbacks.onCard(data)
            else if (eventType === 'suggestion') callbacks.onSuggestion(data.text)
            else if (eventType === 'deeplink') callbacks.onDeeplink(data.url)
            else if (eventType === 'action') callbacks.onAction(data)
            else if (eventType === 'done') { reply = data.reply; callbacks.onDone(data.reply) }
            else if (eventType === 'error') callbacks.onError(data.message)
          } catch { /* skip malformed JSON */ }
          eventType = ''
        }
      }
    }

    return { reply }
  } catch (err: any) {
    if (err.name === 'AbortError') return null
    callbacks.onError('Không thể kết nối đến trợ lý GymPro.')
    return null
  }
}

export default api
