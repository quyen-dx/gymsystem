import assert from 'node:assert/strict'
import test from 'node:test'

import { runAIWithFallback, __providerFallbackTestHooks } from './aiFallbackService.js'
import { GROQ_MODELS } from './providers/groqProvider.js'

const { unavailableModels, isModelSkipped } = __providerFallbackTestHooks

test('marks 404 model unavailable and falls back to next model', async () => {
  unavailableModels.clear()
  const result = await runAIWithFallback({}, {
    timeoutMs: 100,
    attempts: [
      {
        provider: 'openrouter',
        model: 'bad/free-model',
        run: async () => {
          throw new Error('404 No endpoints found for bad/free-model.')
        },
      },
      {
        provider: 'groq',
        model: 'qwen/qwen3-32b',
        run: async () => ({ text: '{"answer":"ok"}', provider: 'groq', model: 'qwen/qwen3-32b' }),
      },
    ],
  })

  assert.equal(result.provider, 'groq')
  assert.equal(result.model, 'qwen/qwen3-32b')
  assert.equal(result.failedProviders[0].status, 'model_unavailable')
  assert.equal(isModelSkipped('openrouter', 'bad/free-model'), true)
})

test('skips unavailable model without retrying it', async () => {
  let badModelCalls = 0
  unavailableModels.clear()
  unavailableModels.set('openrouter:bad/free-model', Date.now() + 60_000)

  const result = await runAIWithFallback({}, {
    timeoutMs: 100,
    attempts: [
      {
        provider: 'openrouter',
        model: 'bad/free-model',
        run: async () => {
          badModelCalls += 1
          throw new Error('should not run')
        },
      },
      {
        provider: 'groq',
        model: 'qwen/qwen3-32b',
        run: async () => ({ text: '{"answer":"ok"}', provider: 'groq', model: 'qwen/qwen3-32b' }),
      },
    ],
  })

  assert.equal(badModelCalls, 0)
  assert.equal(result.provider, 'groq')
  assert.equal(result.failedProviders[0].status, 'skipped_unavailable')
})

test('groq decommissioned model is disabled', () => {
  assert.equal(GROQ_MODELS.includes('deepseek-r1-distill-llama-70b'), false)
})
