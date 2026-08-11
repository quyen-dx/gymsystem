import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { processStream } from '../../../src/ai/assistant/aiAssistantStreamService.js'

describe('streaming events', () => {
  it('processStream is an async generator', () => {
    assert.equal(processStream.constructor.name, 'AsyncGeneratorFunction')
  })

  it('emits events with correct shape when unavailable', async () => {
    const user = { _id: 'test-stream', role: 'member', fullName: 'Test' }
    const events = []
    for await (const ev of processStream('Xin chao', user, { chatAvailable: () => false })) {
      events.push(ev)
    }
    assert.ok(events.some(e => e.event === 'done' || e.event === 'error'))
  })
})
