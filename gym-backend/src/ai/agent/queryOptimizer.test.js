import assert from 'node:assert/strict'
import test from 'node:test'
import { optimizeQuery } from './queryOptimizer.js'

test('queryOptimizer routes simple plan count to direct tool', () => {
  const result = optimizeQuery({ query: 'có bao nhiêu gói tập', memory: {} })

  assert.equal(result.shouldUseAI, false)
  assert.equal(result.directTool, 'getAvailablePlans')
  assert.equal(result.subject, 'plan')
  assert.equal(result.action, 'count')
  assert.equal(result.reason, 'membership_database_query')
})

test('queryOptimizer routes cheapest and most expensive plan to direct tool', () => {
  const cheapest = optimizeQuery({ query: 'gói nào rẻ nhất', memory: {} })
  const expensive = optimizeQuery({ query: 'gói nào đắt nhất', memory: {} })

  assert.equal(cheapest.shouldUseAI, false)
  assert.equal(cheapest.directTool, 'getAvailablePlans')
  assert.equal(expensive.shouldUseAI, false)
  assert.equal(expensive.directTool, 'getAvailablePlans')
})

test('queryOptimizer routes PT count and top rating to direct tool', () => {
  const count = optimizeQuery({ query: 'có bao nhiêu PT', memory: {} })
  const top = optimizeQuery({ query: 'PT nào rating cao nhất', memory: {} })

  assert.equal(count.shouldUseAI, false)
  assert.equal(count.directTool, 'getAvailablePTs')
  assert.equal(top.shouldUseAI, false)
  assert.equal(top.directTool, 'getAvailablePTs')
})

test('queryOptimizer passes PT name to direct detail tool', () => {
  const result = optimizeQuery({ query: 'chi tiết PT cgpt 1', memory: {} })

  assert.equal(result.shouldUseAI, false)
  assert.equal(result.directTool, 'getAvailablePTs')
  assert.equal(result.action, 'detail')
  assert.equal(result.args.specialization, 'cgpt 1')
})

test('queryOptimizer keeps personalized recommendation for reasoning', () => {
  const result = optimizeQuery({ query: 'tôi muốn giảm cân với ngân sách 500k', memory: {} })

  assert.equal(result.shouldUseAI, false)
  assert.equal(result.directTool, null)
  assert.equal(result.intent, 'fitness_goal_selection')
  assert.equal(result.subject, 'goal')
})

test('queryOptimizer resolves memory follow-up by entity id', () => {
  const result = optimizeQuery({
    query: 'người thứ 2',
    memory: {
      lastSubject: 'pt',
      lastListedPTs: [
        { id: 'pt1', name: 'Coach A' },
        { id: 'pt2', name: 'Coach B' },
      ],
    },
  })

  assert.equal(result.shouldUseAI, false)
  assert.equal(result.directTool, 'getAvailablePTs')
  assert.equal(result.reason, 'memory_entity_follow_up')
  assert.equal(result.targetEntity.id, 'pt2')
})

test('queryOptimizer routes support/navigation questions to FAQ search', () => {
  const password = optimizeQuery({ query: 'đổi mật khẩu ở đâu', memory: {} })
  const forgot = optimizeQuery({ query: 'tôi quên mật khẩu phải làm sao', memory: {} })
  const profile = optimizeQuery({ query: 'tôi có thể thay đổi thông tin cá nhân không', memory: {} })
  const paymentHistory = optimizeQuery({ query: 'xem lịch sử thanh toán ở đâu', memory: {} })

  assert.equal(password.shouldUseAI, false)
  assert.equal(password.directTool, null)
  assert.equal(password.subject, 'account')
  assert.equal(password.intent, 'account_security')
  assert.equal(forgot.directTool, null)
  assert.equal(forgot.intent, 'auth_forgot_password')
  assert.equal(profile.directTool, null)
  assert.equal(profile.intent, 'profile_update')
  assert.equal(paymentHistory.directTool, 'searchFaqs')
})

test('queryOptimizer routes checkin data queries to AI reasoner', () => {
  const count = optimizeQuery({ query: 'tôi đã checkin bao nhiêu lần tháng này', memory: {} })
  const history = optimizeQuery({ query: 'lịch sử checkin của tôi', memory: {} })
  const streak = optimizeQuery({ query: 'chuỗi điểm danh hiện tại của tôi', memory: {} })

  assert.equal(count.shouldUseAI, true)
  assert.equal(history.shouldUseAI, true)
  assert.equal(streak.shouldUseAI, true)
})

test('queryOptimizer routes checkin navigation to FAQ search', () => {
  const nav = optimizeQuery({ query: 'điểm danh ở đâu', memory: {} })

  assert.equal(nav.shouldUseAI, false)
  assert.equal(nav.directTool, 'searchFaqs')
  assert.equal(nav.subject, 'checkin')
  assert.equal(nav.intent, 'checkin_navigation')
})

test('queryOptimizer routes policy questions to policy search', () => {
  const refund = optimizeQuery({ query: 'hoàn tiền như nào', memory: {} })
  const privacy = optimizeQuery({ query: 'chính sách bảo mật', memory: {} })

  assert.equal(refund.shouldUseAI, false)
  assert.equal(refund.directTool, 'searchPolicies')
  assert.equal(privacy.shouldUseAI, false)
  assert.equal(privacy.directTool, 'searchPolicies')
})
