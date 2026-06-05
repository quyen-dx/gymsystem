import { generateResponse as generateGeminiResponse } from './providers/geminiProvider.js'
import { generateResponse as generateOpenRouterResponse, getOpenRouterModels } from './providers/openrouterProvider.js'
import { generateResponse as generateGroqResponse, GROQ_MODELS } from './providers/groqProvider.js'

const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000
const GEMINI_MODEL = 'gemini-2.5-flash'
const unavailableModels = new Map()

const MODEL_SKIP_TTL_MS = 60 * 60 * 1000

const withTimeout = (promise, timeoutMs, label) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  }),
])

const logTry = (provider, model) => {
  console.log('[AI] Provider:', provider)
  console.log('[AI] Model:', model)
}

const logSuccess = () => console.log('[AI] Success')
const logFailed = (error) => console.log('[AI] Failed:', error?.message || String(error))

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

const getFallbackStatus = (error) => {
  const message = error?.message || String(error)
  const lower = message.toLowerCase()
  if (/\b404\b/.test(message) || lower.includes('no endpoints found') || lower.includes('not found')) return 'model_unavailable'
  if (lower.includes('decommissioned') || lower.includes('no longer supported')) return 'model_unavailable'
  if (lower.includes('timed out')) return 'timeout'
  if (/\b429\b/.test(message) || lower.includes('quota') || lower.includes('rate limit')) return 'quota_or_rate_limit'
  if (lower.includes('not configured')) return 'not_configured'
  return 'failed'
}

const logProviderFallback = ({ provider, model, status, reason }) => {
  console.log('[PROVIDER_FALLBACK]', {
    provider,
    model,
    status,
    reason: String(reason || '').slice(0, 240),
  })
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

export async function runAIWithFallback(request, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_PROVIDER_TIMEOUT_MS
  const failedProviders = []

  const attempts = Array.isArray(options.attempts) ? options.attempts : buildDefaultAttempts(request, options)

  for (const attempt of attempts) {
    if (isModelSkipped(attempt.provider, attempt.model)) {
      const reason = 'model unavailable in runtime skip cache'
      logProviderFallback({
        provider: attempt.provider,
        model: attempt.model,
        status: 'skipped_unavailable',
        reason,
      })
      failedProviders.push({
        provider: attempt.provider,
        model: attempt.model,
        status: 'skipped_unavailable',
        error: reason,
      })
      continue
    }

    logTry(attempt.provider, attempt.model)
    try {
      const result = await withTimeout(
        attempt.run(),
        timeoutMs,
        `${attempt.provider} ${attempt.model}`,
      )
      logSuccess()
      console.log('[AI] final source:', result.provider, result.model)
      return normalizeResult(result, failedProviders)
    } catch (error) {
      const status = getFallbackStatus(error)
      const reason = error?.message || String(error)
      logFailed(error)
      logProviderFallback({
        provider: attempt.provider,
        model: attempt.model,
        status,
        reason,
      })
      if (status === 'model_unavailable') {
        markModelUnavailable(attempt.provider, attempt.model)
      }
      failedProviders.push({
        provider: attempt.provider,
        model: attempt.model,
        status,
        error: reason,
      })
    }
  }

  console.log('[AI] final source:', 'rule_based', 'local')
  const error = new Error('All AI providers failed')
  error.failedProviders = failedProviders
  throw error
}

export const __providerFallbackTestHooks = {
  unavailableModels,
  getFallbackStatus,
  isModelSkipped,
}
