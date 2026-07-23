import { contentsToMessages, functionDeclarationsToTools, toGeminiResponse, toGeminiChunk } from './openaiFormat.js'
import { providers } from '../../../config/aiConfig.js'

const BASE = 'https://openrouter.ai/api/v1'
const MODELS = providers.openrouter.models
const API_KEYS = providers.openrouter.apiKeys

let keyIdx = 0
let modelIdx = 0

function isRetryable(err) {
  const msg = err?.message || ''
  return err?.status === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota|timeout|ECONNREFUSED|5\d\d/i.test(msg)
}

function rotate() {
  keyIdx = (keyIdx + 1) % Math.max(API_KEYS.length, 1)
  if (keyIdx === 0) modelIdx++
}

export function isAvailable() {
  return API_KEYS.length > 0 && !!API_KEYS[0]
}

export async function generateContent({ contents, config }) {
  if (!isAvailable()) throw Object.assign(new Error('PROVIDER_UNAVAILABLE'), { code: 'PROVIDER_UNAVAILABLE' })

  const tools = config?.tools?.[0]?.functionDeclarations

  while (modelIdx < MODELS.length) {
    try {
      const body = {
        model: MODELS[modelIdx],
        messages: contentsToMessages(contents),
        temperature: config?.temperature ?? 0.2,
      }
      if (tools) body.tools = functionDeclarationsToTools(tools)

      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS[keyIdx]}`,
          'HTTP-Referer': 'https://gympro.vn',
          'X-Title': 'GymPro AI',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = new Error(`OpenRouter HTTP ${res.status}`)
        err.status = res.status
        throw err
      }
      const data = await res.json()
      return toGeminiResponse(data)
    } catch (err) {
      if (isRetryable(err)) {
        console.warn(`[OpenRouter] ${MODELS[modelIdx]} key ${keyIdx + 1}/${API_KEYS.length} failed, rotating...`)
        rotate()
        if (modelIdx >= MODELS.length) throw Object.assign(new Error('PROVIDER_EXHAUSTED'), { code: 'PROVIDER_EXHAUSTED' })
        continue
      }
      throw err
    }
  }
  throw Object.assign(new Error('PROVIDER_EXHAUSTED'), { code: 'PROVIDER_EXHAUSTED' })
}

export async function* generateStream({ contents, config }) {
  if (!isAvailable()) throw Object.assign(new Error('PROVIDER_UNAVAILABLE'), { code: 'PROVIDER_UNAVAILABLE' })

  const tools = config?.tools?.[0]?.functionDeclarations

  while (modelIdx < MODELS.length) {
    try {
      const body = {
        model: MODELS[modelIdx],
        messages: contentsToMessages(contents),
        temperature: config?.temperature ?? 0.2,
        stream: true,
      }
      if (tools) body.tools = functionDeclarationsToTools(tools)

      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS[keyIdx]}`,
          'HTTP-Referer': 'https://gympro.vn',
          'X-Title': 'GymPro AI',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = new Error(`OpenRouter HTTP ${res.status}`)
        err.status = res.status
        throw err
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') return
          try {
            const chunk = toGeminiChunk(JSON.parse(payload))
            if (chunk.candidates?.length) yield chunk
          } catch { /* skip */ }
        }
      }
      return
    } catch (err) {
      if (isRetryable(err)) {
        console.warn(`[OpenRouter stream] ${MODELS[modelIdx]} key ${keyIdx + 1}/${API_KEYS.length} failed, rotating...`)
        rotate()
        if (modelIdx >= MODELS.length) throw Object.assign(new Error('PROVIDER_EXHAUSTED'), { code: 'PROVIDER_EXHAUSTED' })
        continue
      }
      throw err
    }
  }
  throw Object.assign(new Error('PROVIDER_EXHAUSTED'), { code: 'PROVIDER_EXHAUSTED' })
}
