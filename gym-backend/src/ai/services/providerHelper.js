export function isProviderQuotaError(error) {
  if (!error) return false
  const message = String(error?.message || error || '')
  const status = error?.status || error?.code || error?.response?.status

  return (
    status === 429 ||
    status === 503 ||
    /quota/i.test(message) ||
    message.includes('RESOURCE_EXHAUSTED') ||
    /rate.?limit/i.test(message) ||
    /timeout/i.test(message) ||
    message.includes('Service Unavailable') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND') ||
    message.includes('Tất cả API key member đã hết quota')
  )
}

export function isInternalCodeError(error) {
  if (!error) return false
  const message = String(error?.message || error || '')

  if (
    (message.includes('JSON') && /parse/i.test(message)) ||
    message.includes('Cannot read properties of undefined') ||
    message.includes('Cannot read property') ||
    message === 'undefined' ||
    message === 'null' ||
    message.includes('Mongoose') ||
    message.includes('MongoError') ||
    message.includes('MongoServerError') ||
    message.includes('ValidationError') ||
    message.includes('CastError') ||
    message.includes('validation failed')
  ) {
    return true
  }

  return false
}
