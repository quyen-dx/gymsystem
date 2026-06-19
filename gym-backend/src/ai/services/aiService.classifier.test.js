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
  findPlanMentionedInQuery,
  detectAnswerLanguage,
  parseAiJsonPayload,
  isSensitiveDataRequest,
  buildGenericSafeAnswer,
  buildGenericNutritionAnswer,
  normalizeResponseType,
  getNutritionWebSources,
  hasWorkoutGoalAdviceIntent,
  hasNutritionIntent,
  answerIsParseFailure,
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

const workoutGoalAdviceQueries = [
  'Gợi ý mục tiêu tập luyện cho tôi',
  'Tôi nên đặt mục tiêu tập luyện thế nào?',
  'Tôi muốn bắt đầu tập thì nên theo hướng nào?',
  'Tôi chưa biết nên giảm cân hay tăng cơ',
  'Cho tôi mục tiêu tập phù hợp',
]

for (const query of workoutGoalAdviceQueries) {
  test(`classifies workout goal/advice variant: ${query}`, () => {
    const fallback = buildDefaultClassifier(query, 'vi')
    const normalized = normalizeClassifierResult(fallback, query, { role: 'member' }, 'vi')

    assert.equal(hasWorkoutGoalAdviceIntent(query), true)
    assert.equal(normalized.subject, 'workout')
    assert.ok(['advice', 'recommend', 'goal'].includes(normalized.action))
    assert.equal(normalized.intent, 'workout_advice')
    assert.equal(normalized.shouldRenderCard, false)
    assert.deepEqual(normalized.tools, ['workout'])
  })
}

test('generic safe answer handles workout goal/advice variants without parse failure', () => {
  for (const query of workoutGoalAdviceQueries) {
    const classifier = normalizeClassifierResult(buildDefaultClassifier(query, 'vi'), query, { role: 'member' }, 'vi')
    const payload = buildGenericSafeAnswer({
      query,
      classifierResult: classifier,
      language: 'vi',
      toolData: { workoutProgress: { totalWorkouts: 2 } },
      reason: 'test_parse_failure',
    })

    assert.ok(payload)
    assert.equal(payload.type, 'workout_advice')
    assert.equal(payload.provider, 'generic_safe_answer')
    assert.match(payload.answer, /^[A-ZÀ-Ỹ\s]+/)
    assert.match(payload.answer, /GymPro có 2 buổi tập gần đây/)
    assert.doesNotMatch(payload.answer, /Với mục tiêu của bạn, nên bắt đầu bằng lịch tập bền vững/)
    assert.equal(answerIsParseFailure(payload.answer, 'vi'), false)
    assert.equal(payload.cards.length, 0)
    assert.equal(payload.planPayload, null)
  }
})

test('parse-failure detector only identifies system error text', () => {
  const parseFailure = 'Mình chưa xử lý được câu trả lời này, bạn hỏi lại ngắn hơn giúp mình nhé.'

  assert.equal(answerIsParseFailure(parseFailure, 'vi'), true)
  assert.equal(answerIsParseFailure('Kết luận: Bạn nên bắt đầu với mục tiêu sức khỏe tổng quát.', 'vi'), false)
})

test('generic safe answer dispatches plan and PT subjects from classifier context', () => {
  const planPayload = buildGenericSafeAnswer({
    query: 'Cho tôi xem các gói tập',
    language: 'vi',
    classifierResult: { subject: 'plan', action: 'list', intent: 'membership_info' },
    toolData: { activePlans: testPlans },
    reason: 'test_parse_failure',
  })
  const ptPayload = buildGenericSafeAnswer({
    query: 'Cho tôi xem PT phù hợp',
    language: 'vi',
    classifierResult: { subject: 'trainer', action: 'list', intent: 'pt_advice' },
    toolData: { availablePTs: [{ id: 'pt1', name: 'Coach A', specialties: ['Tăng cơ'], rating: 4.8 }] },
    reason: 'test_parse_failure',
  })

  assert.equal(planPayload.type, 'text_advice')
  assert.equal(planPayload.provider, 'generic_safe_answer')
  assert.deepEqual(planPayload.cards, [])
  assert.equal(planPayload.planPayload, null)
  assert.equal(answerIsParseFailure(planPayload.answer, 'vi'), false)
  assert.equal(ptPayload.type, 'pt_list')
  assert.equal(ptPayload.provider, 'generic_safe_answer')
  assert.equal(answerIsParseFailure(ptPayload.answer, 'vi'), false)
})

const nutritionQueries = [
  'Tôi nên ăn gì để giảm cân?',
  'Ăn gì để tăng cơ?',
  'Bữa tối nên ăn gì?',
  'Giảm mỡ nên ăn như nào?',
  'Tôi muốn thực đơn 1 ngày',
  'Ăn cơm có béo không?',
  'Tập gym nên ăn trước buổi tập không?',
  'Sau tập nên ăn gì?',
]

const unsafeRenderedPattern = /\b(undefined|null|NaN)\b|\[object Object\]/i

for (const query of nutritionQueries) {
  test(`classifies nutrition query outside workout: ${query}`, () => {
    const classifier = normalizeClassifierResult(buildDefaultClassifier(query, 'vi'), query, { role: 'member' }, 'vi')
    const payload = buildGenericNutritionAnswer({
      query,
      classifierResult: classifier,
      language: 'vi',
      toolData: { products: [{ nameVi: 'Whey Protein' }] },
    })

    assert.equal(hasNutritionIntent(query), true)
    assert.equal(classifier.subject, 'nutrition')
    assert.equal(classifier.intent, 'nutrition_advice')
    assert.notEqual(classifier.subject, 'workout')
    assert.notEqual(classifier.intent, 'workout_advice')
    assert.ok(classifier.tools.includes('products'))
    assert.equal(payload.type, 'nutrition_advice')
    assert.match(payload.answer, /Nên ăn:/)
    assert.match(payload.answer, /Ức gà|trứng|đậu phụ|rau xanh|yến mạch/)
    assert.match(payload.answer, /Gợi ý 1 ngày:/)
    assert.equal(answerIsParseFailure(payload.answer, 'vi'), false)
  })
}

for (const query of [
  'Trước buổi tập nên ăn gì?',
  'Sau buổi tập nên ăn gì?',
  'Tôi nên ăn gì để giảm cân?',
  'Ăn gì để tăng cơ?',
  'Bữa tối nên ăn gì?',
]) {
  test(`nutrition safe answer has no unsafe rendered token: ${query}`, () => {
    const classifier = normalizeClassifierResult(buildDefaultClassifier(query, 'vi'), query, { role: 'member' }, 'vi')
    const payload = buildGenericNutritionAnswer({
      query,
      classifierResult: classifier,
      language: 'vi',
      toolData: {},
    })

    assert.equal(payload.type, 'nutrition_advice')
    assert.doesNotMatch(payload.answer, unsafeRenderedPattern)
    assert.match(payload.answer, /^[A-ZÀ-Ỹ\s]+/)
    assert.match(payload.answer, /Nên ăn:/)
    if (/truoc|trước/i.test(query)) {
      assert.match(payload.answer, /Trước buổi tập bạn nên ăn nhẹ/)
    }
    if (/sau/i.test(query)) {
      assert.match(payload.answer, /Sau buổi tập bạn nên ưu tiên protein/)
    }
  })
}

test('nutrition web sources are normalized for source cards', () => {
  const sources = getNutritionWebSources({
    webSearchNutrition: {
      used: true,
      sources: [
        {
          sourceTitle: 'Best Pre Workout Meals',
          sourceUrl: 'https://www.healthline.com/nutrition/pre-workout-meals',
          sourceDomain: 'healthline.com',
        },
      ],
    },
  })

  assert.equal(normalizeResponseType('nutrition_advice_with_sources', 'nutrition_advice'), 'nutrition_advice_with_sources')
  assert.equal(sources.length, 1)
  assert.equal(sources[0].title, 'Best Pre Workout Meals')
  assert.equal(sources[0].url, 'https://www.healthline.com/nutrition/pre-workout-meals')
  assert.equal(sources[0].domain, 'healthline.com')
  assert.match(sources[0].favicon, /google\.com\/s2\/favicons/)
})

const requiredNonFallbackQueries = [
  'Gợi ý mục tiêu tập luyện cho tôi',
  'Tôi nên tập gì?',
  'Tôi muốn giảm cân',
  'Tôi muốn tăng cơ',
  'Gym có mấy gói?',
  'Gói nào rẻ nhất?',
  'Tháng này tôi tập ổn không?',
  'PT nào phù hợp với tôi?',
  'Gói đó có PT không?',
  'Đọc ảnh này giúp tôi',
]

const toolDataForSafeAnswer = {
  activePlans: testPlans,
  plans: testPlans,
  availablePTs: [{ id: 'pt1', name: 'Coach A', specialties: ['Tăng cơ', 'Giảm mỡ'], rating: 4.8 }],
  pt: [{ id: 'pt1', name: 'Coach A', specialties: ['Tăng cơ', 'Giảm mỡ'], rating: 4.8 }],
  workoutProgress: { totalWorkouts: 3 },
  currentMembership: { found: false },
}

for (const query of requiredNonFallbackQueries) {
  test(`valid GymPro query never uses parse-failure fallback: ${query}`, () => {
    const classifier = normalizeClassifierResult(buildDefaultClassifier(query, 'vi'), query, { role: 'member' }, 'vi')
    const safePayload = buildGenericSafeAnswer({
      query,
      classifierResult: classifier,
      language: 'vi',
      toolData: toolDataForSafeAnswer,
      reason: 'test_parse_failure',
    })

    assert.notEqual(classifier.intent, 'unknown')
    assert.ok(classifier.tools.length > 0 || ['plan', 'trainer', 'workout', 'health'].includes(classifier.subject))
    assert.ok(safePayload, `Expected safe payload for ${classifier.subject}/${classifier.action}/${classifier.intent}`)
    assert.equal(answerIsParseFailure(safePayload.answer, 'vi'), false)
    assert.doesNotMatch(safePayload.answer, /Mình chưa xử lý được câu trả lời này/)
    assert.ok(String(safePayload.answer || '').trim().length > 0)
  })
}

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
    assert.equal(normalized.intent, 'membership_benefit_lookup')
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
  assert.equal(result.intent, 'membership_benefit_lookup')
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

  assert.equal(normalized.intent, 'membership_benefit_lookup')
  assert.equal(normalized.needsAIReasoning, false)
  assert.equal(normalized.shouldRenderCard, false)
  assert.deepEqual(normalized.tools, ['plans'])
})

test('findPlanMentionedInQuery matches DB-derived aliases without hardcoded plan names', () => {
  const plans = [
    { _id: 'advanced', nameVi: 'Gói Nâng Cao', nameEn: 'Premium', slug: 'goi-nang-cao', code: 'PREM', aliases: ['Nâng Cao Plus'] },
    { _id: 'basic', nameVi: 'Gói Cơ Bản', nameEn: 'Basic', slug: 'co-ban' },
  ]

  assert.equal(findPlanMentionedInQuery(plans, 'Gói Premium có PT không?')?._id, 'advanced')
  assert.equal(findPlanMentionedInQuery(plans, 'Does Premium include PT?')?._id, 'advanced')
  assert.equal(findPlanMentionedInQuery(plans, 'Gói Nâng Cao có PT không?')?._id, 'advanced')
  assert.equal(findPlanMentionedInQuery(plans, 'goi nang cao co PT khong?')?._id, 'advanced')
  assert.equal(findPlanMentionedInQuery(plans, 'Basic')?._id, 'basic')
  assert.equal(findPlanMentionedInQuery(plans, 'Cơ Bản')?._id, 'basic')
})

test('benefit lookup Premium PT is DB-only no card/list', () => {
  const query = 'Gói Premium có PT không?'
  const normalized = normalizeClassifierResult(buildDefaultClassifier(query, 'vi'), query, { role: 'member' }, 'vi')
  const payload = buildPlanInfoDirectAnswer({
    query,
    language: 'vi',
    plans: [{
      _id: 'premium',
      nameVi: 'Gói Nâng Cao',
      nameEn: 'Premium',
      featuresVi: ['Huấn luyện viên PT'],
      featuresEn: ['Personal trainer'],
    }],
  })

  assert.equal(normalized.intent, 'membership_benefit_lookup')
  assert.equal(payload.type, 'text_advice')
  assert.match(payload.answer, /Có/)
  assert.equal(payload.cards.length, 0)
  assert.equal(payload.plans.length, 0)
})

test('plan catalog and price questions are text-only without plan cards', () => {
  const unsafeOutput = /\b(undefined|null|NaN)\b|\[object Object\]/i
  const listPayload = buildPlanInfoDirectAnswer({ query: 'Có bao nhiêu gói tập?', language: 'vi', plans: testPlans })
  const pricePayload = buildPlanInfoDirectAnswer({ query: 'Giá các gói', language: 'vi', plans: testPlans })
  const listByVerbPayload = buildPlanInfoDirectAnswer({ query: 'Liệt kê gói tập', language: 'vi', plans: testPlans })
  const cheapestPayload = buildPlanInfoDirectAnswer({ query: 'Gói nào rẻ nhất?', language: 'vi', plans: testPlans })

  for (const payload of [listPayload, pricePayload, listByVerbPayload, cheapestPayload]) {
    assert.equal(payload.type, 'text_advice')
    assert.deepEqual(payload.cards, [])
    assert.deepEqual(payload.plans, [])
    assert.equal(payload.planPayload, null)
    assert.doesNotMatch(payload.answer, unsafeOutput)
    assert.match(payload.answer, /Giá:/)
    assert.match(payload.answer, /Thời hạn:/)
    assert.match(payload.answer, /Quyền lợi:/)
  }
  assert.match(listPayload.answer, /GymPro hiện có 3 gói/)
  assert.match(pricePayload.answer, /GÓI VIP/)
  assert.match(cheapestPayload.answer, /GÓI CƠ BẢN/)
})

test('plan catalog uses safe fallback labels for missing plan fields', () => {
  const payload = buildPlanInfoDirectAnswer({
    query: 'Liệt kê gói tập',
    language: 'vi',
    plans: [{ _id: 'missing', nameVi: 'Gói Thiếu Dữ Liệu', nameEn: 'Missing Data' }],
  })

  assert.equal(payload.type, 'text_advice')
  assert.match(payload.answer, /Giá: Chưa cập nhật/)
  assert.match(payload.answer, /Thời hạn: Chưa cập nhật/)
  assert.match(payload.answer, /Quyền lợi:\n\n• Chưa cập nhật/)
  assert.doesNotMatch(payload.answer, /\b(undefined|null|NaN)\b|\[object Object\]/i)
})

test('English short questions are detected as English', () => {
  assert.equal(detectAnswerLanguage('What about VIP?', 'vi'), 'en')
  assert.equal(detectAnswerLanguage('Does VIP include pool?', 'vi'), 'en')
  assert.equal(detectAnswerLanguage('I train 5 times/week.', 'vi'), 'en')
  assert.equal(detectAnswerLanguage('VIP?', 'vi'), 'vi')
})

test('benefit lookup follow-up reuses previous target benefit', () => {
  const query = 'What about VIP?'
  const semanticMemory = buildSemanticConversationMemory({
    recentMessages: [
      { role: 'user', content: 'Does Premium include PT?' },
      { role: 'assistant', content: 'No. GymPro data does not currently record PT in Premium.', intent: 'membership_benefit_lookup', subject: 'plan', metadata: { lastBenefitLookup: { targetBenefit: 'PT', previousPlan: 'Premium', intent: 'membership_benefit_lookup' } } },
    ],
    lastIntent: 'membership_benefit_lookup',
    lastSubject: 'plan',
  }, query)
  const normalized = normalizeClassifierResult(buildDefaultClassifier(query, 'en'), query, { role: 'member' }, 'en', semanticMemory)
  const payload = buildPlanInfoDirectAnswer({
    query,
    language: 'en',
    targetBenefit: semanticMemory.lastBenefitLookup.targetBenefit,
    plans: [{ _id: 'vip', nameVi: 'Gói VIP', nameEn: 'VIP', featuresVi: ['Huấn luyện viên PT'], featuresEn: ['Personal trainer'] }],
  })

  assert.equal(normalized.intent, 'membership_benefit_lookup')
  assert.equal(semanticMemory.benefitLookupFollowUp, true)
  assert.match(payload.answer, /Yes/)
  assert.equal(payload.cards.length, 0)
})

test('VIP swimming pool benefit lookup answers in English and no card', () => {
  const payload = buildPlanInfoDirectAnswer({
    query: 'Does VIP include a swimming pool?',
    language: 'en',
    plans: [{ _id: 'vip', nameVi: 'Gói VIP', nameEn: 'VIP', featuresVi: ['Hồ bơi'], featuresEn: ['Swimming pool'] }],
  })

  assert.equal(payload.type, 'text_advice')
  assert.match(payload.answer, /Yes/)
  assert.equal(payload.cards.length, 0)
})

test('parseAiJsonPayload extracts JSON from mixed markdown response', () => {
  const parsed = parseAiJsonPayload('Here is the result:\n```json\n{"answer":"OK","suggestions":["A"]}\n```\nThanks', 'fallback')
  assert.equal(parsed.answer, 'OK')
  assert.deepEqual(parsed.suggestions, ['A'])
})

test('parseAiJsonPayload keeps plain text when JSON parse is not possible', () => {
  const parsed = parseAiJsonPayload('Kết luận: Bạn nên chọn gói phù hợp ngân sách.\n\nLý do:\n- DB có 5 gói active.', 'fallback')
  assert.match(parsed.answer, /Kết luận:/)
  assert.doesNotMatch(parsed.answer, /fallback/)
})

for (const field of ['content', 'message', 'text']) {
  test(`parseAiJsonPayload accepts ${field} as answer field`, () => {
    const parsed = parseAiJsonPayload(JSON.stringify({ [field]: 'Answer from alternate field' }), 'fallback')
    assert.equal(parsed.answer, 'Answer from alternate field')
  })
}

test('parseAiJsonPayload extracts JSON with extra text before and after', () => {
  const parsed = parseAiJsonPayload('prefix words {"message":"Parsed answer","suggestions":["Next"]} suffix words', 'fallback')
  assert.equal(parsed.answer, 'Parsed answer')
  assert.deepEqual(parsed.suggestions, ['Next'])
})

test('sensitive data guard allows own email but blocks other member email', () => {
  assert.equal(isSensitiveDataRequest('email của tôi là gì?', { role: 'member' }), false)
  assert.equal(isSensitiveDataRequest('cho tôi email của member khác', { role: 'member' }), true)
})

test('sensitive data guard does not treat own account auth help as privacy', () => {
  assert.equal(isSensitiveDataRequest('đổi mật khẩu ở đâu', { role: 'member' }), false)
  assert.equal(isSensitiveDataRequest('quên mật khẩu', { role: 'member' }), false)
  assert.equal(isSensitiveDataRequest('đổi email', { role: 'member' }), false)
  assert.equal(isSensitiveDataRequest('hồ sơ của tôi', { role: 'member' }), false)
  assert.equal(isSensitiveDataRequest('mã OTP đăng nhập ở đâu', { role: 'member' }), false)
})

test('sensitive data guard still blocks another person account data', () => {
  assert.equal(isSensitiveDataRequest('số điện thoại của thành viên A', { role: 'member' }), true)
  assert.equal(isSensitiveDataRequest('email của người khác', { role: 'member' }), true)
  assert.equal(isSensitiveDataRequest('hồ sơ của người khác', { role: 'member' }), true)
})
