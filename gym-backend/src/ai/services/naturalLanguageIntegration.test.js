import assert from 'node:assert/strict'
import test from 'node:test'
import { conversationalUnderstand } from './conversationalUnderstandingLayer.js'
import { buildPlanListResponse, buildPlanRecommendResponse, buildWorkoutAdviceResponse, buildMembershipInfoResponse, buildCheckinSummaryResponse, buildPtListResponse, buildEmptyDataResponse } from './naturalResponseBuilder.js'

// === Conversational Understanding Layer Tests ===

test('CU: "gym có mấy gói tập" → plan/info membership_info', () => {
  const result = conversationalUnderstand({ query: 'gym có mấy gói tập', language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.equal(result.action, 'info')
  assert.equal(result.intent, 'membership_info')
  assert.ok(result.confidence > 0.5)
})

test('CU: "gói VIP có PT không" → plan/check membership_benefit_lookup', () => {
  const result = conversationalUnderstand({ query: 'gói VIP có PT không', language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.equal(result.action, 'check')
  assert.equal(result.intent, 'membership_benefit_lookup')
  assert.ok(result.confidence > 0.6)
})

test('CU: "tôi tập 3 buổi/tuần thì nên chọn gói nào" → plan/recommend with frequency', () => {
  const result = conversationalUnderstand({ query: 'tôi tập 3 buổi/tuần thì nên chọn gói nào', language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.equal(result.action, 'recommend')
  assert.equal(result.intent, 'membership_advice')
  assert.equal(result.entities.frequencyPerWeek, 3)
  assert.ok(result.confidence > 0.5)
})

test('CU: "so sánh VIP và Premium" → plan/compare', () => {
  const result = conversationalUnderstand({ query: 'so sánh VIP và Premium', language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.equal(result.action, 'compare')
  assert.equal(result.intent, 'plan_comparison')
  assert.ok(result.confidence > 0.6)
})

test('CU: "tuần này tôi checkin mấy buổi" → checkin subject', () => {
  const result = conversationalUnderstand({ query: 'tuần này tôi checkin mấy buổi', language: 'vi' })
  assert.equal(result.subject, 'checkin')
  assert.equal(result.intent, 'checkin_summary')
  assert.ok(result.confidence > 0)
})

test('CU: "gói đó có PT không" → follow-up with lastMentionedPlan', () => {
  const result = conversationalUnderstand({
    query: 'gói đó có PT không',
    language: 'vi',
    context: { lastSubject: 'plan', lastMentionedPlan: 'VIP', lastIntent: 'membership_advice' },
  })
  assert.equal(result.isFollowUp, true)
  assert.equal(result.followUpTarget?.type, 'plan')
  assert.equal(result.followUpTarget?.value, 'VIP')
  assert.equal(result.subject, 'plan')
  assert.ok(['check', 'info'].includes(result.action))
})

test('CU: "thế còn gói VIP thì sao" → follow-up detection', () => {
  const result = conversationalUnderstand({
    query: 'thế còn gói VIP thì sao',
    language: 'vi',
    context: { lastSubject: 'plan', lastMentionedPlan: 'Premium', lastIntent: 'plan_comparison' },
  })
  assert.equal(result.isFollowUp, true)
  assert.equal(result.subject, 'plan')
  assert.ok(result.confidence > 0.5)
})

test('CU: "tôi có ngân sách 200k/tháng" → plan with budget entity', () => {
  const result = conversationalUnderstand({ query: 'tôi có ngân sách 200k/tháng', language: 'vi' })
  assert.equal(result.entities.budget, 200000)
  assert.ok(result.confidence > 0)
})

test('CU: "tôi muốn giảm cân gói nào phù hợp" → plan/recommend with goal', () => {
  const result = conversationalUnderstand({ query: 'tôi muốn giảm cân gói nào phù hợp', language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.equal(result.action, 'recommend')
  assert.equal(result.intent, 'membership_advice')
  assert.equal(result.entities.goal, 'fat_loss')
  assert.ok(result.confidence > 0.5)
})

test('CU: "thời gian tập mấy phút" → workout intent detected', () => {
  const result = conversationalUnderstand({ query: 'thời gian tập mấy phút', language: 'vi' })
  assert.equal(result.subject, 'workout')
  assert.ok(result.confidence > 0)
})

test('CU: "có PT nào dạy giỏi không" → pt subject', () => {
  const result = conversationalUnderstand({ query: 'có PT nào dạy giỏi không', language: 'vi' })
  assert.equal(result.subject, 'pt')
  assert.equal(result.intent, 'pt_advice')
  assert.ok(result.confidence > 0.4)
})

// === NaturalResponseBuilder Tests ===

test('NRB: buildPlanListResponse returns conversational list with plans', () => {
  const plans = [
    { _id: 'basic', nameVi: 'Gói Cơ Bản', nameEn: 'Basic', price: 80000, durationDays: 30 },
    { _id: 'premium', nameVi: 'Gói Premium', nameEn: 'Premium', price: 100000, durationDays: 30 },
  ]
  const text = buildPlanListResponse({ plans, lang: 'vi' })
  assert.ok(text.includes('GÓI CƠ BẢN'))
  assert.ok(text.includes('GÓI PREMIUM'))
  assert.ok(text.includes('80.000'))
  assert.ok(text.length > 50)
})

test('NRB: buildPlanListResponse returns English when requested', () => {
  const plans = [
    { _id: 'basic', nameVi: 'Gói Cơ Bản', nameEn: 'Basic', price: 80000, durationDays: 30 },
  ]
  const text = buildPlanListResponse({ plans, lang: 'en' })
  assert.ok(text.includes('BASIC'))
  assert.ok(text.includes('80,000'))
})

test('NRB: buildEmptyDataResponse returns meaningful message', () => {
  const text = buildEmptyDataResponse({ domain: 'plans', lang: 'vi' })
  assert.ok(text.length > 10)
  const textEn = buildEmptyDataResponse({ domain: 'checkin', lang: 'en' })
  assert.ok(textEn.length > 10)
})

test('NRB: buildPlanRecommendResponse contains plan info', () => {
  const plan = { _id: 'vip', nameVi: 'Gói VIP', nameEn: 'VIP', price: 200000, durationDays: 365 }
  const text = buildPlanRecommendResponse({ plan, lang: 'vi' })
  assert.ok(text.includes('VIP'))
  assert.ok(text.includes('200.000'))
})

test('NRB: buildCheckinSummaryResponse contains stats', () => {
  const stats = { thisMonth: 12, lastMonth: 8, total: 45, streak: 3 }
  const text = buildCheckinSummaryResponse({ stats, lang: 'vi' })
  assert.ok(text.includes('12'))
  assert.ok(text.includes('ngày'))
})

test('NRB: buildCheckinSummaryResponse English', () => {
  const stats = { thisMonth: 12, lastMonth: 8, total: 45, streak: 3 }
  const text = buildCheckinSummaryResponse({ stats, lang: 'en' })
  assert.ok(text.includes('12'))
  assert.ok(text.includes('days'))
})

test('NRB: buildPtListResponse lists PTs conversationally', () => {
  const pts = [
    { name: 'John', specialties: ['Strength', 'Weight loss'] },
    { name: 'Jane', specialties: ['Yoga', 'Flexibility'] },
  ]
  const text = buildPtListResponse({ pts, lang: 'vi' })
  assert.ok(text.includes('JOHN'))
  assert.ok(text.includes('JANE'))
  assert.ok(text.includes('Strength') || text.includes('Sức mạnh') || text.includes('huấn luyện'))
  const textEn = buildPtListResponse({ pts, lang: 'en' })
  assert.ok(textEn.includes('JOHN'))
  assert.ok(textEn.includes('Strength'))
})

test('NRB: buildMembershipInfoResponse describes membership', () => {
  const membership = { nameVi: 'Gói Premium', nameEn: 'Premium', price: 100000, durationDays: 30, featuresVi: ['Phòng tập', 'Lớp nhóm'], featuresEn: ['Gym access', 'Group classes'] }
  const text = buildMembershipInfoResponse({ membership, lang: 'vi' })
  assert.ok(text.includes('Premium'))
  const textEn = buildMembershipInfoResponse({ membership, lang: 'en' })
  assert.ok(textEn.includes('Premium'))
})

test('NRB: buildWorkoutAdviceResponse provides advice', () => {
  const stats = { frequencyPerWeek: 3, goal: 'weight_loss', duration: 45 }
  const text = buildWorkoutAdviceResponse({ stats, lang: 'vi' })
  assert.ok(text.length > 30)
  const textEn = buildWorkoutAdviceResponse({ stats, lang: 'en' })
  assert.ok(textEn.length > 30)
})

test('CU: Vietnamese query returns Vietnamese intro', () => {
  const result = conversationalUnderstand({ query: 'gympro là gì', language: 'vi' })
  assert.equal(result.subject, 'general')
  assert.equal(result.intent, 'introduction')
  assert.ok(result.confidence > 0)
})
