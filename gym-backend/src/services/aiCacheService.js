const ttlCache = new Map()

const AI_DOMAIN_CACHE_KEYS = {
  plans: ['activePlans', 'plans'],
  pts: ['ptList', 'ptAvailability', 'activePTs'],
  products: ['products'],
  faqs: ['faqs'],
  policies: ['policies'],
  settings: ['systemSettings'],
  landing: ['landingCms'],
}

export const getCached = async (key, ttlSeconds, loader) => {
  const now = Date.now()
  const cached = ttlCache.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
  const value = await loader()
  ttlCache.set(key, { value, expiresAt: now + ttlSeconds * 1000 })
  return value
}

export const invalidateAppCache = (key) => {
  if (!key) {
    ttlCache.clear()
    console.log('[AI_CACHE] invalidate: all')
    return
  }
  const deleted = ttlCache.delete(key)
  for (const cacheKey of ttlCache.keys()) {
    if (cacheKey.startsWith(key + ':')) {
      ttlCache.delete(cacheKey)
    }
  }
  console.log('[AI_CACHE] invalidate:', key, deleted || false)
}

export const invalidateAiDomainCache = (domain) => {
  const normalized = String(domain || '').trim()
  const keys = AI_DOMAIN_CACHE_KEYS[normalized] || [normalized]
  keys.filter(Boolean).forEach((key) => invalidateAppCache(key))
  console.log('[AI_CACHE] invalidate domain:', normalized || 'all', keys)
}

export const invalidateAiPTCache = () => {
  invalidateAppCache('ptList')
  invalidateAppCache('ptAvailability')
  invalidateAppCache('activePTs')
  console.log('[AI_CACHE] invalidate: PT data')
}