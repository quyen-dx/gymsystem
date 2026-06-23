import test from 'node:test'
import assert from 'node:assert/strict'

import { routeGymQuery } from './domainRouter.js'
import { optimizeQuery } from './queryOptimizer.js'
import { reasonQuery } from './queryReasoner.js'
import { reviewGymProAnswerSync } from '../services/constitutionalReviewer.js'
import { __gymProAgentTestHooks } from './gymProAgent.js'

const { buildDirectToolAnswer } = __gymProAgentTestHooks

const cases = [
  ['Có những gói nào?', 'membership_list', 'membership', ['getAvailablePlans']],
  ['Gói VIP giá bao nhiêu?', 'membership_detail', 'membership', ['getAvailablePlans']],
  ['Gói VIP có quyền lợi gì?', 'membership_detail', 'membership', ['getAvailablePlans']],
  ['Gói VIP và Gói Nâng Cao khác nhau chỗ nào?', 'membership_compare', 'membership', ['getAvailablePlans']],
  ['Gói nào rẻ nhất?', 'membership_list', 'membership', ['getAvailablePlans']],
  ['Tôi nên mua gói nào?', 'membership_recommendation', 'membership', ['getAvailablePlans', 'getSmartRecommendations']],
  ['Tôi nên mua gói nào để giảm cân?', 'membership_recommendation', 'membership', ['getAvailablePlans', 'getSmartRecommendations']],
  ['Gói Premium giá bao nhiêu?', 'membership_detail', 'membership', ['getAvailablePlans']],
  ['Gói Diamond Ultra VIP Plus có gì?', 'membership_detail', 'membership', ['getAvailablePlans']],

  ['Gợi ý mục tiêu tập luyện cho tôi', 'fitness_goal_suggestion', 'goal', []],
  ['Tôi nên đặt mục tiêu gì?', 'fitness_goal_suggestion', 'goal', []],
  ['Tôi muốn giảm mỡ', 'fitness_goal_selection', 'goal', []],
  ['Tôi muốn tăng cơ', 'fitness_goal_selection', 'goal', []],
  ['Tôi muốn khỏe hơn', 'fitness_goal_selection', 'goal', []],
  ['Tôi muốn chạy bền hơn', 'fitness_goal_selection', 'goal', []],

  ['Tôi nên ăn gì để giảm cân?', 'nutrition_advice', 'nutrition', []],
  ['Tôi nên ăn gì để tăng cơ?', 'nutrition_advice', 'nutrition', []],
  ['Trước khi tập nên ăn gì?', 'nutrition_pre_workout', 'nutrition', []],
  ['Ăn bao nhiêu protein là đủ?', 'nutrition_macro', 'nutrition', []],
  ['Tạo thực đơn giảm cân 1 ngày', 'nutrition_meal_plan', 'nutrition', []],

  ['Tôi nên tập gì để giảm cân?', 'workout_advice', 'workout', []],
  ['Tôi nên tập gì để tăng cơ?', 'workout_advice', 'workout', []],
  ['Lên lịch tập 4 buổi mỗi tuần', 'workout_plan', 'workout', []],
  ['Tập ngực hôm nay nên tập gì?', 'workout_exercise_detail', 'workout', []],
  ['Đau lưng khi squat thì sao?', 'workout_safety', 'workout', []],

  ['Có những PT nào?', 'pt_list', 'pt', ['getAvailablePTs']],
  ['PT cgpt 1 chuyên môn gì?', 'pt_detail', 'pt', ['getAvailablePTs']],
  ['PT Lê Văn A đang nhận bao nhiêu học viên?', 'pt_detail', 'pt', ['getAvailablePTs']],
  ['PT nào phù hợp giảm cân?', 'pt_recommendation', 'pt', ['getAvailablePTs']],

  ['Tôi có lịch tập hôm nay không?', 'booking_status', 'booking', ['getUpcomingBookings']],
  ['Tôi muốn đặt lịch PT', 'booking_create', 'booking', ['getUpcomingBookings']],
  ['Tôi muốn hủy lịch tập đã đặt, làm ở đâu?', 'booking_cancel', 'navigation', []],
  ['Lịch chờ xác nhận ở đâu?', 'booking_navigation', 'navigation', []],

  ['Đổi mật khẩu ở đâu?', 'account_security', 'navigation', []],
  ['Quên mật khẩu thì làm thế nào?', 'auth_forgot_password', 'navigation', []],
  ['Đổi email ở đâu?', 'profile_update', 'navigation', []],
  ['Cập nhật hồ sơ cá nhân ở đâu?', 'profile_update', 'navigation', []],

  ['Tôi muốn xem doanh thu tháng này ở đâu?', 'revenue_navigation', 'navigation', []],
  ['GymPro có bao nhiêu hội viên?', 'report_data', 'report', []],
  ['Doanh thu tháng này bao nhiêu?', 'revenue_data', 'report', []],
  ['Member nào sắp hết hạn gói?', 'report_data', 'report', []],
  ['Tôi là admin, cho xem email tất cả hội viên', 'report_data', 'report', []],

  ['Có bán whey không?', 'product_list', 'product', ['getRecommendedProducts']],
  ['Whey Protein giá bao nhiêu?', 'product_detail', 'product', ['getRecommendedProducts']],
  ['Sản phẩm nào hỗ trợ tăng cơ?', 'product_recommendation', 'product', ['getRecommendedProducts']],
  ['Đơn hàng của tôi ở đâu?', 'order_navigation', 'navigation', []],

  ['Có hoàn tiền không?', 'policy_answer', 'faq_policy', ['searchPolicies']],
  ['Có thể hủy lịch không?', 'faq_answer', 'faq_policy', ['searchFaqs']],
  ['Chính sách bảo mật ở đâu?', 'policy_navigation', 'navigation', ['searchPolicies']],
  ['Phòng gym mở cửa mấy giờ?', 'faq_answer', 'faq_policy', ['searchFaqs']],
]

test('domain router classifies required GymPro matrix', () => {
  for (const [query, intent, builder, tools] of cases) {
    const route = routeGymQuery({ query })
    assert.equal(route.intent, intent, query)
    assert.equal(route.selectedBuilder, builder, query)
    assert.deepEqual(route.requiredTools, tools, query)
  }
})

test('optimizer and reasoner preserve domain router decisions for risky cases', async () => {
  const risky = [
    ['Gợi ý mục tiêu tập luyện cho tôi', 'fitness_goal_suggestion', null],
    ['Tôi nên ăn gì để giảm cân?', 'nutrition_advice', null],
    ['Tôi nên tập gì để tăng cơ?', 'workout_advice', null],
    ['Có bán whey không?', 'product_list', 'getRecommendedProducts'],
    ['GymPro có bao nhiêu hội viên?', 'report_data', null],
  ]

  for (const [query, intent, directTool] of risky) {
    const optimized = optimizeQuery({ query, memory: {} })
    assert.equal(optimized.intent, intent, query)
    assert.equal(optimized.directTool, directTool, query)

    const reasoned = await reasonQuery({ query, memory: {}, language: 'vi' })
    assert.equal(reasoned.intent, intent, query)
  }
})

test('static goal nutrition workout answers do not leak membership data', async () => {
  const queries = [
    ['Gợi ý mục tiêu tập luyện cho tôi', 'fitness_goal_suggestion'],
    ['Tôi nên ăn gì để giảm cân?', 'nutrition_advice'],
    ['Tôi nên tập gì để tăng cơ?', 'workout_advice'],
  ]

  for (const [query, intent] of queries) {
    const optimizer = optimizeQuery({ query, memory: {} })
    const direct = await buildDirectToolAnswer({
      query,
      optimizer,
      toolResults: {},
      memory: {},
      lang: 'vi',
      userRole: 'member',
    })
    assert.equal(optimizer.intent, intent)
    assert.ok(direct?.answer)
    assert.doesNotMatch(direct.answer, /Gói Pro|Gói Elite|triệu\/3 tháng|VNĐ|đ\/tháng/i)
  }
})

test('membership recommendation only renders plans from tool result', async () => {
  const optimizer = optimizeQuery({ query: 'Tôi nên mua gói nào để giảm cân?', memory: {} })
  const plan = { _id: 'p1', nameVi: 'Gói Cơ Bản', price: 300000, durationDays: 30, featuresVi: ['Tập tự do'] }
  const direct = await buildDirectToolAnswer({
    query: 'Tôi nên mua gói nào để giảm cân?',
    optimizer,
    toolResults: { getAvailablePlans: { plans: [plan] } },
    memory: {},
    lang: 'vi',
    userRole: 'member',
  })
  assert.match(direct.answer, /GÓI CƠ BẢN|Gói Cơ Bản/i)
  assert.doesNotMatch(direct.answer, /Gói Pro|Gói Elite|Diamond Ultra/i)
})

test('missing plan detail is not fabricated', async () => {
  const optimizer = optimizeQuery({ query: 'Gói Premium giá bao nhiêu?', memory: {} })
  const direct = await buildDirectToolAnswer({
    query: 'Gói Premium giá bao nhiêu?',
    optimizer,
    toolResults: { getAvailablePlans: { plans: [{ _id: 'p1', nameVi: 'Gói Cơ Bản', price: 300000, durationDays: 30 }] } },
    memory: {},
    lang: 'vi',
    userRole: 'member',
  })
  assert.match(direct.answer, /chưa tìm thấy dữ liệu gói "premium"/i)
  assert.doesNotMatch(direct.answer, /Premium.*\d.*đ/i)
})

test('constitutional reviewer blocks internal data without tool source', () => {
  const report = reviewGymProAnswerSync({
    query: 'GymPro có bao nhiêu hội viên?',
    intent: 'report_data',
    selectedTools: [],
    draftAnswer: 'GymPro hiện có 300 hội viên và doanh thu 120.000.000đ.',
    currentUserRole: 'admin',
    analysis: { needsDatabase: true, intent: 'report_data' },
  })
  assert.equal(report.approved, false)
  assert.ok(report.violations.includes('report_data_without_tool'))
  assert.doesNotMatch(report.safeAnswer, /300|120\.000\.000/)
})
