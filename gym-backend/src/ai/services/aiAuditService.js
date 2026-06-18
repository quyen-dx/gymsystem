const SOURCE_KEYS = ['tool', 'database', 'memory', 'smart_recommend', 'web_search', 'ai_reasoning', 'local_fallback']
const MAX_EVENTS = 500

const state = {
  total: 0,
  bySource: Object.fromEntries(SOURCE_KEYS.map((key) => [key, 0])),
  aiReasoningCount: 0,
  events: [],
}

export const recordAiAudit = (audit = {}) => {
  const source = SOURCE_KEYS.includes(audit.source) ? audit.source : 'local_fallback'
  state.total += 1
  state.bySource[source] += 1
  if (audit.aiUsed || source === 'ai_reasoning') state.aiReasoningCount += 1

  state.events.push({
    source,
    usedTools: audit.usedTools || [],
    aiUsed: Boolean(audit.aiUsed || source === 'ai_reasoning'),
    latencyMs: audit.latencyMs,
    reason: audit.optimizer?.reason || '',
    createdAt: new Date().toISOString(),
  })
  if (state.events.length > MAX_EVENTS) state.events.shift()
  return getAiAuditStats()
}

export const getAiAuditStats = () => {
  const percent = (count) => state.total > 0 ? Math.round((count / state.total) * 1000) / 10 : 0
  return {
    total: state.total,
    bySource: { ...state.bySource },
    percentages: Object.fromEntries(SOURCE_KEYS.map((key) => [key, percent(state.bySource[key])])),
    aiReasoningCount: state.aiReasoningCount,
    aiReasoningPercent: percent(state.aiReasoningCount),
    recentEvents: state.events.slice(-20),
  }
}

export const resetAiAuditStats = () => {
  state.total = 0
  state.aiReasoningCount = 0
  state.events = []
  SOURCE_KEYS.forEach((key) => {
    state.bySource[key] = 0
  })
}
