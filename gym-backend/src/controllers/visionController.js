import {
  validateMimeType,
  validateExtension,
  validateFileSize,
  normalizeRequest,
  normalizeResponse,
  MAX_FILE_SIZE,
  SUPPORTED_EXTENSIONS,
} from '../ai/tools/visionTool.js'
import { getVisionPrompt } from '../ai/utils/visionConfig.js'
import { analyzeImage } from '../ai/providers/visionProvider.js'

const DEFAULT_PROMPT = getVisionPrompt()

export const postVision = async (req, res) => {
  try {
    const file = req.file

    if (!file) {
      return res.status(400).json({ message: 'Vui lòng gửi kèm hình ảnh.' })
    }

    if (!validateMimeType(file.mimetype)) {
      return res.status(400).json({
        message: `Định dạng không hỗ trợ. Chấp nhận: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      })
    }

    if (!validateExtension(file.originalname)) {
      return res.status(400).json({
        message: `Phần mở rộng không hợp lệ. Chấp nhận: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      })
    }

    if (!validateFileSize(file.size)) {
      return res.status(400).json({
        message: `Kích thước file tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      })
    }

    const request = normalizeRequest(file)
    const customPrompt = req.body.prompt || DEFAULT_PROMPT

    const aiResponse = await analyzeImage({
      imageData: request.imageData,
      mimeType: request.mimeType,
      prompt: customPrompt,
    })

    const result = normalizeResponse(aiResponse)

    return res.json({
      source: 'vision',
      imageCategory: result.imageCategory,
      summary: result.summary,
      confidence: result.confidence,
      response: result.response,
      suggestions: result.suggestions,
      analysis: result.response,
      fileName: request.originalName,
      fileSize: request.size,
    })
  } catch (error) {
    console.error('[AI][Vision] Error:', error.message)
    return res.status(500).json({
      source: 'vision',
      imageCategory: 'general',
      summary: '',
      confidence: 0,
      response: 'Đã xảy ra lỗi khi phân tích hình ảnh.',
      suggestions: [],
      analysis: 'Đã xảy ra lỗi khi phân tích hình ảnh.',
    })
  }
}
