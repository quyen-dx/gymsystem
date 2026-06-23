import AppError from '../utils/appError.js'
import { runGymAiAction } from './services/aiService.js'

export const aiController = async (req, res, next) => {
  try {
    const { query, conversationContext } = req.body
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return next(new AppError('Vui lòng nhập câu hỏi', 400))
    }

    const payload = await runGymAiAction({
      query: query.trim(),
      user: req.user,
      conversationContext,
    })

    let output = payload
    if (typeof output === 'string') {
      try {
        output = JSON.parse(output)
      } catch {
        output = { answer: output }
      }
    }

    if (typeof output?.answer === 'string') {
      const maybeNested = output.answer.trim()
      if (maybeNested.startsWith('{')) {
        try {
          const nested = JSON.parse(maybeNested)
          if (nested?.answer) output = { ...output, ...nested }
        } catch { }
      }
    }

    return res.json({
      ...output,
      intent: output.intent || 'gym',
      type: output.type || 'text',
      answer: output.answer || (typeof output === 'string' ? output : String(output.text || output.message || output))
    })
  } catch (error) {
    return next(error)
  }
}

export const aiService = runGymAiAction
