import assert from 'node:assert/strict'
import test from 'node:test'
import { getReasoningGuide } from './reasoningGuideService.js'

test('reasoningGuideService reads AI_GYMPRO_REASONING_MASTER.md', () => {
  const guide = getReasoningGuide()

  assert.equal(guide.loaded, true)
  assert.match(guide.path, /AI_GYMPRO_REASONING_MASTER\.md$/)
  assert.match(guide.content, /Database GymPro là nguồn sự thật cao nhất/)
  assert.match(guide.content, /Query Reasoner/)
})

test('nutrition guide includes web search and safety rules', () => {
  const guide = getReasoningGuide({ subject: 'nutrition' })

  assert.equal(guide.loaded, true)
  assert.match(guide.content, /Nutrition/)
  assert.match(guide.content, /Web Search Rule/)
  assert.match(guide.content, /Safety Rule/)
  assert.match(guide.content, /thay thế chỉ định bác sĩ/i)
})
