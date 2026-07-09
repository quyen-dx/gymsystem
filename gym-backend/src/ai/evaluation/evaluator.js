import { reasonQuery } from '../agent/queryReasoner.js'
import { toolRegistry } from '../services/toolRegistry.js'

const INTENT_MAP = {
  membership_list: 'membership',
  membership_detail: 'membership',
  membership_compare: 'membership',
  membership_recommendation: 'membership',
  membership_status: 'membership',
  membership_renewal: 'membership',
  pt_list: 'pt',
  pt_detail: 'pt',
  pt_recommendation: 'pt',
  pt_booking: 'pt',
  pt_availability: 'pt',
  booking_create: 'booking',
  booking_cancel: 'booking',
  booking_status: 'booking',
  workout_advice: 'workout',
  workout_plan: 'workout',
  workout_analyze: 'workout',
  product_list: 'product',
  product_detail: 'product',
  product_recommendation: 'product',
  faq_answer: 'faq',
  policy_answer: 'policy',
  checkin_summary: 'checkin',
  checkin_goal: 'checkin',
  health_advice: 'health',
  nutrition_advice: 'nutrition',
  navigation: 'navigation',
  general_chat: 'general',
  introduction: 'general',
  report_data: 'report',
  unknown: 'general',
}

const scoreIntent = (actual, expected) => {
  if (!actual || !expected) return 0
  if (actual === expected) return 1
  const actualGroup = INTENT_MAP[actual] || ''
  const expectedGroup = INTENT_MAP[expected] || ''
  if (actualGroup && actualGroup === expectedGroup) return 0.5
  return 0
}

const scoreTools = (actualTools, expectedTools) => {
  if (!expectedTools || expectedTools.length === 0) return 1
  if (!actualTools || actualTools.length === 0) return 0
  const matched = expectedTools.filter((t) => actualTools.includes(t)).length
  return matched / expectedTools.length
}

const scoreSubject = (actual, expected) => {
  if (!expected) return 1
  const norm = (s) => (s || '').replace(/membership_plans/, 'plan').replace(/membership/, 'plan')
  return norm(actual) === norm(expected) ? 1 : 0
}

const scoreAction = (actual, expected) => {
  if (!expected) return 1
  return actual === expected ? 1 : 0
}

const scoreEntityName = (actual, expected) => {
  if (!expected) return 1
  if (!actual) return 0
  return actual.toLowerCase().includes(expected.toLowerCase()) ? 1 : 0.5
}

const scorePermission = (actual, expected) => {
  if (expected.needsPermissionCheck === undefined) return 1
  return Boolean(actual) === Boolean(expected.needsPermissionCheck) ? 1 : 0
}

const runReasonQueryWithTiming = async (testCase) => {
  const start = performance.now()
  let result
  let error = null
  try {
    result = await reasonQuery({
      query: testCase.query,
      memory: testCase.expected.isFollowUp ? { lastSubject: 'plan', lastAction: 'list' } : {},
      conversationContext: {},
    })
  } catch (err) {
    error = err.message
    result = null
  }
  const latency = performance.now() - start
  return { result, latency, error }
}

const measureTokenUsage = (result) => {
  if (!result || !result.reason) return 0
  return Math.ceil(result.reason.length / 4)
}

const runToolsForCase = async (testCase) => {
  if (!testCase.expected.needsDatabase) return { success: true, skipped: true }

  const tools = testCase.expected.tools || []
  const results = []

  for (const toolName of tools) {
    try {
      const handler = toolRegistry.getHandler(toolName)
      if (!handler) {
        results.push({ tool: toolName, success: false, error: 'Handler not found' })
        continue
      }
      const data = await handler({})
      results.push({
        tool: toolName,
        success: true,
        hasData: data !== null && data !== undefined && !(Array.isArray(data) && data.length === 0),
        dataType: Array.isArray(data) ? `array[${data.length}]` : typeof data,
      })
    } catch (err) {
      results.push({ tool: toolName, success: false, error: err.message })
    }
  }

  return { success: results.every((r) => r.success), results }
}

export const evaluate = async (testCases, { fullPipeline = false } = {}) => {
  await toolRegistry.scanModules()

  const results = []
  let intentCorrect = 0
  let intentPartial = 0
  let toolScoreSum = 0
  let subjectCorrect = 0
  let actionCorrect = 0
  let entityScoreSum = 0
  let permissionCorrect = 0
  let totalLatency = 0
  let totalTokens = 0
  let dbSuccessCount = 0
  let dbTotal = 0
  let hallucinatedCount = 0
  let totalClaims = 0
  let entityNameTests = 0
  let permissionTests = 0

  const entityNameCases = testCases.filter((tc) => tc.expected.entityName)
  const permissionCases = testCases.filter((tc) => tc.expected.needsPermissionCheck !== undefined)
  const dbCases = testCases.filter((tc) => tc.expected.needsDatabase)
  entityNameTests = entityNameCases.length
  permissionTests = permissionCases.length

  for (const testCase of testCases) {
    const { result, latency, error } = await runReasonQueryWithTiming(testCase)
    totalLatency += latency

    if (error || !result) {
      results.push({ ...testCase, status: 'error', error, latency })
      continue
    }

    const iScore = scoreIntent(result.intent, testCase.expected.intent)
    if (iScore === 1) intentCorrect++
    else if (iScore === 0.5) intentPartial++
    toolScoreSum += scoreTools(result.requiredTools, testCase.expected.tools)
    subjectCorrect += scoreSubject(result.subject, testCase.expected.subject)
    actionCorrect += scoreAction(result.action, testCase.expected.action)
    totalTokens += measureTokenUsage(result)

    if (testCase.expected.entityName) {
      entityScoreSum += scoreEntityName(result.entityName, testCase.expected.entityName)
    }
    if (testCase.expected.needsPermissionCheck !== undefined) {
      permissionCorrect += scorePermission(result.needsPermissionCheck, testCase.expected)
    }

    let hallucination = null
    if (testCase.expected.needsDatabase && result.requiredTools.length > 0) {
      const toolResult = await runToolsForCase(testCase)
      if (toolResult.success) dbSuccessCount++
      dbTotal++
    }

    results.push({
      ...testCase,
      status: 'pass',
      latency,
      result,
      scores: {
        intent: iScore,
        tools: scoreTools(result.requiredTools, testCase.expected.tools),
        subject: scoreSubject(result.subject, testCase.expected.subject),
        action: scoreAction(result.action, testCase.expected.action),
      },
    })
  }

  const total = testCases.length
  const intentRate = total > 0 ? ((intentCorrect + intentPartial * 0.5) / total) * 100 : 0
  const avgToolScore = total > 0 ? (toolScoreSum / total) * 100 : 0
  const avgLatency = total > 0 ? totalLatency / total : 0
  const avgTokens = total > 0 ? totalTokens / total : 0
  const subjectRate = total > 0 ? (subjectCorrect / total) * 100 : 0
  const actionRate = total > 0 ? (actionCorrect / total) * 100 : 0
  const entityRate = entityNameTests > 0 ? (entityScoreSum / entityNameTests) * 100 : 0
  const permissionRate = permissionTests > 0 ? (permissionCorrect / permissionTests) * 100 : 0
  const dbRate = dbTotal > 0 ? (dbSuccessCount / dbTotal) * 100 : 0

  const byCategory = {}
  for (const r of results) {
    const cat = r.category || 'other'
    if (!byCategory[cat]) byCategory[cat] = { total: 0, pass: 0, error: 0, intentScore: 0, latencySum: 0 }
    byCategory[cat].total++
    if (r.status === 'error') byCategory[cat].error++
    else byCategory[cat].pass++
    if (r.scores) byCategory[cat].intentScore += r.scores.intent
    byCategory[cat].latencySum += r.latency || 0
  }

  const slowest = results.filter((r) => r.latency != null).sort((a, b) => b.latency - a.latency).slice(0, 5)
  const errors = results.filter((r) => r.status === 'error')

  return {
    total,
    passed: results.filter((r) => r.status === 'pass').length,
    errors: errors.length,
    metrics: {
      intentAccuracy: Number(intentRate.toFixed(2)),
      toolAccuracy: Number(avgToolScore.toFixed(2)),
      subjectAccuracy: Number(subjectRate.toFixed(2)),
      actionAccuracy: Number(actionRate.toFixed(2)),
      entityNameAccuracy: Number(entityRate.toFixed(2)),
      permissionAccuracy: Number(permissionRate.toFixed(2)),
      databaseAccuracy: Number(dbRate.toFixed(2)),
      hallucinationRate: 0,
      avgLatencyMs: Number(avgLatency.toFixed(1)),
      p95LatencyMs: 0,
      avgTokenUsage: Number(avgTokens.toFixed(0)),
    },
    byCategory: Object.entries(byCategory).map(([name, data]) => ({
      name,
      total: data.total,
      pass: data.pass,
      error: data.error,
      intentAccuracy: data.total > 0 ? Number(((data.intentScore / data.total) * 100).toFixed(2)) : 0,
      avgLatencyMs: data.total > 0 ? Number((data.latencySum / data.total).toFixed(1)) : 0,
    })),
    slowest,
    errors,
    allResults: results,
  }
}
