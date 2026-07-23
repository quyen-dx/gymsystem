import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadMemory, updateMemory, buildMemoryPrompt, deleteMemory, store } from '../../../src/ai/memory/conversationMemory.js'

const uid = 'test-memory-uid'

beforeEach(() => { deleteMemory(uid) })
afterEach(() => { deleteMemory(uid) })

describe('conversationMemory', () => {
  it('returns null for non-existent memory', () => {
    assert.equal(loadMemory('nonexistent'), null)
  })

  it('stores and retrieves memory', () => {
    updateMemory(uid, 'Tôi cao 175cm', 'Đã ghi nhận 175cm')
    const m = loadMemory(uid)
    assert.ok(m)
    assert.equal(m.messageCount, 1)
  })

  it('does not store currentTopic', () => {
    updateMemory(uid, 'Tôi cao 175cm', 'OK')
    const m = loadMemory(uid)
    assert.ok(!('currentTopic' in m))
  })

  it('extracts entities with type/value/confidence', () => {
    updateMemory(uid, 'Tôi cao 175cm nặng 70kg', 'OK')
    const m = loadMemory(uid)
    assert.ok(Array.isArray(m.entities))
    assert.ok(m.entities.length >= 2)
    m.entities.forEach(e => {
      assert.ok('type' in e)
      assert.ok('value' in e)
      assert.equal(e.confidence, 1.0)
    })
  })

  it('deduplicates entities on merge', () => {
    updateMemory(uid, 'Tôi nặng 70kg', 'OK')
    updateMemory(uid, 'Tôi nặng 65kg', 'Đã cập nhật')
    const m = loadMemory(uid)
    const weights = m.entities.filter(e => e.type === 'weight')
    assert.equal(weights.length, 1)
    assert.equal(weights[0].value, '65kg')
  })

  it('persists entities across turns', () => {
    updateMemory(uid, 'Tôi cao 175cm', 'OK')
    updateMemory(uid, 'Tôi 25 tuổi', 'OK')
    const m = loadMemory(uid)
    assert.ok(m.entities.some(e => e.type === 'height'))
    assert.ok(m.entities.some(e => e.type === 'age'))
  })

  it('builds concise prompt', () => {
    updateMemory(uid, 'Tôi cao 175cm nặng 70kg', 'Đã ghi nhận thông tin của bạn.')
    const m = loadMemory(uid)
    const prompt = buildMemoryPrompt(m)
    assert.ok(prompt.includes('[BỐI CẢNH NGẮN GỌN]'))
    assert.ok(prompt.includes('height:175cm'))
    assert.ok(prompt.includes('weight:70kg'))
    assert.ok(prompt.length < 300)
  })

  it('returns empty prompt for greeting with no entities', () => {
    updateMemory(uid, 'Xin chào', 'Chào bạn!')
    const m = loadMemory(uid)
    assert.equal(buildMemoryPrompt(m), '')
  })

  it('summarizes after threshold', () => {
    for (let i = 1; i <= 6; i++) {
      updateMemory(uid, 'Gói tập tháng ' + i, 'Gói tháng giá 500k')
    }
    const m = loadMemory(uid)
    assert.ok(m.conversationSummary)
    assert.equal(m.messageCount, 6)
  })

  it('respects TTL expiration', () => {
    updateMemory(uid, 'test', 'ok')
    const m = loadMemory(uid)
    m.expiresAt = Date.now() - 1
    store.set(uid, m)
    assert.equal(loadMemory(uid), null)
  })

  it('does not store wallet/balance in entities', () => {
    updateMemory(uid, 'Số dư ví của tôi là 200k', 'Số dư 200k')
    const m = loadMemory(uid)
    const walletEntities = m.entities.filter(e => e.type === 'wallet' || e.type === 'balance')
    assert.equal(walletEntities.length, 0)
  })
})
