import store from './memoryStore.js'
import { memory as cfg } from '../../config/aiConfig.js'

const MAX_HISTORY = 3
const SUMMARIZE_THRESHOLD = 5

const ENTITY_PATTERNS = [
  { type: 'height', pattern: /(\d{2,3})\s*(?:cm|centimet|mét|m)\b/iu, transform: v => `${parseInt(v)}cm` },
  { type: 'weight', pattern: /(\d{2,3})\s*(?:kg|ký|kilo|kilogram)\b/iu, transform: v => `${parseInt(v)}kg` },
  { type: 'age', pattern: /(\d{1,3})\s*(?:tuổi)\b/iu, transform: v => `${parseInt(v)} tuổi` },
  { type: 'package', pattern: /\b(?:gói|package)\s+(tháng|quý|năm|premium|không\s*giới\s*hạn)/iu, transform: v => v.toLowerCase() },
]

function extractEntities(text) {
  const results = []
  for (const { type, pattern, transform } of ENTITY_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      results.push({ type, value: transform ? transform(match[1]) : match[1], confidence: 1.0 })
    }
  }
  return results
}

function mergeEntities(existing, incoming) {
  const map = new Map()
  for (const e of existing || []) {
    map.set(e.type, e)
  }
  for (const e of incoming) {
    map.set(e.type, e)
  }
  return [...map.values()]
}

function extractFirstSentence(text) {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.length <= 100) return trimmed
  const end = Math.min(trimmed.indexOf('.', 20) + 1 || 100, trimmed.indexOf('\n') || 100, 100)
  return end > 0 ? trimmed.substring(0, end).trim() : trimmed.substring(0, 100).trim()
}

function buildSummary(entities, recentQuestions) {
  const parts = []
  if (entities && entities.length > 0) {
    const list = entities.map(e => `${e.type}: ${e.value}`).join(', ')
    parts.push(`đã đề cập: ${list}`)
  }
  if (recentQuestions && recentQuestions.length > 0) {
    parts.push(`câu hỏi gần đây: "${recentQuestions[recentQuestions.length - 1]}"`)
  }
  return parts.length > 0 ? parts.join('. ') : null
}

export function loadMemory(userId) {
  const memory = store.get(userId)
  if (!memory) return null
  if (Date.now() > memory.expiresAt) {
    store.delete(userId)
    return null
  }
  return memory
}

export function updateMemory(userId, userMessage, aiResponse) {
  const existing = loadMemory(userId)
  const now = Date.now()

  const messageCount = (existing?.messageCount || 0) + 1

  const newEntities = extractEntities(userMessage)
  const mergedEntities = mergeEntities(existing?.entities, newEntities)

  const summarizedQuestion = userMessage.length > 200
    ? userMessage.substring(0, 200).trim()
    : userMessage.trim()

  let recentQuestions = existing?.recentQuestions || []
  recentQuestions = [...recentQuestions, summarizedQuestion].slice(-MAX_HISTORY)

  const lastAnswerSummary = extractFirstSentence(aiResponse)

  const needsSummarization = messageCount >= SUMMARIZE_THRESHOLD
  let conversationSummary = existing?.conversationSummary || null

  if (needsSummarization) {
    const summary = buildSummary(mergedEntities, recentQuestions)
    if (summary) conversationSummary = summary
    recentQuestions = [summarizedQuestion]
  }

  const ttlMs = cfg.ttl * 60 * 1000

  const next = {
    sessionId: userId,
    entities: mergedEntities,
    recentQuestions,
    lastAnswerSummary,
    conversationSummary,
    messageCount,
    updatedAt: now,
    expiresAt: now + ttlMs,
    createdAt: existing?.createdAt || now,
  }

  store.set(userId, next)
  return next
}

export function buildMemoryPrompt(memory) {
  if (!memory) return ''
  if (!memory.conversationSummary && !memory.entities?.length) return ''

  const lines = ['[BỐI CẢNH NGẮN GỌN]']

  if (memory.conversationSummary) {
    lines.push(memory.conversationSummary)
  } else {
    if (memory.entities?.length > 0) {
      const brief = memory.entities.map(e => `${e.type}:${e.value}`).join(', ')
      lines.push(brief)
    }
    if (memory.lastAnswerSummary) {
      lines.push(`Trả lời trước: ${memory.lastAnswerSummary}`)
    }
  }

  lines.push('[/BỐI CẢNH NGẮN GỌN]')

  return lines.join('\n')
}

export function deleteMemory(userId) {
  store.delete(userId)
}

export { store }
