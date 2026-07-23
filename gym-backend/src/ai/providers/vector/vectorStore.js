import { embed } from '../embedding/embeddingProvider.js'
import { vector as cfg } from '../../../config/aiConfig.js'

const VECTOR_STORE = cfg.store

let provider

switch (VECTOR_STORE) {
  case 'json':
    provider = await import('./jsonVectorStore.js')
    break
  default:
    throw new Error(`Unknown VECTOR_STORE: ${VECTOR_STORE}. Supported: json`)
}

export async function searchKnowledge(query, options) {
  const queryEmbedding = await embed(query)
  return provider.search(queryEmbedding, options)
}

export async function isVectorAvailable() {
  return provider.isAvailable()
}
