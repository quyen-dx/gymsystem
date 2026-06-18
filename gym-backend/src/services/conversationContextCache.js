const DEFAULT_CONVERSATION_ID = 'default'

const cacheStore = new Map()
const keyVersions = new Map()

const normalizeId = (value, fallback = DEFAULT_CONVERSATION_ID) => {
  const text = String(value || '').trim()
  return text || fallback
}

const getDataKey = (key) => String(key || '').split(':')[0]

const getScopeKey = (conversationId, userId) => `${normalizeId(userId, 'anonymous')}::${normalizeId(conversationId)}`

const getEntryKey = (key, variant = '') => {
  const suffix = String(variant || '').trim()
  return suffix ? `${key}:${suffix}` : key
}

const getVersion = (key) => keyVersions.get(getDataKey(key)) || 0

const ensureScope = ({ conversationId, userId }) => {
  const scopeKey = getScopeKey(conversationId, userId)
  const existing = cacheStore.get(scopeKey)
  if (existing) return existing

  const now = new Date()
  const scope = {
    conversationId: normalizeId(conversationId),
    userId: normalizeId(userId, 'anonymous'),
    cachedAt: now,
    expiresAt: now,
    data: {},
    entries: new Map(),
  }
  cacheStore.set(scopeKey, scope)
  return scope
}

const refreshScopeMetadata = (scope) => {
  const entries = Array.from(scope.entries.values())
  scope.cachedAt = entries.reduce((oldest, entry) => {
    if (!oldest || entry.cachedAt < oldest) return entry.cachedAt
    return oldest
  }, null) || new Date()
  scope.expiresAt = entries.reduce((latest, entry) => {
    if (!latest || entry.expiresAt > latest) return entry.expiresAt
    return latest
  }, null) || new Date()
}

const cleanupExpiredEntries = () => {
  const now = Date.now()
  for (const [scopeKey, scope] of cacheStore.entries()) {
    for (const [entryKey, entry] of scope.entries.entries()) {
      if (entry.expiresAt.getTime() <= now || entry.version !== getVersion(entry.key)) {
        scope.entries.delete(entryKey)
        delete scope.data[entry.key]
      }
    }
    if (scope.entries.size === 0) {
      cacheStore.delete(scopeKey)
    } else {
      refreshScopeMetadata(scope)
    }
  }
}

export const contextCache = {
  async getOrLoad({ conversationId, userId, key, ttlSeconds, loader, variant = '' }) {
    const dataKey = getDataKey(key)
    const entryKey = getEntryKey(dataKey, variant)
    const scope = ensureScope({ conversationId, userId })
    const nowMs = Date.now()
    const version = getVersion(dataKey)
    const cached = scope.entries.get(entryKey)

    if (cached && cached.expiresAt.getTime() > nowMs && cached.version === version) {
      return cached.value
    }
    const value = await loader()
    const cachedAt = new Date()
    const expiresAt = new Date(cachedAt.getTime() + Number(ttlSeconds || 0) * 1000)
    scope.entries.set(entryKey, {
      key: dataKey,
      variant,
      value,
      cachedAt,
      expiresAt,
      version,
    })
    scope.data[dataKey] = value
    refreshScopeMetadata(scope)

    if (cacheStore.size > 500) cleanupExpiredEntries()
    return value
  },
}

export const invalidateContextCache = (key, { userId } = {}) => {
  const dataKey = getDataKey(key)
  if (!userId) keyVersions.set(dataKey, getVersion(dataKey) + 1)

  for (const [scopeKey, scope] of cacheStore.entries()) {
    if (userId && String(scope.userId) !== String(userId)) continue
    for (const [entryKey, entry] of scope.entries.entries()) {
      if (entry.key === dataKey) {
        scope.entries.delete(entryKey)
        delete scope.data[dataKey]
      }
    }
    if (scope.entries.size === 0) {
      cacheStore.delete(scopeKey)
    } else {
      refreshScopeMetadata(scope)
    }
  }

  console.log('[CONTEXT_CACHE] invalidate:', dataKey)
}

export const invalidatePersonalContextCache = (userId) => {
  if (!userId) return
  ;['currentMembership', 'checkinStats', 'upcomingBookings', 'ptAvailability'].forEach((key) => {
    invalidateContextCache(key, { userId })
  })
}
