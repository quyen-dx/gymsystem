import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getRegistered } from '../../../src/ai/ui/cardRegistry.js'

describe('cardRegistry', () => {
  it('lists 7 registered types', () => {
    const names = getRegistered()
    assert.ok(names.includes('wallet'))
    assert.ok(names.includes('membership'))
    assert.ok(names.includes('plan'))
    assert.ok(names.includes('booking'))
    assert.ok(names.includes('notification'))
    assert.ok(names.includes('searchResult'))
    assert.ok(names.includes('generalInfo'))
    assert.equal(names.length, 7, 'exactly 7 card types registered')
  })
})
