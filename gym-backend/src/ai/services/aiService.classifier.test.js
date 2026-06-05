import assert from 'node:assert/strict'
import test from 'node:test'
import { __aiClassifierTestHooks, runGymAiAction } from './aiService.js'
import { chooseRecommendedPlan } from './dbResponder.js'

const testPlans = [
  { _id: 'basic', nameVi: 'Gói Cơ Bản', nameEn: 'Basic', price: 80000, durationDays: 30, featuresVi: ['Phòng tập cơ bản'], featuresEn: ['Basic gym access'] },
  { _id: 'premium', nameVi: 'Gói Premium', nameEn: 'Premium', price: 100000, durationDays: 30, featuresVi: ['Phòng tập', 'Lớp nhóm', 'Tủ đồ'], featuresEn: ['Gym access', 'Group classes', 'Locker'] },
  { _id: 'vip', nameVi: 'Gói VIP', nameEn: 'VIP', price: 200000, durationDays: 365, featuresVi: ['Phòng tập', 'Lớp nhóm', 'Ưu tiên dịch vụ', 'Khu VIP'], featuresEn: ['Gym access', 'Group classes', 'Priority service', 'VIP area'] },
]

const {
  buildDefaultClassifier,
  normalizeClassifierResult,
  buildSemanticConversationMemory,
  buildPlanInfoDirectAnswer,
  buildPtPlanBudgetAdvicePayload,
  buildCheapestLongTermAnswer,
  hasCheapestLongTermIntent,
  resolveClarificationFollowUp,
} = __aiClassifierTestHooks

const cases = [
  'tập 5 buổi/tuần',
  'tập 3 lần/tuần',
  'tập mỗi ngày',
  'tập đều',
  'checkin 4 buổi',
]

for (const query of cases) {
  test(`classifies workout frequency: ${query}`, () => {
    const fallback = buildDefaultClassifier(query, 'vi')
    const normalized = normalizeClassifierResult(fallback, query, { role: 'member' }, 'vi')

    assert.equal(normalized.subject, 'workout')
    assert.equal(normalized.intent, 'workout_info')
    assert.equal(normalized.needsAIReasoning, true)
    assert.notEqual(normalized.intent, 'unknown')
  })
}

test('AI classifier unknown output is guarded for workout frequency', () => {
  const normalized = normalizeClassifierResult({
    subject: 'general',
    action: 'unclear',
    intent: 'unknown',
    confidence: 0.99,
    shouldRenderCard: false,
    needsDatabase: false,
    needsAIReasoning: false,
    tools: [],
    entities: {},
  }, 'Tôi tập 5 buổi/tuần', { role: 'member' }, 'vi')

  assert.equal(normalized.subject, 'workout')
  assert.equal(normalized.action, 'info')
  assert.equal(normalized.intent, 'workout_info')
  assert.equal(normalized.needsAIReasoning, true)
  assert.deepEqual(normalized.tools, ['workout'])
})

test('workout frequency supplements previous plan advice in same conversation', () => {
  const query = 'Tôi tập 5 buổi/tuần'
  const semanticMemory = buildSemanticConversationMemory({
    recentMessages: [
      { role: 'user', content: 'Tôi có nên mua gói PT không?' },
      { role: 'assistant', content: 'Bạn nên cân nhắc theo mục tiêu và tần suất.', intent: 'membership_advice', subject: 'plan' },
    ],
    lastIntent: 'membership_advice',
    lastSubject: 'plan',
  }, query)
  const fallback = buildDefaultClassifier(query, 'vi')
  const normalized = normalizeClassifierResult(fallback, query, { role: 'member' }, 'vi', semanticMemory)

  assert.equal(normalized.subject, 'plan')
  assert.equal(normalized.action, 'advice')
  assert.equal(normalized.intent, 'membership_advice')
  assert.equal(normalized.needsAIReasoning, true)
  assert.equal(normalized.entities.frequencyPerWeek, 5)
  assert.ok(normalized.tools.includes('plans'))
  assert.notEqual(normalized.intent, 'workout_info')
})

for (const query of ['VIP?', 'PT?', 'Gói?', 'Plan?', 'Trainer?']) {
  test(`keeps short ambiguous message unclear: ${query}`, () => {
    const fallback = buildDefaultClassifier(query, 'vi')
    const normalized = normalizeClassifierResult(fallback, query, { role: 'member' }, 'vi')

    assert.equal(normalized.intent, 'unclear_question')
    assert.equal(normalized.action, 'unclear')
    assert.equal(normalized.shouldRenderCard, false)
    assert.deepEqual(normalized.tools, [])
  })
}

test('VIP response type and classifier metadata stay unclear_question', async () => {
  const payload = await runGymAiAction({
    query: 'VIP?',
    userMessage: 'VIP?',
    user: { role: 'member', name: 'Test User' },
    conversationContext: { recentMessages: [] },
    language: 'vi',
  })

  assert.equal(payload.type, 'unclear_question')
  assert.equal(payload.metadata?.questionAnalysis?.intent, 'unclear_question')
  assert.equal(payload.metadata?.questionAnalysis?.action, 'unclear')
  assert.equal(payload.metadata?.questionAnalysis?.shouldRenderCard, false)
  assert.deepEqual(payload.metadata?.questionAnalysis?.tools, [])
})

for (const query of ['Gói VIP có hồ bơi không?', 'Plan VIP includes pool?', 'VIP có hồ bơi không?', 'Gói Nâng Cao có PT không?']) {
  test(`classifies plan benefit lookup as DB-only info: ${query}`, () => {
    const fallback = buildDefaultClassifier(query, 'vi')
    const normalized = normalizeClassifierResult({
      ...fallback,
      action: 'advice',
      intent: 'membership_advice',
      needsAIReasoning: true,
      tools: ['plans', 'membership'],
    }, query, { role: 'member' }, 'vi')

    assert.equal(normalized.subject, 'plan')
    assert.equal(normalized.action, 'info')
    assert.equal(normalized.intent, 'membership_info')
    assert.equal(normalized.needsDatabase, true)
    assert.equal(normalized.needsAIReasoning, false)
    assert.equal(normalized.shouldRenderCard, false)
    assert.deepEqual(normalized.tools, ['plans'])
  })
}

test('plan benefit lookup answers missing benefit from DB-only plan data', () => {
  const payload = buildPlanInfoDirectAnswer({
    query: 'Gói VIP có hồ bơi không?',
    language: 'vi',
    plans: [{
      _id: 'vip',
      nameVi: 'Gói VIP',
      nameEn: 'VIP Plan',
      price: 200000,
      durationDays: 30,
      featuresVi: ['Tập gym không giới hạn'],
      featuresEn: ['Unlimited gym access'],
    }],
  })

  assert.equal(payload.type, 'text_advice')
  assert.match(payload.answer, /Hiện dữ liệu GymPro chưa ghi nhận hồ bơi trong quyền lợi Gói VIP/)
})

test('membership PT advice uses conversation budget and gives preliminary conclusion first', () => {
  const memory = buildSemanticConversationMemory({
    recentMessages: [
      { role: 'user', content: 'Ngân sách của tôi chỉ 100k/tháng', intent: 'membership_advice', subject: 'plan' },
    ],
    lastIntent: 'membership_advice',
    lastSubject: 'plan',
  }, 'Tôi có nên mua gói PT không?')
  const payload = buildPtPlanBudgetAdvicePayload({
    query: `${memory.budgetText}\nTôi có nên mua gói PT không?`,
    language: 'vi',
    toolData: {
      semanticMemory: memory,
      activePlans: [
        {
          _id: 'advanced',
          nameVi: 'Gói Nâng Cao',
          nameEn: 'Advanced',
          price: 100000,
          durationDays: 30,
          featuresVi: ['Theo dõi sức khỏe'],
          featuresEn: ['Health tracking'],
        },
        {
          _id: 'pt',
          nameVi: 'Gói PT',
          nameEn: 'PT Plan',
          price: 400000,
          durationDays: 30,
          featuresVi: ['Huấn luyện cá nhân PT'],
          featuresEn: ['Personal trainer'],
        },
      ],
    },
  })

  assert.equal(memory.budget, 100000)
  assert.equal(payload.type, 'text_advice')
  assert.match(payload.answer, /^Kết luận:/)
  assert.match(payload.answer, /chưa nên mua Gói PT/)
  assert.match(payload.answer, /Vượt ngân sách khoảng 4 lần/)
  assert.doesNotMatch(payload.answer, /cần biết thêm về mục tiêu/)
})

// === Lỗi 1: Student with low budget + frequency should NOT recommend VIP ===
test('student with 150k/month 2 buổi/tuần tăng cơ should NOT recommend VIP', () => {
  const queryEn = 'I am a student with 150k/month budget, want muscle gain, can train 2 sessions/week'
  const plan = chooseRecommendedPlan(testPlans, queryEn)

  assert.notEqual(plan?._id, 'vip')
  assert.ok(plan?._id === 'premium' || plan?._id === 'basic')
})

test('student monthly budget 150k tăng cơ 2 buổi/tuần classifier does not force VIP', () => {
  const query = 'Tôi là sinh viên, ngân sách 150k/tháng, mục tiêu tăng cơ, tập 2 buổi/tuần'
  const fallback = buildDefaultClassifier(query, 'vi')
  const normalized = normalizeClassifierResult(fallback, query, { role: 'member' }, 'vi')

  assert.ok(normalized.intent === 'membership_advice' || normalized.intent === 'membership_info')
  assert.equal(normalized.entities.budget, 150000)
  assert.equal(normalized.entities.frequencyPerWeek, 2)
})

// === Lỗi 2: Cheapest long-term plan ===
test('classifies cheapest long-term plan intent: tập 6 tháng chi ít tiền nhất', () => {
  const query = 'Tôi muốn tập 6 tháng nhưng chi ít tiền nhất'
  const fallback = buildDefaultClassifier(query, 'vi')
  const normalized = normalizeClassifierResult(fallback, query, { role: 'member' }, 'vi')

  assert.equal(normalized.subject, 'plan')
  assert.equal(normalized.action, 'compare')
  assert.equal(normalized.intent, 'cheapest_long_term_plan')
  assert.equal(normalized.shouldRenderCard, false)
  assert.equal(normalized.needsAIReasoning, false)
  assert.deepEqual(normalized.tools, ['plans'])
})

test('classifies cheapest long-term plan intent: tiết kiệm nhất khi tập lâu dài', () => {
  const query = 'Gói nào tiết kiệm nhất nếu tập lâu dài?'
  const fallback = buildDefaultClassifier(query, 'vi')
  const normalized = normalizeClassifierResult(fallback, query, { role: 'member' }, 'vi')

  assert.equal(normalized.subject, 'plan')
  assert.equal(normalized.intent, 'cheapest_long_term_plan')
})

test('hasCheapestLongTermIntent detects patterns correctly', () => {
  assert.equal(hasCheapestLongTermIntent('Tôi muốn tập 6 tháng chi ít tiền nhất'), true)
  assert.equal(hasCheapestLongTermIntent('Gói nào rẻ nhất nếu tập 1 năm?'), true)
  assert.equal(hasCheapestLongTermIntent('Chi ít tiền nhất khi tập dài hạn'), true)
  assert.equal(hasCheapestLongTermIntent('So sánh giá các gói'), false)
  assert.equal(hasCheapestLongTermIntent('Gói VIP có gì?'), false)
})

test('buildCheapestLongTermAnswer calculates total cost correctly', () => {
  const payload = buildCheapestLongTermAnswer({
    query: 'Tôi muốn tập 6 tháng chi ít tiền nhất',
    language: 'vi',
    plans: [
      { _id: 'basic', nameVi: 'Gói Cơ Bản', nameEn: 'Basic', price: 80000, durationDays: 30 },
      { _id: 'premium', nameVi: 'Gói Premium', nameEn: 'Premium', price: 100000, durationDays: 30 },
      { _id: 'vip', nameVi: 'Gói VIP', nameEn: 'VIP', price: 200000, durationDays: 365 },
    ],
  })

  assert.equal(payload.type, 'plan_recommend')
  assert.ok(payload.recommendedPlan)
  assert.match(payload.answer, /6 tháng/)
  // VIP (200k x 1 cycle for 365d covering 180d = 200k total) is cheapest
  // vs Basic (80k x 6 cycles = 480k) or Premium (100k x 6 = 600k)
  assert.equal(payload.recommendedPlan._id, 'vip')
})

// === Lỗi 3: Benefit lookup direct Yes/No ===
test('benefit lookup direct Yes when benefit exists', () => {
  const payload = buildPlanInfoDirectAnswer({
    query: 'Gói Premium có PT không?',
    language: 'vi',
    plans: [{
      _id: 'premium',
      nameVi: 'Gói Premium',
      nameEn: 'Premium',
      price: 100000,
      durationDays: 30,
      featuresVi: ['Phòng tập', 'Lớp nhóm', 'Huấn luyện viên PT'],
      featuresEn: ['Gym access', 'Group classes', 'Personal trainer'],
    }],
  })

  assert.equal(payload.type, 'text_advice')
  assert.match(payload.answer, /Có/)
  assert.equal(payload.cards.length, 0)
  assert.equal(payload.plans.length, 0)
})

test('benefit lookup direct No when benefit does not exist', () => {
  const payload = buildPlanInfoDirectAnswer({
    query: 'Gói Premium có hồ bơi không?',
    language: 'vi',
    plans: [{
      _id: 'premium',
      nameVi: 'Gói Premium',
      nameEn: 'Premium',
      price: 100000,
      durationDays: 30,
      featuresVi: ['Phòng tập', 'Lớp nhóm'],
      featuresEn: ['Gym access', 'Group classes'],
    }],
  })

  assert.equal(payload.type, 'text_advice')
  assert.match(payload.answer, /chưa ghi nhận/)
  assert.equal(payload.cards.length, 0)
})

test('benefit lookup without plan mention asks to specify', () => {
  const payload = buildPlanInfoDirectAnswer({
    query: 'Có PT không?',
    language: 'vi',
    plans: [
      { _id: 'basic', nameVi: 'Gói Cơ Bản', nameEn: 'Basic', price: 80000, durationDays: 30, featuresVi: ['Phòng tập'], featuresEn: ['Gym access'] },
    ],
  })

  assert.equal(payload.type, 'text_advice')
  assert.match(payload.answer, /gói nào/)
})

// === Lỗi 4: Clarification follow-up memory ===
test('resolveClarificationFollowUp detects benefit follow-up', () => {
  const result = resolveClarificationFollowUp(
    'Xem quyền lợi VIP',
    [
      { role: 'user', content: 'VIP?' },
      { role: 'assistant', content: 'Bạn muốn xem giá, quyền lợi hay so sánh Gói VIP?' },
    ],
  )

  assert.ok(result)
  assert.equal(result.subject, 'plan')
  assert.equal(result.intent, 'membership_info')
  assert.equal(result.entity, 'VIP')
  assert.equal(result.needsAIReasoning, false)
})

test('resolveClarificationFollowUp detects price follow-up', () => {
  const result = resolveClarificationFollowUp(
    'Xem giá VIP',
    [
      { role: 'user', content: 'VIP?' },
      { role: 'assistant', content: 'Bạn muốn xem giá, quyền lợi hay so sánh Gói VIP?' },
    ],
  )

  assert.ok(result)
  assert.equal(result.intent, 'membership_info')
  assert.equal(result.entity, 'VIP')
})

test('resolveClarificationFollowUp detects comparison follow-up', () => {
  const result = resolveClarificationFollowUp(
    'So sánh VIP với Cơ Bản',
    [
      { role: 'user', content: 'VIP?' },
      { role: 'assistant', content: 'Bạn muốn xem giá, quyền lợi hay so sánh Gói VIP?' },
    ],
  )

  assert.ok(result)
  assert.equal(result.intent, 'plan_comparison')
  assert.equal(result.entity, 'VIP')
})

test('clarification follow-up overrides classifier in normalizeClassifierResult', () => {
  const query = 'Xem quyền lợi VIP'
  const semanticMemory = buildSemanticConversationMemory({
    recentMessages: [
      { role: 'user', content: 'VIP?' },
      { role: 'assistant', content: 'Bạn muốn xem giá, quyền lợi hay so sánh Gói VIP?', intent: 'unclear_question', subject: 'plan' },
    ],
    lastIntent: 'unclear_question',
    lastSubject: 'plan',
  }, query)

  const fallback = buildDefaultClassifier(query, 'vi')
  const normalized = normalizeClassifierResult(fallback, query, { role: 'member' }, 'vi', semanticMemory)

  assert.equal(normalized.intent, 'membership_info')
  assert.equal(normalized.needsAIReasoning, false)
  assert.equal(normalized.shouldRenderCard, false)
  assert.deepEqual(normalized.tools, ['plans'])
})
