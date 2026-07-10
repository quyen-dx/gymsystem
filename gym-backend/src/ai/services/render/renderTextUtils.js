export const SEPARATOR = '────────────────────────'

export const safeText = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'object') return fallback
  const text = String(value).trim()
  if (!text || /^(undefined|null|nan|\[object object\])$/i.test(text)) return fallback
  if (/^[a-f0-9]{24}$/i.test(text)) return fallback
  return text
}

export const titleText = (value, fallback = '') => safeText(value, fallback).toUpperCase()

export const formatPriceText = (value, lang = 'vi', fallback = '') => {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return `${number.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}đ`
}

export const formatDaysText = (value, lang = 'vi', fallback = '') => {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return lang === 'en' ? `${number} days` : `${number} ngày`
}

export const formatEmailText = (email) => {
  const value = safeText(email)
  if (!value) return ''
  return value
}

export const compactList = (items = [], separator = ' • ') => (
  (Array.isArray(items) ? items : String(items || '').split(','))
    .map((item) => safeText(item))
    .filter(Boolean)
    .join(separator)
)

export const bulletList = (items = []) => (
  (Array.isArray(items) ? items : [])
    .map((item) => safeText(item))
    .filter(Boolean)
    .map((item) => `• ${item}`)
)
