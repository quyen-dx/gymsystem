import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getAllDeclarations } from '../../../src/ai/utils/toolRegistry.js'

describe('toolRegistry', () => {
  it('has all 3 declarations', () => {
    const decls = getAllDeclarations()
    assert.equal(decls.length, 3)
    const names = decls.map(d => d.name)
    assert.ok(names.includes('databaseQuery'))
    assert.ok(names.includes('webQuery'))
    assert.ok(names.includes('vectorQuery'))
  })

  it('each declaration has name, description, parameters', () => {
    for (const d of getAllDeclarations()) {
      assert.ok(d.name)
      assert.ok(d.description)
      assert.ok(d.parameters)
      assert.ok(d.parameters.type === 'OBJECT')
    }
  })

  it('databaseQuery has all intents in enum', () => {
    const database = getAllDeclarations().find(d => d.name === 'databaseQuery')
    const intents = database.parameters.properties.intent.enum
    assert.ok(intents.includes('wallet_balance'))
    assert.ok(intents.includes('membership_status'))
    assert.ok(intents.includes('membership_expiry'))
    assert.ok(intents.includes('upcoming_booking'))
    assert.ok(intents.includes('unread_notifications'))
  })
})
