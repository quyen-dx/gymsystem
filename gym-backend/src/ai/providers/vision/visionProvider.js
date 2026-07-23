import { vision as cfg } from '../../../config/aiConfig.js'

const VISION_PROVIDER = cfg.provider

let provider

switch (VISION_PROVIDER) {
  case 'google':
    provider = await import('./googleVisionProvider.js')
    break
  default:
    throw new Error(`Unknown VISION_PROVIDER: ${VISION_PROVIDER}. Supported: google`)
}

export const analyzeImage = provider.analyzeImage
export const isVisionAvailable = provider.isVisionAvailable
