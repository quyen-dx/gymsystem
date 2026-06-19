import assert from 'node:assert/strict'
import test from 'node:test'
import { AI_DOC_FILES, getAiDocSections, getRelevantAiDocs } from './aiDocsService.js'

test('aiDocsService loads relevant plan docs without full markdown dump', () => {
  const docs = getRelevantAiDocs({
    subject: 'plan',
    action: 'list',
    intent: 'plan_list',
    responseType: 'plan_list',
    maxChars: 6000,
  })

  assert.equal(docs.loaded, true)
  assert.ok(docs.loadedFiles.includes(AI_DOC_FILES.master))
  assert.ok(docs.loadedFiles.includes(AI_DOC_FILES.render))
  assert.match(docs.content, /Plan|Danh sách gói|Plan List/)
  assert.ok(docs.content.length <= 6000 + 80)
})

test('aiDocsService fails softly when a doc is missing', () => {
  const doc = getAiDocSections({
    fileName: 'MISSING_AI_DOC.md',
    sections: ['Anything'],
  })

  assert.equal(doc.loaded, false)
  assert.equal(doc.content, '')
  assert.match(doc.error, /ENOENT|no such file|cannot find/i)
})
