import { gemini as geminiConfig } from './env.js'
import { createProvider } from '../ai/providerFactory.js'
import {
  registerProvider,
  getActiveProvider,
} from '../ai/providerRegistry.js'
import logger from './logger.js'

let _configured = false
let _configError = null

const provider = createProvider('gemini', {
  apiKey: geminiConfig.apiKey,
  model: geminiConfig.model,
  maxTokens: geminiConfig.maxTokens,
  temperature: geminiConfig.temperature,
  name: 'gemini',
})

if (provider) {
  registerProvider('gemini', provider)
  _configured = true
  logger.info('AI provider configured', { model: geminiConfig.model })
} else {
  if (geminiConfig.apiKey) {
    _configError = 'Gemini provider initialization failed'
    logger.error('AI provider configuration failed', { error: _configError })
  } else {
    logger.warn('AI provider skipped — GEMINI_API_KEY not set')
  }
}

export const isConfigured = () => _configured

export const getModel = () => {
  const active = getActiveProvider()
  return active || null
}

export const getError = () => _configError

export const checkAiHealth = async () => {
  const active = getActiveProvider()

  if (!active) {
    return {
      status: _configError ? 'unhealthy' : 'skipped',
      model: geminiConfig.model,
      error: _configError || 'GEMINI_API_KEY not configured',
    }
  }

  try {
    return await active.healthCheck()
  } catch (error) {
    return {
      status: 'unhealthy',
      model: geminiConfig.model,
      error: error.message,
    }
  }
}

export default { isConfigured, getModel, getError, checkAiHealth }
