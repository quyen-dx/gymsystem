import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SUPPORTED_FORMATS, SUPPORTED_EXTENSIONS, MAX_FILE_SIZE,
  validateMimeType, validateExtension, validateFileSize,
  normalizeRequest, normalizeResponse, VISION_DECLARATION,
} from '../../../src/ai/tools/visionTool.js'

describe('visionTool validation', () => {
  it('validates supported mime types', () => {
    assert.ok(validateMimeType('image/jpeg'))
    assert.ok(validateMimeType('image/png'))
    assert.ok(validateMimeType('image/webp'))
    assert.equal(validateMimeType('image/gif'), false)
    assert.equal(validateMimeType('text/plain'), false)
  })

  it('validates supported extensions', () => {
    assert.ok(validateExtension('photo.jpg'))
    assert.ok(validateExtension('photo.jpeg'))
    assert.ok(validateExtension('photo.png'))
    assert.ok(validateExtension('photo.webp'))
    assert.equal(validateExtension('photo.gif'), false)
    assert.equal(validateExtension('photo.bmp'), false)
  })

  it('validates file size', () => {
    assert.ok(validateFileSize(1024))
    assert.ok(validateFileSize(MAX_FILE_SIZE))
    assert.equal(validateFileSize(MAX_FILE_SIZE + 1), false)
  })

  it('handles extensionless filenames', () => {
    assert.equal(validateExtension('file'), false)
    assert.equal(validateExtension(''), false)
  })

  it('normalizes request', () => {
    const file = { buffer: Buffer.from('test'), mimetype: 'image/png', originalname: 'test.png', size: 100 }
    const req = normalizeRequest(file)
    assert.equal(req.mimeType, 'image/png')
    assert.equal(req.originalName, 'test.png')
    assert.equal(req.size, 100)
    assert.ok(typeof req.imageData === 'string')
  })

  it('declaration has correct structure', () => {
    assert.equal(VISION_DECLARATION.name, 'visionAnalysis')
    assert.ok(VISION_DECLARATION.description)
    assert.ok(VISION_DECLARATION.parameters)
  })
})
