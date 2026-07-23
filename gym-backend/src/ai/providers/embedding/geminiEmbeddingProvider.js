import { GoogleGenAI } from '@google/genai'
import { providers, embedding as embCfg } from '../../../config/aiConfig.js'

const MODELS = embCfg.models
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

export async function embed(text) {
  while (modelIdx < MODELS.length) {
    const client = makeClient()
    if (!client) { rotate(); continue }
    try {
      const result = await client.models.embedContent({
        model: MODELS[modelIdx],
        contents: text,
      })
      return result.embeddings?.[0]?.values || []
    } catch (err) {
      if (isRateLimited(err)) {
        console.warn(`[AI embed] ${MODELS[modelIdx]} key ${keyIdx + 1}/${API_KEYS.length} rate-limited, rotating...`)
        rotate()
        continue
      }
      throw err
    }
  }
  throw Object.assign(new Error('PROVIDER_EXHAUSTED'), { code: 'PROVIDER_EXHAUSTED' })
}
