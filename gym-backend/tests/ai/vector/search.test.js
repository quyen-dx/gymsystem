import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { vectorQuery, VECTOR_QUERY_DECLARATION } from '../../../src/ai/tools/vectorTool.js'

describe('vectorTool', () => {
  it('returns error for empty query', async () => {
    const r = await vectorQuery('')
    assert.equal(r.success, false)
    assert.equal(r.metadata.error, 'INVALID_QUERY')
    assert.equal(r.source, 'vector')
  })

  it('has correct declaration', () => {
    assert.equal(VECTOR_QUERY_DECLARATION.name, 'vectorQuery')
    assert.ok(VECTOR_QUERY_DECLARATION.parameters.properties.query)
    assert.ok(VECTOR_QUERY_DECLARATION.parameters.required.includes('query'))
  })

  it('returns standardized response schema', async () => {
    const r = await vectorQuery('')
    assert.ok('source' in r)
    assert.ok('success' in r)
    assert.ok('documents' in r)
    assert.ok('suggestions' in r)
    assert.ok('metadata' in r)
  })

  it('searches successfully', async () => {
    const r = await vectorQuery('Chính sách hoàn tiền')
    assert.equal(r.success, true)
    assert.ok(r.documents.length > 0)
    assert.ok(r.documents[0].title)
    assert.ok(r.documents[0].score > 0)
  })
})
