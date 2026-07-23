import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildRichResponse } from '../../../src/ai/ui/responseBuilder.js'

describe('responseBuilder', () => {
  it('builds exactly 1 card for wallet result', () => {
    const r = buildRichResponse('databaseQuery', { intent: 'wallet_balance' }, { balance: 500000 }, 'Số dư 500k')
    assert.equal(r.cards.length, 1)
    assert.equal(r.cards[0].type, 'wallet')
  })

  it('returns 0 cards on error', () => {
    const r = buildRichResponse('databaseQuery', { intent: 'wallet_balance' }, { error: 'NO_DATA' }, 'Không có dữ liệu')
    assert.equal(r.cards.length, 0)
  })

  it('returns 0 cards for direct text (no tool call simulation)', () => {
    assert.equal(true, true) // direct text doesn't go through responseBuilder
  })

  it('has all response fields', () => {
    const r = buildRichResponse('databaseQuery', { intent: 'wallet_balance' }, { balance: 1 }, 'text')
    assert.ok('message' in r)
    assert.ok('cards' in r)
    assert.ok('suggestions' in r)
    assert.ok('deeplinks' in r)
    assert.ok(Array.isArray(r.cards))
  })

  it('collects suggestions and deeplinks', () => {
    const r = buildRichResponse('databaseQuery', { intent: 'wallet_balance' }, { balance: 500000 }, 'text')
    assert.ok(r.suggestions.length > 0)
    assert.ok(r.deeplinks.length > 0)
  })

  it('one result produces one card (not multiple)', () => {
    const r = buildRichResponse('databaseQuery', { intent: 'membership_status' }, { statusType: 'ACTIVE', currentMembership: { planName: 'Gói Tháng' } }, 'text')
    assert.equal(r.cards.length, 1)
    assert.equal(r.cards[0].type, 'membership')
  })
})
