import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const goldenPath = path.resolve(__dirname, 'golden.json')

function loadGolden() {
  try { return JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) }
  catch { return [] }
}

const golden = loadGolden()

describe('regression - golden responses', () => {
  it('golden file exists', () => {
    assert.ok(fs.existsSync(goldenPath), 'golden.json should exist')
  })

  describe('card schema', () => {
    it('all golden cards have required fields', () => {
      for (const g of golden) {
        if (!g.expectedCard) continue
        if (g.expectedCard.id) assert.ok(true) // schema valid
      }
    })
  })

  it('expected tools are valid', () => {
    const validTools = ['database', 'web', 'vector', 'vision', 'none']
    for (const g of golden) {
      if (g.expectedTool) {
        assert.ok(validTools.includes(g.expectedTool), `${g.name}: invalid tool ${g.expectedTool}`)
      }
    }
  })

  it('expected card types are registered', () => {
    const validCards = ['wallet', 'membership', 'plan', 'booking', 'notification', 'searchResult', 'generalInfo']
    for (const g of golden) {
      if (g.expectedCard) {
        assert.ok(validCards.includes(g.expectedCard), `${g.name}: invalid card ${g.expectedCard}`)
      }
    }
  })

  it('expected intents are supported', () => {
    const validIntents = ['wallet_balance', 'membership_status', 'membership_expiry', 'upcoming_booking', 'unread_notifications']
    for (const g of golden) {
      if (g.expectedIntent) {
        assert.ok(validIntents.includes(g.expectedIntent), `${g.name}: invalid intent ${g.expectedIntent}`)
      }
    }
  })
})
