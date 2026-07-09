const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) {
  throw new Error('VITE_API_URL is required')
}

export const API_URL = apiUrl.replace(/\/+$/, '')
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, '')
