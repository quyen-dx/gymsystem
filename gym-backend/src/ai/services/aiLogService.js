import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'

const als = new AsyncLocalStorage()

const SENSITIVE_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\b(?:0|\+84)?[3-9]\d{8,9}\b/g,
  /\b(?:sk-proj|sk-ant|sk-or|gsk_|tvly-|ghp_|gho_|github_pat)[A-Za-z0-9_-]{20,}\b/g,
  /\b[A-Za-z0-9_-]{20,}(?:[=]{0,3})\b/g,
]

const scrubPII = (value) => {
  if (!value || typeof value !== 'string') return value
  let scrubbed = value
  for (const pattern of SENSITIVE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '***')
  }
  return scrubbed
}

const scrubObject = (obj, depth = 0) => {
  if (depth > 5) return '[max depth]'
  if (typeof obj === 'string') return scrubPII(obj)
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) {
    if (obj.length > 20) return `[array(${obj.length})]`
    return obj.map((v) => scrubObject(v, depth + 1))
  }
  const scrubbed = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'embedding' && Array.isArray(value)) {
      scrubbed[key] = `[vector(${value.length})]`
      continue
    }
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key', 'jwt', 'authorization', 'phone', 'email', 'cccd', 'cmnd', 'identity']
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      scrubbed[key] = '***'
      continue
    }
    scrubbed[key] = scrubObject(value, depth + 1)
  }
  return scrubbed
}

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const LOG_LEVEL = (process.env.AI_LOG_LEVEL || 'info').toLowerCase()
const MIN_LEVEL = LOG_LEVELS[LOG_LEVEL] ?? 1

const emitLog = (level, event, data = {}) => {
  if (LOG_LEVELS[level] < MIN_LEVEL) return

  const store = als.getStore()
  const correlationId = data.correlationId || store?.correlationId || ''
  const sessionId = data.sessionId || store?.sessionId || ''
  const userId = data.userId || store?.userId || ''

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    correlationId,
    sessionId,
    userId,
    data: scrubObject(data),
  }

  const pid = process.pid
  const line = JSON.stringify(entry)
  if (level === 'error' || level === 'warn') {
    console.error(`[AI_LOG] ${pid} ${line}`)
  } else {
    console.log(`[AI_LOG] ${pid} ${line}`)
  }
}

export const startTrace = (meta = {}) => {
  const store = {
    correlationId: meta.correlationId || randomUUID(),
    sessionId: meta.sessionId || '',
    userId: meta.userId || '',
    startTime: Date.now(),
  }
  return store
}

export const runWithTrace = async (meta, fn) => {
  const store = startTrace(meta)
  return als.run(store, fn)
}

export const getCorrelationId = () => als.getStore()?.correlationId || ''

/* ---- 10 event types ---- */

export const logIntent = (intent, details = {}) => emitLog('info', 'intent', {
  intent: intent?.intent || intent,
  subject: intent?.subject || details.subject,
  action: intent?.action || details.action,
  confidence: intent?.confidence ?? details.confidence,
  source: details.source || 'unknown',
  entityName: details.entityName || intent?.entityName || '',
  isFollowUp: Boolean(intent?.isFollowUp || details.isFollowUp),
  ...details.meta,
})

export const logTool = (toolName, args = {}, result = {}) => {
  const count = Array.isArray(result)
    ? result.length
    : result && typeof result === 'object'
      ? (result.count ?? result.total ?? Object.keys(result).length)
      : 0
  emitLog('info', 'tool', {
    tool: toolName,
    args: Object.keys(args),
    records: count,
    success: !result.error,
    error: result.error ? String(result.error).slice(0, 300) : null,
  })
}

export const logToolError = (toolName, error, args = {}) => emitLog('error', 'tool', {
  tool: toolName,
  args: Object.keys(args),
  error: String(error?.message || error).slice(0, 500),
})

export const logMongoQuery = (collection, filter = {}, options = {}) => emitLog('debug', 'mongo_query', {
  collection,
  filter: Object.keys(filter),
  limit: options.limit ?? null,
  sort: options.sort ? Object.keys(options.sort) : null,
})

export const logContextBuilder = (stage, meta = {}) => emitLog('info', 'context_builder', {
  stage,
  subject: meta.subject || '',
  sectionsCount: meta.sectionsCount ?? meta.count ?? 0,
  totalChars: meta.totalChars ?? 0,
  source: meta.source || '',
  ...meta,
})

export const logPromptSize = (prompt, meta = {}) => {
  const text = typeof prompt === 'string' ? prompt : prompt?.content || ''
  const chars = text.length
  const estimatedTokens = Math.ceil(chars / 4)
  emitLog('info', 'prompt_size', {
    chars,
    estimatedTokens,
    systemLength: meta.systemLength || 0,
    contextLength: meta.contextLength || 0,
    toolCount: meta.toolCount || 0,
    charLimit: meta.charLimit || null,
  })
}

export const logToken = (model, inputTokens, outputTokens, meta = {}) => emitLog('info', 'token', {
  model,
  inputTokens: inputTokens ?? 0,
  outputTokens: outputTokens ?? 0,
  totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
  estimated: Boolean(meta.estimated),
  ...meta,
})

export const logLatency = (stage, latencyMs, meta = {}) => emitLog('info', 'latency', {
  stage,
  latencyMs: Math.round(latencyMs),
  ...meta,
})

export const logVectorSearch = (query, results = [], meta = {}) => emitLog('info', 'vector_search', {
  queryLength: (query || '').length,
  sources: Array.isArray(meta.sources) ? meta.sources : [],
  topK: meta.topK || 0,
  resultCount: results.length,
  maxScore: results.length > 0 ? Math.max(...results.map((r) => r.score ?? 0)) : 0,
  ...meta,
})

export const logValidator = (stage, result = {}) => {
  const level = result.valid === false ? 'warn' : 'info'
  emitLog(level, 'validator', {
    stage,
    valid: result.valid !== false,
    errors: Array.isArray(result.errors) ? result.errors.slice(0, 5) : [],
    retryCount: result.retryCount || 0,
    ...result,
  })
}

export const logFallback = (stage, reason, meta = {}) => emitLog('warn', 'fallback', {
  stage,
  reason: String(reason).slice(0, 500),
  provider: meta.provider || '',
  latencyMs: meta.latencyMs ?? null,
  ...meta,
})

export const logError = (stage, error, meta = {}) => emitLog('error', 'error', {
  stage,
  error: String(error?.message || error).slice(0, 500),
  ...meta,
})

/* ---- high-level pipeline logger ---- */

export const createPipelineLogger = (correlationId) => {
  const startTime = Date.now()
  return {
    correlationId,
    intent: (intent, details) => logIntent(intent, { ...details, correlationId }),
    tool: (name, args, result) => logTool(name, args, { ...result, correlationId }),
    toolError: (name, error, args) => logToolError(name, error, { ...args, correlationId }),
    mongoQuery: (collection, filter, options) => logMongoQuery(collection, filter, { ...options, correlationId }),
    contextBuilder: (stage, meta) => logContextBuilder(stage, { ...meta, correlationId }),
    promptSize: (prompt, meta) => logPromptSize(prompt, { ...meta, correlationId }),
    token: (model, input, output, meta) => logToken(model, input, output, { ...meta, correlationId }),
    latency: (stage, latencyMs, meta) => logLatency(stage, latencyMs, { ...meta, correlationId }),
    vectorSearch: (query, results, meta) => logVectorSearch(query, results, { ...meta, correlationId }),
    validator: (stage, result) => logValidator(stage, { ...result, correlationId }),
    fallback: (stage, reason, meta) => logFallback(stage, reason, { ...meta, correlationId }),
    error: (stage, error, meta) => logError(stage, error, { ...meta, correlationId }),
    elapsed: () => Date.now() - startTime,
  }
}

/* ---- backward-compatible aliases ---- */
export const aiLog = (stage, data) => emitLog('info', stage, data)
export const aiLogIntent = (intent, subject, action, confidence, reason) => logIntent({ intent, subject, action, confidence }, { source: reason })
export const aiLogTool = (toolName, args, result) => logTool(toolName, args, result)
export const aiLogToolError = (toolName, error) => logToolError(toolName, error)
export const aiLogDbQuery = (collection, filter, limit) => logMongoQuery(collection, filter, { limit })
export const aiLogPrompt = (systemPrompt, contextLength, toolCount) => logPromptSize(systemPrompt, { contextLength, toolCount })
export const aiLogResponse = (llmProvider, textLength, latencyMs, intent) => {
  emitLog('info', 'llm_response', { provider: llmProvider, textLength, latencyMs, intent })
}
export const aiLogToken = (model, inputTokens, outputTokens) => logToken(model, inputTokens, outputTokens)
