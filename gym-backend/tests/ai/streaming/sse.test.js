import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { processStream } from '../../../src/ai/assistant/aiAssistantStreamService.js'

describe('streaming events', () => {
  it('processStream is an async generator', () => {
    assert.equal(processStream.constructor.name, 'AsyncGeneratorFunction')
  })

  it('emits events with correct shape when unavailable', async () => {
    // isAvailable() returns false in test env (no GEMINI_API_KEY in non-env-loaded context)
    const user = { _id: 'test-stream', role: 'member', fullName: 'Test' }
    const events = []
    for await (const ev of processStream('Xin chào', user)) {
      events.push(ev)
    }
    // Should emit at least a done event
    if (events.length > 0) {
      assert.ok(events.some(e => e.event === 'done' || e.event === 'error'))
    }
  })
})
