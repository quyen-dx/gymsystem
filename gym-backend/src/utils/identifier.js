const emailRegex = /^\S+@\S+\.\S+$/
const phoneRegex = /^(0|\+84)\d{9}$/

export const isValidEmail = (value = '') => emailRegex.test(value.trim().toLowerCase())

export const normalizeEmail = (value = '') => value.trim().toLowerCase()

export const normalizePhone = (value = '') => value.trim().replace(/\s+/g, '')

export const isValidPhone = (value = '') => phoneRegex.test(normalizePhone(value))

export const detectIdentifierType = (value = '') => {
  const trimmed = value.trim()
  if (trimmed.includes('@')) return 'email'
  return 'phone'
}

export const normalizeIdentifier = (value = '') => {
  const type = detectIdentifierType(value)
  return type === 'email' ? normalizeEmail(value) : normalizePhone(value)
}
