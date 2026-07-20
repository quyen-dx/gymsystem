import logger from '../config/logger.js'
import { AIProviderError } from './aiErrors.js'

const providers = new Map()
let _activeProvider = null

export const registerProvider = (name, provider) => {
  if (providers.has(name)) {
    logger.warn(`Provider '${name}' already registered — overwriting`)
  }
  providers.set(name, provider)
  if (!_activeProvider) {
    _activeProvider = name
  }
  logger.info(`AI provider registered: ${name}`)
}

export const getProvider = (name) => {
  const provider = providers.get(name)
  if (!provider) {
    return null
  }
  return provider
}

export const getActiveProvider = () => {
  if (!_activeProvider) {
    return null
  }
  return providers.get(_activeProvider) || null
}

export const getActiveProviderName = () => _activeProvider

export const setActiveProvider = (name) => {
  if (!providers.has(name)) {
    throw new AIProviderError(`Provider '${name}' not found in registry`, 400, 'AI_PROVIDER_NOT_FOUND')
  }
  _activeProvider = name
  logger.info(`Active AI provider set to: ${name}`)
}

export const listProviders = () => {
  return Array.from(providers.keys())
}

export const hasProvider = (name) => providers.has(name)

export const removeProvider = (name) => {
  const existed = providers.delete(name)
  if (_activeProvider === name) {
    const remaining = listProviders()
    _activeProvider = remaining.length > 0 ? remaining[0] : null
  }
  if (existed) {
    logger.info(`AI provider removed: ${name}`)
  }
  return existed
}

export const isReady = () => {
  return providers.size > 0 && _activeProvider !== null
}

export default {
  registerProvider,
  getProvider,
  getActiveProvider,
  getActiveProviderName,
  setActiveProvider,
  listProviders,
  hasProvider,
  removeProvider,
  isReady,
}
