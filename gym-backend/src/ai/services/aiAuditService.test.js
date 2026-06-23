import assert from 'node:assert/strict'
import test from 'node:test'
import { getAiAuditStats, recordAiAudit, resetAiAuditStats } from './aiAuditService.js'

test('aiAuditService records source percentages and AI usage', () => {
  resetAiAuditStats()
  recordAiAudit({ source: 'tool', aiUsed: false, usedTools: ['getAvailablePlans'] })
  recordAiAudit({ source: 'ai_reasoning', aiUsed: true, usedTools: ['getSmartRecommendations'] })

  const stats = getAiAuditStats()

  assert.equal(stats.total, 2)
  assert.equal(stats.bySource.tool, 1)
  assert.equal(stats.bySource.ai_reasoning, 1)
  assert.equal(stats.aiReasoningCount, 1)
  assert.equal(stats.aiReasoningPercent, 50)
})
