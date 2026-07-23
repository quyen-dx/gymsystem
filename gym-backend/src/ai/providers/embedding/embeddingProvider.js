import { embedding as cfg } from '../../../config/aiConfig.js'

const EMBEDDING_PROVIDER = cfg.provider

let provider

switch (EMBEDDING_PROVIDER) {
  case 'gemini':
    provider = await import('./geminiEmbeddingProvider.js')
    break
  default:
    throw new Error(`Unknown EMBEDDING_PROVIDER: ${EMBEDDING_PROVIDER}. Supported: gemini`)
}

export const embed = provider.embed
