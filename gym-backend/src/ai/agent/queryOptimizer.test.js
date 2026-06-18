import assert from 'node:assert/strict'
import test from 'node:test'
import { optimizeQuery } from './queryOptimizer.js'

test('queryOptimizer routes simple plan count to direct tool', () => {
  const result = optimizeQuery({ query: 'có bao nhiêu gói tập', memory: {} })

  assert.equal(result.shouldUseAI, false)
  assert.equal(result.directTool, 'getAvailablePlans')
  assert.equal(result.subject, 'plan')
  assert.equal(result.action, 'count')
  assert.equal(result.reason, 'simple_database_query')
})

test('queryOptimizer routes cheapest and most expensive plan to direct tool', () => {
  const cheapest = optimizeQuery({ query: 'gói nào rẻ nhất', memory: {} })
  const expensive = optimizeQuery({ query: 'gói nào đắt nhất', memory: {} })

  assert.equal(cheapest.shouldUseAI, false)
  assert.equal(cheapest.directTool, 'getAvailablePlans')
  assert.equal(expensive.shouldUseAI, false)
  assert.equal(expensive.directTool, 'getAvailablePlans')
})

test('queryOptimizer routes PT count and top rating to direct tool', () => {
  const count = optimizeQuery({ query: 'có bao nhiêu PT', memory: {} })
  const top = optimizeQuery({ query: 'PT nào rating cao nhất', memory: {} })

  assert.equal(count.shouldUseAI, false)
  assert.equal(count.directTool, 'getAvailablePTs')
  assert.equal(top.shouldUseAI, false)
  assert.equal(top.directTool, 'getAvailablePTs')
})

test('queryOptimizer passes PT name to direct detail tool', () => {
  const result = optimizeQuery({ query: 'chi tiết PT cgpt 1', memory: {} })

  assert.equal(result.shouldUseAI, false)
  assert.equal(result.directTool, 'getAvailablePTs')
  assert.equal(result.action, 'detail')
  assert.equal(result.args.specialization, 'cgpt 1')
})

test('queryOptimizer keeps personalized recommendation for reasoning', () => {
  const result = optimizeQuery({ query: 'tôi muốn giảm cân với ngân sách 500k', memory: {} })

  assert.equal(result.shouldUseAI, true)
  assert.equal(result.directTool, null)
  assert.equal(result.reason, 'complex_personalized_query')
})

test('queryOptimizer resolves memory follow-up by entity id', () => {
  const result = optimizeQuery({
    query: 'người thứ 2',
    memory: {
      lastSubject: 'pt',
      lastListedPTs: [
        { id: 'pt1', name: 'Coach A' },
        { id: 'pt2', name: 'Coach B' },
      ],
    },
  })

  assert.equal(result.shouldUseAI, false)
  assert.equal(result.directTool, 'getAvailablePTs')
  assert.equal(result.reason, 'memory_entity_follow_up')
  assert.equal(result.targetEntity.id, 'pt2')
})
