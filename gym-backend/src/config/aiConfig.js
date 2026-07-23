function parseList(envVar) {
  return (process.env[envVar] || '').split(',').map(s => s.trim()).filter(Boolean)
}

// ----- Provider API key resolution -----

function resolveApiKeys(prefix, legacyMulti, legacySingle) {
  let keys = parseList(`${prefix}_API_KEYS`)
  if (keys.length) return keys

  if (legacyMulti) {
    keys = parseList(legacyMulti)
    if (keys.length) {
      console.warn(`[aiConfig] ${legacyMulti} is deprecated, use ${prefix}_API_KEYS instead`)
      return keys
    }
  }

  const envSingle = process.env[`${prefix}_API_KEY`]
  const envLegacy = legacySingle ? process.env[legacySingle] : undefined
  const single = envSingle || envLegacy
  if (single) {
    if (!envSingle && envLegacy) {
      console.warn(`[aiConfig] ${legacySingle} is deprecated, use ${prefix}_API_KEY instead`)
    }
    return [single]
  }

  return []
}

function resolveModels(prefix, defaults) {
  const models = parseList(`${prefix}_MODELS`)
  return models.length ? models : defaults
}

function resolveEnabled(prefix) {
  return process.env[`${prefix}_ENABLED`] !== 'false'
}

// ----- Per-provider configurations -----

export const providers = {
  google: {
    enabled: resolveEnabled('GOOGLE'),
    models: resolveModels('GOOGLE', ['gemini-2.5-flash-lite']),
    apiKeys: resolveApiKeys('GOOGLE', 'GEMINI_API_KEYS', 'GEMINI_API_KEY'),
  },
  deepseek: {
    enabled: resolveEnabled('DEEPSEEK'),
    models: resolveModels('DEEPSEEK', ['deepseek-chat']),
    apiKeys: resolveApiKeys('DEEPSEEK'),
  },
  openrouter: {
    enabled: resolveEnabled('OPENROUTER'),
    models: resolveModels('OPENROUTER', ['deepseek/deepseek-chat']),
    apiKeys: resolveApiKeys('OPENROUTER'),
  },
  openai: {
    enabled: resolveEnabled('OPENAI'),
    models: resolveModels('OPENAI', ['gpt-4o-mini']),
    apiKeys: resolveApiKeys('OPENAI'),
  },
  claude: {
    enabled: resolveEnabled('CLAUDE'),
    models: resolveModels('CLAUDE', ['claude-sonnet-4-20250514']),
    apiKeys: resolveApiKeys('CLAUDE'),
  },
}

// ----- Service-level configurations -----

export const chat = {
  provider: process.env.CHAT_PROVIDER || 'google',
  providerOrder: (process.env.CHAT_PROVIDER_ORDER || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
}

export const vision = {
  provider: process.env.VISION_PROVIDER || 'google',
}

export const embedding = {
  provider: process.env.EMBEDDING_PROVIDER || 'gemini',
  models: (() => {
    const models = parseList('EMBEDDING_MODELS')
    if (models.length > 0) return models
    return [process.env.EMBEDDING_MODEL || 'gemini-embedding-001']
  })(),
}

export const vector = {
  store: process.env.VECTOR_STORE || 'json',
  storagePath: process.env.VECTOR_STORAGE_PATH || null,
}

export const memory = {
  provider: process.env.MEMORY_PROVIDER || 'memory',
  ttl: parseInt(process.env.MEMORY_TTL || '30', 10),
}

export const context = {
  ttl: parseInt(process.env.CONTEXT_TTL || '10', 10),
}
