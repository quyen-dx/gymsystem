import { gymProAgent } from './agent/gymProAgent.js'

export const aiController = async (req, res, next) => {
  try {
    const { query, conversationContext } = req.body
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ answer: 'Vui lòng nhập câu hỏi' })
    }

    const result = await gymProAgent({
      query: query.trim(),
      user: req.user,
      conversationContext,
      language: 'vi',
    })

    return res.json({
      answer: result?.answer || '',
      intent: result?.intent || 'gym',
      type: result?.responseType || 'text',
      suggestions: result?.suggestions || [],
    })
  } catch (error) {
    console.error('[AI_CONTROLLER] error:', error.message)
    return res.json({
      answer: 'Xin lỗi, mình gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại.',
      intent: 'unknown',
      type: 'text',
    })
  }
}
