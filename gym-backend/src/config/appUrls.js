const LOCAL_CLIENT_URL = 'http://localhost:5173'
const LOCAL_BACKEND_URL = 'http://localhost:5000'

const normalizeBaseUrl = (url) => url?.trim().replace(/\/+$/, '')

export const getClientUrls = () => {
  const configuredUrls = process.env.CLIENT_URL || LOCAL_CLIENT_URL

  return configuredUrls
    .split(',')
    .map(normalizeBaseUrl)
    .filter(Boolean)
}

export const getClientUrl = () => getClientUrls()[0] || LOCAL_CLIENT_URL

export const getBackendUrl = () =>
  normalizeBaseUrl(process.env.BACKEND_URL) || LOCAL_BACKEND_URL

export const buildClientUrl = (pathname, searchParams = {}) => {
  const url = new URL(pathname, getClientUrl())

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}
