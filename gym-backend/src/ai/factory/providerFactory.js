import { chat as chatCfg, vision as visionCfg, embedding as embCfg, vector as vecCfg, providers } from '../../config/aiConfig.js'

export function getProviderConfig() {
  return {
    chat: chatCfg.provider,
    chatModel: providers[chatCfg.provider]?.models?.[0] || null,
    chatProviderOrder: chatCfg.providerOrder,
    vision: visionCfg.provider,
    visionModel: providers[visionCfg.provider]?.models?.[0] || null,
    embedding: embCfg.provider,
    embeddingModel: embCfg.models?.[0] || null,
    vectorStore: vecCfg.store,
  }
}

export function isProvider(name) {
  return process.env[name] || false
}

export function isProviderType(type, name) {
  const key = type.toUpperCase() + '_PROVIDER'
  return (process.env[key] || '') === name
}

export function getMemoryStore() {
  return import('../memory/memoryStore.js').then(m => m.default)
}
