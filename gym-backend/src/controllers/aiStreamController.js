import { processStream } from '../ai/assistant/aiAssistantStreamService.js'

export const postChatStream = async (req, res) => {
  const { message } = req.body

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ message: 'Vui lòng nhập tin nhắn' })
  }

  if (message.length > 4096) {
    return res.status(400).json({ message: 'Tin nhắn không được vượt quá 4096 ký tự' })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  let aborted = false

  req.on('close', () => {
    aborted = true
  })

  try {
    const generator = processStream(message, req.user)

    for await (const event of generator) {
      if (aborted) break

      if (event.event === 'token') {
        res.write(`event: token\ndata: ${JSON.stringify({ text: event.text })}\n\n`)
      } else if (event.event === 'card') {
        res.write(`event: card\ndata: ${JSON.stringify(event.card)}\n\n`)
      } else if (event.event === 'suggestion') {
        res.write(`event: suggestion\ndata: ${JSON.stringify({ text: event.text })}\n\n`)
      } else if (event.event === 'deeplink') {
        res.write(`event: deeplink\ndata: ${JSON.stringify({ url: event.url })}\n\n`)
      } else if (event.event === 'action') {
        res.write(`event: action\ndata: ${JSON.stringify(event.action)}\n\n`)
      } else if (event.event === 'done') {
        res.write(`event: done\ndata: ${JSON.stringify({ reply: event.reply })}\n\n`)
      } else if (event.event === 'error') {
        res.write(`event: error\ndata: ${JSON.stringify({ message: event.message })}\n\n`)
      }
    }
  } catch (error) {
    console.error('[SSE] Stream error:', error.message)
    if (!aborted) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Đã xảy ra lỗi khi stream.' })}\n\n`)
    }
  }

  if (!aborted) {
    res.end()
  }
}
