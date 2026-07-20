import { GoogleGenerativeAI } from '@google/generative-ai'
import logger from '../config/logger.js'
import { AIProviderUnavailableError } from './aiErrors.js'

const createGeminiProvider = (config) => {
  const {
    apiKey,
    model = 'gemini-2.5-flash',
    maxTokens = 2048,
    temperature = 0.7,
    name = 'gemini',
  } = config

  if (!apiKey) {
    logger.warn(`Gemini provider '${name}' skipped — no API key`)
    return null
  }

  let genAI = null
  let genModel = null

  try {
    genAI = new GoogleGenerativeAI(apiKey)
    genModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    })
  } catch (error) {
    logger.error(`Failed to initialize Gemini provider '${name}'`, { error: error.message })
    return null
  }

  return {
    name,
    type: 'gemini',
    model,

    generateContent: async (prompt) => {
      if (!genModel) {
        throw new AIProviderUnavailableError(name, 'Provider not initialized')
      }
      const result = await genModel.generateContent(prompt)
      return {
        text: result.response.text(),
        model,
        provider: name,
      }
    },

    healthCheck: async () => {
      if (!genModel) {
        return { status: 'unhealthy', model, error: 'Provider not initialized' }
      }
      try {
        const start = Date.now()
        const result = await genModel.generateContent('Respond with "ok"')
        const latencyMs = Date.now() - start
        if (result.response.text().trim().toLowerCase().includes('ok')) {
          return { status: 'healthy', model, latencyMs }
        }
        return { status: 'healthy', model, latencyMs }
      } catch (error) {
        return { status: 'unhealthy', model, error: error.message }
      }
    },

    dispose: () => {
      genAI = null
      genModel = null
    },
  }
}

const FACTORIES = {
  gemini: createGeminiProvider,
}

export const createProvider = (type, config) => {
  const factory = FACTORIES[type]
  if (!factory) {
    logger.warn(`Unknown AI provider type: ${type}`)
    return null
  }
  return factory(config)
}

export const registerProviderTypes = {
  GEMINI: 'gemini',
}

export default { createProvider, registerProviderTypes }
