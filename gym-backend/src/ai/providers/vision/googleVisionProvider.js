import { GoogleGenAI } from '@google/genai'
import { providers } from '../../../config/aiConfig.js'

const MODELS = providers.google.models
const API_KEYS = providers.google.apiKeys

let keyIdx = 0
let modelIdx = 0

function isRateLimited(err) {
  const msg = err?.message || ''
  return err?.status === 429 || err?.code === 429 || /RESOURCE_EXHAUSTED|quota|rate.?\s*limit/i.test(msg)
}

function makeClient() {
  const key = API_KEYS[keyIdx]
  if (!key) return null
  return new GoogleGenAI({ apiKey: key })
}

function rotate() {
  keyIdx++
  if (keyIdx >= API_KEYS.length) {
    keyIdx = 0
    modelIdx++
  }
}

export function isVisionAvailable() {
  return API_KEYS.length > 0 && !!API_KEYS[keyIdx]
}

export async function analyzeImage({ imageData, mimeType, prompt }) {
  const contents = [{
    role: 'user',
    parts: [{ text: prompt }, { inlineData: { mimeType, data: imageData } }],
  }]

  while (modelIdx < MODELS.length) {
    const client = makeClient()
    if (!client) { rotate(); continue }
    try {
      return await client.models.generateContent({
        model: MODELS[modelIdx],
        contents,
        config: { temperature: 0.2 },
      })
    } catch (err) {
      if (isRateLimited(err)) {
        console.warn(`[AI vision] ${MODELS[modelIdx]} key ${keyIdx + 1}/${API_KEYS.length} rate-limited, rotating...`)
        rotate()
        continue
      }
      throw err
    }
  }
  throw Object.assign(new Error('PROVIDER_EXHAUSTED'), { code: 'PROVIDER_EXHAUSTED' })
}
