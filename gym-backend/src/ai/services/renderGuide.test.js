import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPlanListResponse, buildPtListResponse } from './naturalResponseBuilder.js'
import { buildGenericNutritionAnswer } from './builders/nutritionAnswerBuilder.js'

const deps = {
  normalizeLanguage: (language) => language === 'en' ? 'en' : 'vi',
  normalizeForIntent: (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase(),
}

test('render guide: plan list uses clean labels, bullets, and no emoji', () => {
  const text = buildPlanListResponse({
    lang: 'vi',
    plans: [{
      nameVi: 'Gói VIP',
      price: 3000000,
      durationDays: 365,
      featuresVi: ['PT cá nhân', 'Giáo án riêng'],
    }],
  })

  assert.match(text, /1\. GÓI VIP/)
  assert.match(text, /Giá: 3\.000\.000đ/)
  assert.match(text, /Thời hạn: 365 ngày/)
  assert.match(text, /Quyền lợi:\n\n• PT cá nhân/)
  assert.doesNotMatch(text, /💰|📅|✓|\[object Object\]|undefined|null|NaN/)
})

test('render guide: PT list keeps email label and value on one line', () => {
  const text = buildPtListResponse({
    lang: 'vi',
    pts: [{
      name: 'cgpt 1',
      phone: '0234566777',
      email: 'abc@gmail.com',
      specialties: ['Boxing', 'Gym'],
    }],
  })

  assert.match(text, /1\. CGPT 1/)
  assert.match(text, /Chuyên môn:\nBoxing • Gym/)
  assert.match(text, /Email: \[abc@gmail\.com\]\(mailto:abc@gmail\.com\)/)
  assert.doesNotMatch(text, /Email:\n/)
})

test('render guide: nutrition answer uses uppercase title and bullets', () => {
  const payload = buildGenericNutritionAnswer({
    query: 'trước buổi tập nên ăn gì',
    classifierResult: { intent: 'nutrition_advice' },
    toolData: {},
    language: 'vi',
    deps,
  })

  assert.match(payload.answer, /^TRƯỚC BUỔI TẬP/)
  assert.match(payload.answer, /Nên ăn:\n\n•/)
  assert.doesNotMatch(payload.answer, /\n- /)
})
