const normalizeBaseUrl = (url) => url?.trim().replace(/\/+$/, '')

export const getClientUrls = () => {
  const configuredUrls = process.env.CLIENT_URL || ''

  return configuredUrls
    .split(',')
    .map(normalizeBaseUrl)
    .filter(Boolean)
}

export const getClientUrl = () => {
  const clientUrl = getClientUrls()[0]
  if (!clientUrl) throw new Error('CLIENT_URL is required')
  return clientUrl
}

export const getBackendUrl = () => {
  const backendUrl = normalizeBaseUrl(process.env.BACKEND_URL)
  if (!backendUrl) throw new Error('BACKEND_URL is required')
  return backendUrl
}

export const buildClientUrl = (pathname, searchParams = {}) => {
  const url = new URL(pathname, getClientUrl())

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}
