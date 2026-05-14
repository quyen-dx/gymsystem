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

    return res.json(payload)
  } catch (error) {
    return next(error)
  }
}

export const aiService = runGymAiAction
