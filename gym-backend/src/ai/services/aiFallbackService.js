import { generateResponse as generateGeminiResponse } from './providers/geminiProvider.js'
import { generateResponse as generateOpenRouterResponse, getOpenRouterModels } from './providers/openrouterProvider.js'
import { generateResponse as generateGroqResponse, GROQ_MODELS } from './providers/groqProvider.js'
import { perfStart, perfEnd } from './perfLogger.js'
import { logFallback, logLatency, logToken, logPromptSize } from './aiLogService.js'

const DEFAULT_PROVIDER_TIMEOUT_MS = 8_000
const GEMINI_MODEL = 'gemini-2.5-flash'
const unavailableModels = new Map()

const MODEL_SKIP_TTL_MS = 60 * 60 * 1000

const withTimeout = (promise, timeoutMs, label) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  }),
])

const modelKey = (provider, model) => `${provider}:${model}`

const isModelSkipped = (provider, model) => {
  const skippedUntil = unavailableModels.get(modelKey(provider, model)) || 0
  if (skippedUntil > Date.now()) return true
  unavailableModels.delete(modelKey(provider, model))
  return false
}

const markModelUnavailable = (provider, model) => {
  unavailableModels.set(modelKey(provider, model), Date.now() + MODEL_SKIP_TTL_MS)
}

const isTransientError = (error) => {
  const message = error?.message || String(error)
  const lower = message.toLowerCase()
  if (/\b404\b/.test(message) || lower.includes('no endpoints found') || lower.includes('not found')) return 'model_unavailable'
  if (lower.includes('decommissioned') || lower.includes('no longer supported')) return 'model_unavailable'
  if (lower.includes('timed out')) return 'timeout'
  if (/\b429\b/.test(message) || lower.includes('quota') || lower.includes('rate limit')) return 'quota_or_rate_limit'
  if (lower.includes('not configured')) return 'not_configured'
  return 'failed'
}

const normalizeResult = (result, failedProviders) => ({
  text: result.text,
  provider: result.provider,
  model: result.model,
  usedFallback: failedProviders.length > 0,
  failedProviders,
})

const buildDefaultAttempts = (request, options = {}) => [
  {
    provider: 'gemini',
    model: GEMINI_MODEL,
    run: () => generateGeminiResponse({
      ...request,
      model: GEMINI_MODEL,
      temperature: options.temperature ?? 0.25,
      maxTokens: options.maxTokens || 1200,
      thinkingBudget: options.thinkingBudget,
      responseMimeType: options.responseMimeType ?? null,
    }),
  },
  ...getOpenRouterModels().map((model) => ({
    provider: 'openrouter',
    model,
    run: () => generateOpenRouterResponse({
      ...request,
      model,
      temperature: options.temperature ?? 0.4,
      maxTokens: options.maxTokens || 800,
    }),
  })),
  ...GROQ_MODELS.map((model) => ({
    provider: 'groq',
    model,
    run: () => generateGroqResponse({
      ...request,
      model,
      temperature: options.temperature ?? 0.4,
      maxTokens: options.maxTokens || 800,
    }),
  })),
]

const firstSuccess = async (entries, failedProviders) => {
  return new Promise((resolve) => {
    let settled = 0
    const total = entries.length
    if (total === 0) return resolve(null)
    for (const { promise, attempt } of entries) {
      promise.then(
        (value) => {
          resolve(value)
        },
        (err) => {
          settled++
          const status = isTransientError(err)
          if (status === 'model_unavailable') {
            markModelUnavailable(attempt.provider, attempt.model)
          }
          failedProviders.push({
            provider: attempt.provider,
            model: attempt.model,
            status,
            error: err?.message || String(err),
          })
          if (settled === total) resolve(null)
        }
      )
    }
  })
}

export async function runAIWithFallback(request, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_PROVIDER_TIMEOUT_MS
  const failedProviders = []

  const attempts = Array.isArray(options.attempts) ? options.attempts : buildDefaultAttempts(request, options)

  const activeAttempts = attempts.filter((attempt) => {
    const skipped = isModelSkipped(attempt.provider, attempt.model)
    if (skipped) {
      failedProviders.push({
        provider: attempt.provider,
        model: attempt.model,
        status: 'skipped_unavailable',
        error: 'cached unavailable',
      })
    }
    return !skipped
  })

  if (activeAttempts.length === 0) {
    const error = new Error('All AI providers failed (all skipped)')
    error.failedProviders = failedProviders
    throw error
  }

  const total = activeAttempts.length
  perfStart('ai_fallback_providers')
  const entries = activeAttempts.map((attempt, idx) => {
    const attemptStart = Date.now()
    return {
      promise: withTimeout(attempt.run(), timeoutMs, `${attempt.provider} ${attempt.model}`)
        .then((result) => {
          perfEnd('ai_fallback_providers')
          const latencyMs = Date.now() - attemptStart
          logLatency('llm_call', latencyMs, { provider: attempt.provider, model: attempt.model, attempt: idx })
          logToken(attempt.model, null, null, { estimated: true, provider: attempt.provider, textLength: (result.text || '').length })
          return { ...result, _provider: attempt.provider, _model: attempt.model }
        })
        .catch((err) => {
          logFallback(attempt.provider, err.message, { model: attempt.model, attempt: idx })
          throw err
        }),
      attempt,
    }
  })

  const winner = await firstSuccess(entries, failedProviders)
  if (winner) {
    if (failedProviders.length > 0) {
      logFallback('ai_fallback', `Succeeded with ${winner._provider || winner.provider} after ${failedProviders.length} failure(s)`, {
        provider: winner._provider || winner.provider,
        model: winner._model || winner.model,
        failures: failedProviders.map((f) => `${f.provider}/${f.model}:${f.status}`).join(', '),
      })
    }
    return normalizeResult(
      { text: winner.text, provider: winner._provider || winner.provider, model: winner._model || winner.model },
      failedProviders
    )
  }

  const error = new Error(`All ${total} AI providers failed`)
  error.failedProviders = failedProviders
  logFallback('ai_fallback', `All ${total} providers failed`, {
    failures: failedProviders.map((f) => `${f.provider}/${f.model}:${f.status}`).slice(0, 10).join(', '),
  })
  throw error
}

export const __providerFallbackTestHooks = {
  unavailableModels,
  getFallbackStatus: isTransientError,
  isModelSkipped,
}
