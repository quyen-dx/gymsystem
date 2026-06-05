import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPlanRecommendationPayload, chooseRecommendedPlan } from './dbResponder.js'

const plans = [
  {
    _id: 'basic',
    nameVi: 'Gói Cơ Bản',
    nameEn: 'Basic',
    price: 80000,
    durationDays: 30,
    featuresVi: ['Phòng tập cơ bản'],
    featuresEn: ['Basic gym access'],
  },
  {
    _id: 'premium',
    nameVi: 'Gói Premium',
    nameEn: 'Premium',
    price: 100000,
    durationDays: 30,
    featuresVi: ['Phòng tập', 'Lớp nhóm', 'Tủ đồ'],
    featuresEn: ['Gym access', 'Group classes', 'Locker'],
  },
  {
    _id: 'vip',
    nameVi: 'Gói VIP',
    nameEn: 'VIP',
    price: 200000,
    durationDays: 365,
    featuresVi: ['Phòng tập', 'Lớp nhóm', 'Ưu tiên dịch vụ', 'Khu VIP'],
    featuresEn: ['Gym access', 'Group classes', 'Priority service', 'VIP area'],
  },
]

test('student monthly budget recommendation prefers accessible plan over cheapest price per day', () => {
  const plan = chooseRecommendedPlan(plans, 'Which plan is best for a student with a budget of 100k per month?')

  assert.equal(plan?._id, 'premium')
})

test('student monthly budget reason does not rely only on price per day', () => {
  const payload = buildPlanRecommendationPayload(plans, 'Which plan is best for a student with a budget of 100k per month?', 'en')

  assert.equal(payload?.recommendedPlan?._id, 'premium')
  assert.match(payload?.reason || '', /monthly budget/i)
  assert.match(payload?.reason || '', /commitment/i)
})

test('explicit VIP need can still choose VIP when it is truly requested', () => {
  const plan = chooseRecommendedPlan(plans, 'I want VIP all access for long term and can pay 200k upfront')

  assert.equal(plan?._id, 'vip')
})
