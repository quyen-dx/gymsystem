import { process as aiProcess } from '../services/aiAssistantService.js'

export const postChat = async (req, res) => {
  try {
    const { message } = req.body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Vui lòng nhập tin nhắn' })
    }

    if (message.length > 4096) {
      return res.status(400).json({ message: 'Tin nhắn không được vượt quá 4096 ký tự' })
    }

    const result = await aiProcess(message, req.user)
    const reply = typeof result === 'string' ? result : result.message || result
    return res.json({
      reply,
      cards: result.cards || [],
      suggestions: result.suggestions || [],
      deeplinks: result.deeplinks || [],
      actions: result.actions || [],
    })
  } catch (error) {
    console.error('AI Chat error:', error)
    return res.status(500).json({ message: 'Đã xảy ra lỗi, vui lòng thử lại sau.' })
  }
}
