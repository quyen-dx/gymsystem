import { context as cfg } from '../../config/aiConfig.js'

const store = new Map()

function now() {
  return Date.now()
}

export function loadContext(sessionId) {
  const entry = store.get(sessionId)
  if (!entry) return null

  const ttlMs = cfg.ttl * 60 * 1000
  if (now() > entry.timestamp + ttlMs) {
    store.delete(sessionId)
    return null
  }

  return { ...entry }
}

export function updateContext(sessionId, ctx) {
  store.set(sessionId, {
    sessionId,
    lastIntent: ctx.lastIntent ?? null,
    lastTool: ctx.lastTool ?? null,
    lastSubject: ctx.lastSubject ?? null,
    lastItems: ctx.lastItems ?? null,
    lastResponseSummary: ctx.lastResponseSummary ?? null,
    lastCardType: ctx.lastCardType ?? null,
    lastRoute: ctx.lastRoute ?? null,
    timestamp: now(),
  })
}

export function clearContext(sessionId) {
  store.delete(sessionId)
}

export function expireContext() {
  const ttlMs = cfg.ttl * 60 * 1000
  const cutoff = now() - ttlMs
  for (const [id, entry] of store) {
    if (entry.timestamp < cutoff) store.delete(id)
  }
}

function extractFirstSentence(text) {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.length <= 120) return trimmed
  const cut = trimmed.indexOf('\n')
  if (cut > 0 && cut <= 120) return trimmed.substring(0, cut).trim()
  const dot = trimmed.indexOf('.', 20)
  if (dot > 0 && dot <= 120) return trimmed.substring(0, dot + 1).trim()
  return trimmed.substring(0, 120).trim()
}

export function buildContextPrompt(context) {
  if (!context) return ''

  const lines = ['[BỐI CẢNH HỘI THOẠI]']
  let hasContent = false

  if (context.lastSubject) {
    lines.push(`Chủ đề: ${context.lastSubject}`)
    hasContent = true
  }

  if (context.lastTool) {
    lines.push(`Công cụ đã dùng: ${context.lastTool}`)
    hasContent = true
  }

  if (context.lastIntent) {
    lines.push(`Ý định trước: ${context.lastIntent}`)
    hasContent = true
  }

  if (context.lastResponseSummary) {
    lines.push(`Trả lời trước: ${context.lastResponseSummary}`)
    hasContent = true
  }

  if (context.lastItems && context.lastItems.length > 0) {
    lines.push(`Đã liệt kê: ${context.lastItems.join(', ')}`)
    hasContent = true
  }

  if (context.lastCardType) {
    lines.push(`Loại thẻ đã hiển thị: ${context.lastCardType}`)
    hasContent = true
  }

  if (context.lastRoute) {
    lines.push(`Trang gợi ý: ${context.lastRoute}`)
    hasContent = true
  }

  lines.push('')

  lines.push(
    'Nếu tin nhắn tiếp theo chứa tham chiếu ngầm định (nó, cái đó, cái này, đầu tiên, thứ hai, giá bao nhiêu, mua luôn, đặt luôn, đổi sang, còn...),',
    'hãy dùng bối cảnh trên để giải thích tham chiếu đó.',
    'Chỉ hỏi lại nếu có nhiều cách hiểu hợp lý như nhau.',
  )

  lines.push('[/BỐI CẢNH HỘI THOẠI]')

  if (!hasContent) return ''
  return lines.join('\n')
}

export function inferContextFromResponse(toolName, args, result, responseText, richResponse) {
  const summary = extractFirstSentence(responseText)

  const intent = args?.intent ?? args?.query ?? toolName ?? null

  const lastSubject = (() => {
    if (toolName === 'databaseQuery') {
      const subjectMap = {
        wallet_balance: 'Ví của người dùng',
        membership_status: 'Gói tập của người dùng',
        membership_expiry: 'Gói tập của người dùng',
        upcoming_booking: 'Lịch PT của người dùng',
        unread_notifications: 'Thông báo của người dùng',
      }
      return subjectMap[args?.intent] || 'Dữ liệu người dùng'
    }
    if (toolName === 'vectorQuery') return 'Kiến thức GymPro'
    if (toolName === 'webQuery') return 'Thông tin tìm kiếm'
    return null
  })()

  const lastItems = (() => {
    if (richResponse?.cards?.length > 0) {
      return richResponse.cards
        .map(c => c?.title || c?.data?.planName || c?.data?.ptName || null)
        .filter(Boolean)
    }
    if (result?.bookings?.length > 0) {
      return result.bookings.map(b => b.ptName || b.date || null).filter(Boolean)
    }
    if (result?.documents?.length > 0) {
      return result.documents
        .map(d => d.title || d.content?.substring?.(0, 40) || null)
        .filter(Boolean)
        .slice(0, 5)
    }
    return null
  })()

  return {
    lastIntent: intent,
    lastTool: toolName,
    lastSubject,
    lastItems,
    lastResponseSummary: summary,
    lastCardType: richResponse?.cards?.[0]?.type ?? null,
    lastRoute: richResponse?.deeplinks?.[0] ?? null,
  }
}
