// dataAccuracyTest.js
// Run: node --env-file=.env src/ai/evaluation/dataAccuracyTest.js
//
// Tests that the AI guard layers (Phase 1 + Phase 2) correctly
// prevent hallucination and fact injection.

import { DATA_REQUIRED_INTENTS } from '../config/dataRequiredIntents.js'
import { __gymProAgentTestHooks } from '../agent/gymProAgent.js'
import { extractFacts, hasNewFacts } from '../services/factExtractor.js'
import { buildEmptyDataResponse } from '../services/naturalResponseBuilder.js'

const { hasRealToolData } = __gymProAgentTestHooks

let passed = 0
let failed = 0
const tests = []

const assert = (name, condition, detail = '') => {
  if (condition) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 1: DATA_REQUIRED_INTENTS
// ══════════════════════════════════════════════════════════════

console.log('\n=== TEST 1: DATA_REQUIRED_INTENTS coverage ===')

// Membership
assert('membership in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('membership'))
assert('membership_list in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('membership_list'))
assert('membership_detail in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('membership_detail'))
assert('membership_status in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('membership_status'))
assert('membership_renewal in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('membership_renewal'))

// PT
assert('pt in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('pt'))
assert('pt_list in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('pt_list'))
assert('pt_detail in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('pt_detail'))

// Check-in
assert('checkin in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('checkin'))
assert('checkin_summary in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('checkin_summary'))

// Booking
assert('booking in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('booking'))
assert('booking_info in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('booking_info'))

// Product
assert('product in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('product'))
assert('product_list in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('product_list'))

// Report
assert('report in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('report'))
assert('report_data in DATA_REQUIRED_INTENTS', DATA_REQUIRED_INTENTS.has('report_data'))

// General (should NOT be in DATA_REQUIRED_INTENTS)
assert('general NOT in DATA_REQUIRED_INTENTS', !DATA_REQUIRED_INTENTS.has('general'))
assert('general_chat NOT in DATA_REQUIRED_INTENTS', !DATA_REQUIRED_INTENTS.has('general_chat'))
assert('greeting NOT in DATA_REQUIRED_INTENTS', !DATA_REQUIRED_INTENTS.has('greeting'))
assert('navigation NOT in DATA_REQUIRED_INTENTS', !DATA_REQUIRED_INTENTS.has('navigation'))

// ══════════════════════════════════════════════════════════════
// TEST 2: hasRealToolData
// ══════════════════════════════════════════════════════════════

console.log('\n=== TEST 2: hasRealToolData accuracy ===')

// 2a. Empty plans
assert('empty plans → false',
  !hasRealToolData([{ count: 0, plans: [] }]))

// 2b. Has plans
assert('has plans → true',
  hasRealToolData([{ count: 2, plans: [{ name: 'Premium' }, { name: 'Basic' }] }]))

// 2c. No active membership
assert('no active membership → false',
  !hasRealToolData([{ hasActiveMembership: false, currentMembership: null, pendingRenewals: [], cancelRequests: [], completedMemberships: [] }]))

// 2d. Has active membership
assert('has active membership → true',
  hasRealToolData([{ hasActiveMembership: true, currentMembership: { planName: 'Premium', remainingDays: 30 } }]))

// 2e. Zero checkin stats
assert('zero checkin stats → false',
  !hasRealToolData([{ stats: { total: 0, thisMonth: 0, streak: 0 } }]))

// 2f. Has checkin stats
assert('has checkin stats → true',
  hasRealToolData([{ stats: { total: 5, thisMonth: 3, streak: 2 } }]))

// 2g. Empty PTs
assert('empty PTs → false',
  !hasRealToolData([{ count: 0, pts: [] }]))

// 2h. Has PTs
assert('has PTs → true',
  hasRealToolData([{ count: 1, pts: [{ name: 'PT A' }] }]))

// 2i. Empty bookings
assert('empty bookings → false',
  !hasRealToolData([{ count: 0, bookings: [] }]))

// 2j. Has bookings
assert('has bookings → true',
  hasRealToolData([{ count: 2, bookings: [{ date: '2026-07-10', ptName: 'PT A' }] }]))

// 2k. Error result
assert('error result → false',
  !hasRealToolData([{ error: 'timeout' }]))

// 2l. Multiple tools, only one has data
assert('one tool with data → true',
  hasRealToolData([
    { count: 0, plans: [] },
    { count: 3, pts: [{ name: 'PT A' }, { name: 'PT B' }, { name: 'PT C' }] },
    { stats: { total: 0 } },
  ]))

// 2m. Null/undefined inputs
assert('null input → false', !hasRealToolData(null))
assert('empty array → false', !hasRealToolData([]))
assert('undefined input → false', !hasRealToolData(undefined))

// ══════════════════════════════════════════════════════════════
// TEST 3: FACT LOCK (extractFacts + hasNewFacts)
// ══════════════════════════════════════════════════════════════

console.log('\n=== TEST 3: FACT LOCK ===')

// 3a. No new facts
assert('same numbers → no new facts',
  !hasNewFacts(
    extractFacts('Bạn còn 30 ngày'),
    extractFacts('Bạn chỉ còn 30 ngày thôi!')
  ))

// 3b. New plan name added
assert('new plan name → has new facts',
  hasNewFacts(
    extractFacts('Bạn chưa có gói tập'),
    extractFacts('Bạn chưa có gói tập. Gói Premium giá 500.000đ')
  ))

// 3c. New number added
assert('new number → has new facts',
  hasNewFacts(
    extractFacts('Bạn còn 30 ngày'),
    extractFacts('Bạn còn 30 ngày. Bạn cũng có 2 buổi tập')
  ))

// 3d. New PT name added
assert('new PT name → has new facts',
  hasNewFacts(
    extractFacts('Bạn chưa có PT'),
    extractFacts('Bạn chưa có PT. PT Nguyễn Văn A đang nhận học viên')
  ))

// 3e. Price added
assert('new price → has new facts',
  hasNewFacts(
    extractFacts('Có các gói tập'),
    extractFacts('Có các gói tập. Gói Premium 500.000đ')
  ))

// 3f. Date added
assert('new date → has new facts',
  hasNewFacts(
    extractFacts('Gói của bạn còn hạn'),
    extractFacts('Gói của bạn còn hạn đến 31/12/2026')
  ))

// 3g. Duration added
assert('new duration → has new facts',
  hasNewFacts(
    extractFacts('Bạn có gói Premium'),
    extractFacts('Bạn có gói Premium 12 tháng')
  ))

// 3h. No change in facts (only wording)
assert('same facts different wording → no new facts',
  !hasNewFacts(
    extractFacts('Gói Premium giá 500.000đ. Bạn còn 30 ngày. PT Nguyễn Văn A.'),
    extractFacts('Bạn còn 30 ngày với gói Premium giá 500.000đ. PT Nguyễn Văn A hướng dẫn bạn.')
  ))

// 3i. Plan name extraction doesn't include price
const planNames3i = extractFacts('Gói Premium giá 500.000đ').planNames
assert('3i: plan name without price', planNames3i.length === 1 && planNames3i[0] === 'Gói Premium')
// 3j. Empty text has no facts
assert('3j: empty text → no facts',
  !hasNewFacts(extractFacts(''), extractFacts('')))

// ══════════════════════════════════════════════════════════════
// TEST 4: buildEmptyDataResponse
// ══════════════════════════════════════════════════════════════

console.log('\n=== TEST 4: Empty data response templates ===')

const subjects = ['plan', 'workout', 'checkin', 'health', 'pt', 'booking', 'shop', 'membership', 'report', 'unknown_subject']

for (const subject of subjects) {
  const vi = buildEmptyDataResponse({ subject, lang: 'vi' })
  const en = buildEmptyDataResponse({ subject, lang: 'en' })
  assert(`VI response for ${subject}`, typeof vi === 'string' && vi.length > 10)
  assert(`EN response for ${subject}`, typeof en === 'string' && en.length > 10)
  // Must NOT contain fabricated plan/PT names
  const hasFakePlan = /Gói\s+(VIP|Premium|Pro|Basic|Cơ Bản|Nâng Cao)/.test(vi) || /Gói\s+(VIP|Premium|Pro|Basic|Cơ Bản|Nâng Cao)/.test(en)
  assert(`No fake plan names in ${subject}`, !hasFakePlan)
}

// ══════════════════════════════════════════════════════════════
// TEST 5: Simulation — AI guard chain for key scenarios
// ══════════════════════════════════════════════════════════════

console.log('\n=== TEST 5: Guard chain simulation ===')

const simulate = (scenario) => {
  const { intent, toolResult, expectedBlocked, expectedResponse } = scenario

  // Step 1: Is intent data-required?
  const isDataIntent = DATA_REQUIRED_INTENTS.has(intent)

  // Step 2: Does tool result have real data?
  const hasData = hasRealToolData([toolResult])

  // Step 3: Would data guard block?
  const wouldBlock = isDataIntent && !hasData

  // Step 4: What would the response be?
  const response = wouldBlock
    ? buildEmptyDataResponse({ subject: scenario.subject || 'plan', lang: 'vi' })
    : '(would proceed to LLM)'

  return { isDataIntent, hasData, wouldBlock, response }
}

// 5a. Membership expired
const r1 = simulate({
  intent: 'membership_status',
  subject: 'plan',
  toolResult: { hasActiveMembership: false, currentMembership: null, pendingRenewals: [], cancelRequests: [], completedMemberships: [] },
})
assert('5a: No membership → block LLM', r1.wouldBlock, `hasData=${r1.hasData}`)
assert('5a: Response says no membership', r1.response.includes('chưa tìm thấy gói') || r1.response.includes('chưa có thông tin'))

// 5b. Membership active
const r2 = simulate({
  intent: 'membership_status',
  subject: 'plan',
  toolResult: { hasActiveMembership: true, currentMembership: { planName: 'Premium', remainingDays: 30, status: 'ACTIVE' } },
})
assert('5b: Has membership → not blocked', !r2.wouldBlock)

// 5c. Checkin empty
const r3 = simulate({
  intent: 'checkin_summary',
  subject: 'checkin',
  toolResult: { stats: { total: 0, thisMonth: 0, streak: 0 } },
})
assert('5c: No checkin → block LLM', r3.wouldBlock)
assert('5c: Response mentions checkin', r3.response.includes('check-in') || r3.response.includes('điểm danh') || r3.response.includes('chưa'))

// 5d. Checkin has data
const r4 = simulate({
  intent: 'checkin_summary',
  subject: 'checkin',
  toolResult: { stats: { total: 10, thisMonth: 4, streak: 3 } },
})
assert('5d: Has checkin → not blocked', !r4.wouldBlock)

// 5e. PT empty
const r5 = simulate({
  intent: 'pt_list',
  subject: 'pt',
  toolResult: { count: 0, pts: [] },
})
assert('5e: No PTs → block LLM', r5.wouldBlock)

// 5f. Normal query (general chat → not blocked)
const r6 = simulate({
  intent: 'general_chat',
  subject: 'general',
  toolResult: null,
})
assert('5f: General chat → not blocked', !r6.wouldBlock, `isDataIntent=${r6.isDataIntent}`)

// 5g. DATA_REQUIRED_INTENTS guard blocks even when needsDatabase=false
const r7 = simulate({
  intent: 'membership_detail',
  subject: 'plan',
  toolResult: { count: 0, plans: [] },
})
assert('5g: membership_detail no plans → block LLM', r7.wouldBlock)

console.log(`\n═══════════════════════════════════════`)
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`)
console.log(`═══════════════════════════════════════`)

if (failed > 0) {
  process.exit(1)
}
