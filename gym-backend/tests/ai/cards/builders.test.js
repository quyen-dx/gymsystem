import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { all } from '../../../src/ai/ui/cardRegistry.js'

const builders = Object.fromEntries(all())

describe('walletCard', () => {
  const b = builders.wallet
  it('builds from balance result', () => {
    const c = b({ balance: 500000 })
    assert.equal(c.type, 'wallet')
    assert.ok(c.id.startsWith('card_wallet_'))
    assert.equal(c.title, 'Ví GymPro')
    assert.equal(c.icon, '💰')
    assert.equal(c.deeplink, '/wallet')
    assert.ok(c.actions.length >= 1)
    assert.ok(c.actions.some(a => a.type === 'view'))
    assert.ok(c.actions.some(a => a.type === 'pay'))
  })
  it('returns null on error', () => {
    assert.equal(b({ error: 'NO_DATA' }), null)
  })
  it('returns null without balance', () => {
    assert.equal(b({}), null)
  })
})

describe('membershipCard', () => {
  const b = builders.membership
  it('builds from membership result', () => {
    const c = b({ statusType: 'ACTIVE', currentMembership: { planName: 'Gói Tháng', remainingDays: 15 } })
    assert.equal(c.type, 'membership')
    assert.equal(c.status, 'ACTIVE')
    assert.equal(c.deeplink, '/my-membership')
    assert.ok(c.subtitle.includes('Gói Tháng'))
    assert.ok(c.actions.some(a => a.type === 'renew'))
  })
  it('returns null without currentMembership', () => {
    assert.equal(b({ statusType: 'ACTIVE' }), null)
  })
  it('returns null on error', () => {
    assert.equal(b({ error: 'INTERNAL_ERROR' }), null)
  })
})

describe('planCard', () => {
  const b = builders.plan
  it('builds from expiry result', () => {
    const c = b({ statusType: 'ACTIVE', planName: 'Gói Quý', remainingDays: 45 })
    assert.equal(c.type, 'plan')
    assert.equal(c.status, 'ACTIVE')
    assert.ok(c.subtitle.includes('Gói Quý'))
  })
  it('returns null without planName', () => {
    assert.equal(b({ statusType: 'ACTIVE' }), null)
  })
})

describe('bookingCard', () => {
  const b = builders.booking
  it('builds from booking result', () => {
    const c = b({ count: 2, bookings: [{ id: 'b1', ptName: 'A', date: '2026-01', slot: '08:00', status: 'confirmed' }] })
    assert.equal(c.type, 'booking')
    assert.equal(c.status, 'confirmed')
    assert.equal(c.deeplink, '/bookings')
    assert.ok(c.actions.some(a => a.type === 'book'))
  })
  it('returns null without bookings', () => {
    assert.equal(b({ count: 0 }), null)
  })
})

describe('notificationCard', () => {
  const b = builders.notification
  it('builds from count result', () => {
    const c = b({ count: 3 })
    assert.equal(c.type, 'notification')
    assert.equal(c.status, 'unread')
    assert.equal(c.deeplink, '/notifications')
  })
  it('excludes booking results (has bookings field)', () => {
    assert.equal(b({ count: 2, bookings: [] }), null)
  })
  it('returns null on error', () => {
    assert.equal(b({ error: 'X' }), null)
  })
})

describe('searchResultCard', () => {
  const b = builders.searchResult
  it('builds from web result', () => {
    const c = b({ answer: 'Kết quả tìm kiếm', sources: [{ title: 'Source', url: 'http://x.com' }] })
    assert.equal(c.type, 'searchResult')
    assert.ok(c.data.answer)
  })
  it('returns null without answer', () => {
    assert.equal(b({ sources: [] }), null)
  })
})

describe('generalInfoCard', () => {
  const b = builders.generalInfo
  it('builds from vector result', () => {
    const c = b({ success: true, documents: [{ title: 'Policy', content: 'Content here', category: 'policies' }] })
    assert.equal(c.type, 'generalInfo')
    assert.equal(c.subtitle, 'policies')
  })
  it('returns null on failed query', () => {
    assert.equal(b({ success: false, documents: [] }), null)
  })
})
