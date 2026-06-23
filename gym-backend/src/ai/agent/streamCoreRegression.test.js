import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { optimizeQuery } from './queryOptimizer.js'
import { reasonQuery } from './queryReasoner.js'
import { entityResolver } from './entityResolver.js'
import { resolveNavigation } from '../services/navigationResolver.js'

const controllerSource = fs.readFileSync(new URL('../../controllers/aiAssistantController.js', import.meta.url), 'utf8')
const streamBranch = controllerSource.slice(
  controllerSource.indexOf('export const aiAssistantStream'),
  controllerSource.indexOf("if (aiMode !== 'gym' && isShopeeLinkIntent", controllerSource.indexOf('export const aiAssistantStream')),
)

test('stream path uses GymPro core instead of legacy runGymAiAction directly', () => {
  assert.match(streamBranch, /runGymProAiCore\(/)
  assert.doesNotMatch(streamBranch, /runGymAiAction\(\{/)
  assert.match(streamBranch, /writeSseEvent\(res, 'start'/)
  assert.match(streamBranch, /writeSseEvent\(res, 'message'/)
  assert.match(streamBranch, /writeSseEvent\(res, 'done'/)
})

test('stream case: Premium price remains membership_detail, not recommendation or unclear', () => {
  const query = 'Gói Premium giá bao nhiêu? Đừng tư vấn gói khác, chỉ trả lời đúng gói này.'
  const optimized = optimizeQuery({ query, memory: {} })
  assert.equal(optimized.intent, 'membership_detail')
  assert.equal(optimized.directTool, 'getAvailablePlans')
  assert.notEqual(optimized.intent, 'membership_recommendation')
  assert.notEqual(optimized.intent, 'unclear_question')
})

test('stream case: Diamond Ultra VIP Plus does not fuzzy-match short VIP alias', () => {
  const plans = [
    { id: 'vip', nameVi: 'Gói VIP' },
    { id: 'advanced', nameVi: 'Gói Nâng Cao' },
  ]
  const match = entityResolver.fuzzyMatch('Diamond Ultra VIP Plus', plans, 0.72)
  assert.equal(match, null)
})

test('stream case: PT name extraction stops before detail clauses', () => {
  const query = 'PT Lê Văn A đang nhận bao nhiêu học viên? Nếu không có PT này thì đừng liệt kê PT khác.'
  const optimized = optimizeQuery({ query, memory: {} })
  assert.equal(optimized.intent, 'pt_detail')
  assert.equal(optimized.targetEntity.name, 'le van a')
})

test('stream case: compare remains membership_compare', async () => {
  const query = 'Gói VIP và Gói Nâng Cao khác nhau chỗ nào?'
  const reasoned = await reasonQuery({ query, memory: {}, language: 'vi' })
  assert.equal(reasoned.intent, 'membership_compare')
  assert.ok(reasoned.requiredTools.includes('getAvailablePlans'))
  assert.ok(!reasoned.forbiddenFallbacks.includes('membership_recommendation') || reasoned.intent !== 'membership_recommendation')
})

test('stream case: positional plan follow-up resolves from lastListedPlans by position only', () => {
  const query = 'Gói thứ 2 trong danh sách vừa rồi giá bao nhiêu?'
  const memory = {
    lastSubject: 'plan',
    lastListedPlans: [
      { id: 'basic', nameVi: 'Gói Cơ Bản', price: 100000 },
      { id: 'vip', nameVi: 'Gói VIP', price: 999999 },
    ],
  }
  const optimized = optimizeQuery({ query, memory })
  assert.equal(optimized.reason, 'memory_entity_follow_up')
  assert.equal(optimized.targetEntity.id, 'vip')
  assert.equal(optimized.directTool, 'getAvailablePlans')
})

test('stream case: active entity anaphora resolves to detail, not recommendation', () => {
  const query = 'Nó có quyền lợi gì?'
  const memory = {
    lastSubject: 'plan',
    lastListedPlans: [{ id: 'vip', nameVi: 'Gói VIP' }],
  }
  const optimized = optimizeQuery({ query, memory })
  assert.equal(optimized.action, 'detail')
  assert.equal(optimized.targetEntity.id, 'vip')
  assert.notEqual(optimized.intent, 'membership_recommendation')
})

test('stream case: booking cancellation location resolves to booking for member', async () => {
  const navigation = await resolveNavigation({
    query: 'Tôi muốn hủy lịch tập đã đặt, làm ở đâu?',
    subject: 'booking',
    action: 'navigate',
    intent: 'booking_navigation',
    userRole: 'member',
    featureFlags: { 'pt.memberBookingEnabled': true },
    logDocs: false,
  })
  assert.equal(navigation.path, '/booking')
})

test('stream case: revenue navigation is role-gated and never falls back to my-feedback', async () => {
  const memberNav = await resolveNavigation({
    query: 'Tôi muốn xem doanh thu tháng này ở đâu?',
    subject: 'report',
    action: 'find_location',
    intent: 'revenue_navigation',
    userRole: 'member',
    logDocs: false,
  })
  assert.equal(memberNav.blocked, true)
  assert.equal(memberNav.path, '')
  assert.notEqual(memberNav.path, '/my-feedback')

  const adminNav = await resolveNavigation({
    query: 'Tôi muốn xem doanh thu tháng này ở đâu?',
    subject: 'report',
    action: 'find_location',
    intent: 'revenue_navigation',
    userRole: 'super_admin',
    logDocs: false,
  })
  assert.equal(adminNav.path, '/admin/reports')

  const sellerNav = await resolveNavigation({
    query: 'Tôi muốn xem doanh thu shop tháng này ở đâu?',
    subject: 'report',
    action: 'find_location',
    intent: 'revenue_navigation',
    userRole: 'seller',
    logDocs: false,
  })
  assert.equal(sellerNav.path, '/seller/revenue')
})
