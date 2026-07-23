const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp']
const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

const MAX_FILE_SIZE = 5 * 1024 * 1024

const VISION_DECLARATION = {
  name: 'visionAnalysis',
  description: 'Phân tích hình ảnh. Hệ thống tự xác định loại hình ảnh và phản hồi phù hợp.',
  parameters: {
    type: 'OBJECT',
    properties: {},
  },
}

function validateMimeType(mimeType) {
  return SUPPORTED_FORMATS.includes(mimeType)
}

function validateExtension(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase()
  return ext ? SUPPORTED_EXTENSIONS.includes(ext) : false
}

function validateFileSize(size) {
  return size <= MAX_FILE_SIZE
}

function normalizeRequest(file) {
  return {
    imageData: file.buffer.toString('base64'),
    mimeType: file.mimetype,
    originalName: file.originalname,
    size: file.size,
  }
}

function normalizeResponse(aiResponse) {
  const raw = aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || ''

  let parsed = null
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    }
  } catch {
    parsed = null
  }

  return {
    source: 'vision',
    imageCategory: parsed?.imageCategory || 'general',
    summary: parsed?.summary || '',
    confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0,
    response: parsed?.response || raw,
    suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions : [],
    raw,
  }
}

export {
  SUPPORTED_FORMATS,
  SUPPORTED_EXTENSIONS,
  MAX_FILE_SIZE,
  VISION_DECLARATION,
  validateMimeType,
  validateExtension,
  validateFileSize,
  normalizeRequest,
  normalizeResponse,
}
