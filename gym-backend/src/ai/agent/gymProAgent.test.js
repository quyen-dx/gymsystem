import assert from 'node:assert/strict'
import test from 'node:test'
import { agentMemory } from './agentMemory.js'
import { reasonQuery } from './queryReasoner.js'

// === Query Reasoner Tests (CU layer fast path, no LLM needed) ===

test('reasonQuery: "gym có mấy gói" → plan subject, list action', async () => {
  const result = await reasonQuery({ query: 'gym có mấy gói', memory: {}, language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.equal(result.confidence > 0, true)
  assert.ok(result.needsTools.includes('getAvailablePlans'))
})

test('reasonQuery: "có bao nhiêu gói tập" → plan subject', async () => {
  const result = await reasonQuery({ query: 'có bao nhiêu gói tập', memory: {}, language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.ok(result.needsTools.includes('getAvailablePlans'))
})

test('reasonQuery: "gói nào rẻ nhất" → plan subject', async () => {
  const result = await reasonQuery({ query: 'gói nào rẻ nhất', memory: {}, language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.ok(result.confidence > 0)
})

test('reasonQuery: "tôi muốn giảm cân thì chọn gói nào" → plan/recommend with goal', async () => {
  const result = await reasonQuery({ query: 'tôi muốn giảm cân thì chọn gói nào', memory: {}, language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.ok(result.needsTools.includes('getAvailablePlans') || result.needsTools.includes('getSmartRecommendations'))
})

test('reasonQuery: "tôi tập 3 buổi/tuần thì sao" → subject detected', async () => {
  const result = await reasonQuery({ query: 'tôi tập 3 buổi/tuần thì sao', memory: {}, language: 'vi' })
  assert.ok(result.subject)
  assert.ok(result.confidence > 0)
})

test('reasonQuery: "tháng này tôi tập ổn không" → subject detected', async () => {
  const result = await reasonQuery({ query: 'tháng này tôi tập ổn không', memory: {}, language: 'vi' })
  assert.ok(result.subject)
  assert.ok(result.confidence > 0)
})

test('reasonQuery: "so sánh nó với gói premium" → follow-up with memory', async () => {
  const memory = { lastSubject: 'plan', lastMentionedPlanName: 'Premium', lastMentionedPlanId: 'premium123' }
  const result = await reasonQuery({ query: 'so sánh nó với gói premium', memory, language: 'vi' })
  assert.equal(result.subject, 'plan')
  assert.ok(result.needsTools.includes('getAvailablePlans'))
})

test('reasonQuery: "gói đó có PT không" → follow-up detection', async () => {
  const memory = { lastSubject: 'plan', lastMentionedPlanName: 'VIP', lastMentionedPlanId: 'vip123' }
  const result = await reasonQuery({ query: 'gói đó có PT không', memory, language: 'vi' })
  assert.equal(result.subject, 'plan')
})

test('reasonQuery: "có PT nào dạy giỏi không" → pt subject', async () => {
  const result = await reasonQuery({ query: 'có PT nào dạy giỏi không', memory: {}, language: 'vi' })
  assert.equal(result.subject, 'pt')
  assert.ok(result.needsTools.includes('getAvailablePTs'))
})

test('reasonQuery: "đọc ảnh này giúp tôi" → low confidence', async () => {
  const result = await reasonQuery({ query: 'đọc ảnh này giúp tôi', memory: {}, language: 'vi' })
  assert.ok(result.confidence <= 0.5 || result.subject === null)
})

test('reasonQuery: "tôi muốn đặt lịch với PT" → subject detected', async () => {
  const result = await reasonQuery({ query: 'tôi muốn đặt lịch với PT', memory: {}, language: 'vi' })
  assert.ok(result.subject)
})

// === Agent Memory Tests ===

test('agentMemory: creates and retrieves session', () => {
  const mem = agentMemory.get('user1', 'conv1')
  assert.ok(mem)
  assert.equal(mem.interactionCount, 0)
})

test('agentMemory: update stores fields', () => {
  agentMemory.update('user2', 'conv2', { lastSubject: 'plan', lastAction: 'info', lastMentionedPlanName: 'VIP' })
  const mem = agentMemory.get('user2', 'conv2')
  assert.equal(mem.lastSubject, 'plan')
  assert.equal(mem.lastAction, 'info')
  assert.equal(mem.lastMentionedPlanName, 'VIP')
  assert.equal(mem.interactionCount, 1)
})

test('agentMemory: different users have separate memory', () => {
  agentMemory.update('userA', 'convX', { lastSubject: 'workout' })
  agentMemory.update('userB', 'convX', { lastSubject: 'plan' })
  const memA = agentMemory.get('userA', 'convX')
  const memB = agentMemory.get('userB', 'convX')
  assert.equal(memA.lastSubject, 'workout')
  assert.equal(memB.lastSubject, 'plan')
})

test('agentMemory: clear removes session', () => {
  agentMemory.update('user3', 'conv3', { lastSubject: 'health' })
  agentMemory.clear('user3', 'conv3')
  const mem = agentMemory.get('user3', 'conv3')
  assert.equal(mem.interactionCount, 0)
})
