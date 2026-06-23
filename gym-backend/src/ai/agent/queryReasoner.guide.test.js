import assert from 'node:assert/strict'
import test from 'node:test'
import { __queryReasonerTestHooks } from './queryReasoner.js'

const { buildReasonerSystemPrompt, buildUserPrompt, parseAiResult } = __queryReasonerTestHooks

test('queryReasoner prompt contains membership intent rules and constitution', () => {
  const prompt = buildReasonerSystemPrompt()

  assert.match(prompt, /MEMBERSHIP INTENT RULES/)
  assert.match(prompt, /membership_detail/)
  assert.match(prompt, /membership_list/)
  assert.match(prompt, /membership_recommendation/)
})

test('PT follow-up prompt includes memory entities for entity resolver', () => {
  const prompt = buildUserPrompt({
    query: 'người thứ 2 thì sao',
    memory: {
      lastSubject: 'pt',
      lastAction: 'list',
      lastListedPTs: [
        { id: 'pt1', name: 'cgpt 1' },
        { id: 'pt2', name: 'juan' },
      ],
    },
    conversationContext: {},
  })

  assert.match(prompt, /Previous context: subject=pt/)
  assert.match(prompt, /Available PTs from last list: 1\. cgpt 1, 2\. juan/)
})

test('plan follow-up prompt includes memory entities for entity resolver', () => {
  const prompt = buildUserPrompt({
    query: 'so sánh nó với premium',
    memory: {
      lastSubject: 'plan',
      lastAction: 'recommend',
      lastListedPlans: [
        { _id: 'basic', nameVi: 'Gói Cơ Bản' },
        { _id: 'premium', nameVi: 'Gói Premium' },
      ],
    },
    conversationContext: {},
  })

  assert.match(prompt, /Previous context: subject=plan/)
  assert.match(prompt, /Available Plans from last list: 1\. Gói Cơ Bản, 2\. Gói Premium/)
})

test('queryReasoner parses web search and clarification fields without dropping tools', () => {
  const parsed = parseAiResult(JSON.stringify({
    subject: 'nutrition',
    action: 'advice',
    intent: 'nutrition_advice',
    entities: {},
    confidence: 0.91,
    isFollowUp: false,
    followUpTarget: null,
    requiredTools: ['getRecommendedProducts', 'webSearchNutrition'],
    shouldUseWebSearch: true,
    shouldAskClarification: false,
    reasoning: 'Nutrition knowledge may need external sources.',
  }))

  assert.equal(parsed.subject, 'nutrition')
  assert.equal(parsed.action, 'advice')
  assert.equal(parsed.shouldUseWebSearch, true)
  assert.deepEqual(parsed.requiredTools, ['getRecommendedProducts', 'webSearchNutrition'])
})
