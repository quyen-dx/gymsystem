import mongoose from 'mongoose'
import { validateResponse, buildFallbackAnswer } from '../../src/ai/services/responseValidator.js'
import { renderPlans, renderPTs, renderMembership } from '../../src/ai/services/contextBuilder.js'

/* ============================================================
   Phase 4 — Validator Tests
   Inject intentionally wrong LLM outputs — validator must reject.
   ============================================================ */

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://daoxuanquyen333_db_user:Ffz9I2eUIlvydGkt@gym-cluster.fhqkyis.mongodb.net/gym'

let passed = 0; let total = 0
function test(name, result, expected) {
  total++
  const ok = result === expected
  if (ok) { passed++; console.log(`  PASS  ${name}`) }
  else { console.log(`  FAIL  ${name}: expected valid=${expected}, got valid=${!expected}, reason=${result.reason}`) }
}

/* ---- Test fixtures ---- */

const samplePlans = [
  { _id: 'p1', nameVi: 'Gói Cơ Bản', nameEn: 'Basic', price: 80000, durationDays: 30 },
  { _id: 'p2', nameVi: 'Gói Premium', nameEn: 'Premium', price: 100000, durationDays: 30 },
  { _id: 'p3', nameVi: 'Gói VIP', nameEn: 'VIP', price: 200000, durationDays: 365 },
  { _id: 'p4', nameVi: 'Gói Personal Training', nameEn: 'Personal Training', price: 2000000, durationDays: 30 },
  { _id: 'p5', nameVi: 'Gói Corporate', nameEn: 'Corporate', price: 5000000, durationDays: 365 },
]

const samplePTs = [
  { _id: 'pt1', fullName: 'Nguyễn Văn A', specialization: 'Giảm cân', rating: 4.5 },
  { _id: 'pt2', fullName: 'Trần Thị B', specialization: 'Yoga', rating: 4.8 },
  { _id: 'pt3', fullName: 'Lê Văn C', specialization: 'Tăng cơ', rating: 4.2 },
  { _id: 'pt4', fullName: 'Phạm Thị D', specialization: 'Cardio', rating: 4.6 },
  { _id: 'pt5', fullName: 'Hoàng Văn E', specialization: 'Crossfit', rating: 4.9 },
]

const sampleMembershipFound = {
  found: true,
  status: 'active',
  planName: 'Gói Premium',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-02-01'),
  remainingDays: 20,
}

const sampleMembershipNotFound = {
  found: false,
}

/* ---- Test cases ---- */

function runTests() {
  console.log('\n=== VALIDATOR: Plan count mismatch ===')

  // Case: 5 plans in tool results, LLM says 3
  let r = validateResponse({
    answer: 'Gym có 3 gói tập chính là Basic, Premium và VIP',
    toolResults: { getAvailablePlans: { plans: samplePlans } },
    lang: 'vi',
  })
  test('5 plans → LLM says 3 (REJECT)', r.valid, false)

  // Case: 5 plans, LLM says 5
  r = validateResponse({
    answer: 'Gym có 5 gói tập: Cơ Bản, Premium, VIP, Personal Training và Corporate',
    toolResults: { getAvailablePlans: { plans: samplePlans } },
    lang: 'vi',
  })
  test('5 plans → LLM says 5 (ACCEPT)', r.valid, true)

  // Case: 5 plans, LLM mentions correct names
  r = validateResponse({
    answer: 'Gym có các gói: Cơ Bản, Premium, VIP, Personal Training và Corporate với nhiều mức giá khác nhau',
    toolResults: { getAvailablePlans: { plans: samplePlans } },
    lang: 'vi',
  })
  test('5 plans → all names mentioned (ACCEPT)', r.valid, true)

  // Case: 5 plans, LLM mentions only 2 names
  r = validateResponse({
    answer: 'Gym có nhiều gói tập như Basic và Premium',
    toolResults: { getAvailablePlans: { plans: samplePlans } },
    lang: 'vi',
  })
  test('5 plans → only 2 names (ACCEPT — count matches)', r.valid, true)

  console.log('\n=== VALIDATOR: PT count mismatch ===')

  // Case: 5 PTs, LLM says 4
  r = validateResponse({
    answer: 'Có 4 PT trong gym: A, B, C và D',
    toolResults: { getAvailablePTs: { pts: samplePTs } },
    lang: 'vi',
  })
  test('5 PTs → LLM says 4 (REJECT)', r.valid, false)

  // Case: 5 PTs, LLM says 5
  r = validateResponse({
    answer: 'Có 5 huấn luyện viên: Nguyễn Văn A, Trần Thị B, Lê Văn C, Phạm Thị D và Hoàng Văn E',
    toolResults: { getAvailablePTs: { pts: samplePTs } },
    lang: 'vi',
  })
  test('5 PTs → LLM says 5 (ACCEPT)', r.valid, true)

  console.log('\n=== VALIDATOR: PT name mismatch ===')

  // Case: Fake name not in tool results
  // Validator checks for missing names, not extra names (hallucination check is Phase 3)
  r = validateResponse({
    answer: 'Các PT gồm Nguyễn Văn A, Trần Thị B và Nguyễn Văn Fake',
    toolResults: { getAvailablePTs: { pts: samplePTs } },
    lang: 'vi',
  })
  test('Fake PT name → ACCEPT (validator only checks dropping, not hallucination)', r.valid, true)

  // Case: Only 3/5 PT names mentioned — at least one name found, so accept
  r = validateResponse({
    answer: 'Các PT gồm Nguyễn Văn A, Trần Thị B, Lê Văn C',
    toolResults: { getAvailablePTs: { pts: samplePTs } },
    lang: 'vi',
  })
  test('5 PTs → only 3 names (ACCEPT — at least one found)', r.valid, true)

  console.log('\n=== VALIDATOR: Membership status mismatch ===')

  // Case: DB says active, LLM doesn't mention active
  // Should reject — LLM ignored real membership data
  r = validateResponse({
    answer: 'Cảm ơn bạn đã quan tâm đến phòng gym',
    toolResults: { getMembershipInfo: sampleMembershipFound },
    lang: 'vi',
  })
  test('Membership active → answer not mentioning it (REJECT)', r.valid, false)

  // Case: DB says no membership, LLM talks about it
  r = validateResponse({
    answer: 'Thẻ tập của bạn đang hoạt động tốt',
    toolResults: { getMembershipInfo: sampleMembershipNotFound },
    lang: 'vi',
  })
  test('No membership → LLM says active (REJECT)', r.valid, false)

  // Case: No membership, LLM says không có
  r = validateResponse({
    answer: 'Bạn chưa có gói tập nào, vui lòng đăng ký',
    toolResults: { getMembershipInfo: sampleMembershipNotFound },
    lang: 'vi',
  })
  test('No membership → LLM says chưa có (ACCEPT)', r.valid, true)

  console.log('\n=== VALIDATOR: Booking count mismatch ===')

  r = validateResponse({
    answer: 'Bạn có 1 buổi tập vào ngày mai',
    toolResults: { getUpcomingBookings: { bookings: [{ _id: 'b1' }, { _id: 'b2' }, { _id: 'b3' }] } },
    lang: 'vi',
  })
  test('3 bookings → LLM says 1 (REJECT)', r.valid, false)

  r = validateResponse({
    answer: 'Bạn có 3 buổi tập sắp tới',
    toolResults: { getUpcomingBookings: { bookings: [{ _id: 'b1' }, { _id: 'b2' }, { _id: 'b3' }] } },
    lang: 'vi',
  })
  test('3 bookings → LLM says 3 (ACCEPT)', r.valid, true)

  console.log('\n=== FALLBACK BUILDER ===')

  const fb = buildFallbackAnswer({
    toolResults: { getAvailablePlans: { plans: samplePlans.slice(0, 2) } },
    lang: 'vi',
  })
  test('Fallback builds non-empty answer', fb.length > 0, true)
  test('Fallback contains plan names', fb.includes('Cơ Bản') || fb.includes('Basic') || fb.includes('Premium'), true)

  console.log('\n=== EDGE CASES ===')

  // Empty answer
  r = validateResponse({ answer: '', toolResults: {} })
  test('Empty answer (REJECT)', r.valid, false)

  // null answer
  r = validateResponse({ answer: null, toolResults: {} })
  test('Null answer (REJECT)', r.valid, false)

  // No tool results
  r = validateResponse({ answer: 'Xin chào', toolResults: {} })
  test('No tool results → passes through', r.valid, true)

  // Non-numeric answer
  r = validateResponse({
    answer: 'Cảm ơn bạn đã hỏi. Gym có nhiều PT giỏi.',
    toolResults: { getAvailablePTs: { pts: samplePTs } },
  })
  test('No count numbers in answer (ACCEPT)', r.valid, true)
}

async function main() {
  console.log('='.repeat(60))
  console.log('PHASE 4 — Validator Tests')
  console.log('='.repeat(60))

  runTests()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`RESULTS: ${passed}/${total} passed`)
  console.log()

  process.exit(passed < total ? 1 : 0)
}

main()
