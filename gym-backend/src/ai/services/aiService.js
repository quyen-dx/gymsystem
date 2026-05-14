import { GoogleGenAI } from '@google/genai'
import { gymToolDeclarations, runGymTool } from '../tools/gymTools.js'

const createGeminiClient = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const getResponseText = (response) => {
  if (typeof response?.text === 'string') return response.text.trim()
  return response?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim() || ''
}

const getFunctionCalls = (response) => {
  if (Array.isArray(response?.functionCalls) && response.functionCalls.length > 0) {
    return response.functionCalls
  }

  return response?.candidates?.[0]?.content?.parts
    ?.map((part) => part.functionCall)
    .filter(Boolean) || []
}

const buildGymSystemPrompt = ({ user, conversationContext }) => `
Bạn là Gym Assistant của GymSystem.

Luật Gym Mode:
- Chỉ trả lời các nội dung liên quan gym, gói tập, PT, booking, sản phẩm shop, dinh dưỡng và tập luyện.
- Khi user hỏi về các gói tập (plans), bảng giá (pricing), hoặc danh sách membership đang có, BẮT BUỘC dùng tool getAvailablePlans.
- Khi user hỏi về gói tập hiện tại của chính họ (remaining days, my plan), dùng getMembershipInfo.
- KHÔNG ĐƯỢC trả lời "Tôi chỉ có thể kiểm tra thông tin gói tập hiện tại của bạn" khi user hỏi về danh sách gói tập chung. Hãy gọi getAvailablePlans.
- Khi câu hỏi cần dữ liệu thật, bắt buộc dùng tool. Không bịa dữ liệu.
- Không đọc hoặc suy đoán dữ liệu của user khác.
- Nếu thiếu thông tin để tạo booking, hỏi lại ngắn gọn phần còn thiếu.
- Nếu user muốn đặt lịch nhưng chưa chọn PT cụ thể, hãy gọi getAvailablePTs trước rồi gợi ý PT.
- Ngày hiện tại: ${new Date().toISOString().slice(0, 10)}.
- Role user hiện tại: ${user?.role || 'member'}.
- User hiện tại: ${user?.name || 'Người dùng'}.

Context gần nhất:
${conversationContext ? JSON.stringify(conversationContext).slice(0, 1200) : '{}'}
`

const buildFallbackGymAnswer = (message) => ({
  answer: message,
  mode: 'gym',
  tool: null,
  data: null,
})

const callGeminiWithTools = async ({ query, user, conversationContext }) => {
  const client = createGeminiClient()
  const systemPrompt = buildGymSystemPrompt({ user, conversationContext })
  const contents = [
    {
      role: 'user',
      parts: [{ text: `${systemPrompt}\n\nCâu hỏi user: ${query}` }],
    },
  ]

  return client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      temperature: 0.2,
      maxOutputTokens: 900,
      tools: [{ functionDeclarations: gymToolDeclarations }],
    },
  })
}

const finishWithToolResult = async ({ query, user, conversationContext, functionCall, toolResult }) => {
  const client = createGeminiClient()
  const systemPrompt = buildGymSystemPrompt({ user, conversationContext })

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nCâu hỏi user: ${query}` }],
      },
      {
        role: 'model',
        parts: [{ functionCall }],
      },
      {
        role: 'user',
        parts: [{
          functionResponse: {
            name: functionCall.name,
            response: { result: toolResult },
          },
        }],
      },
    ],
    config: {
      temperature: 0.25,
      maxOutputTokens: 900,
    },
  })

  return getResponseText(response)
}

export const runGymAiAction = async ({ query, user, conversationContext }) => {
  if (!process.env.GEMINI_API_KEY) {
    return buildFallbackGymAnswer('Backend chưa cấu hình GEMINI_API_KEY nên Gym Assistant chưa thể gọi AI Action.')
  }

  const firstResponse = await callGeminiWithTools({ query, user, conversationContext })
  const functionCalls = getFunctionCalls(firstResponse)

  if (functionCalls.length === 0) {
    const answer = getResponseText(firstResponse)
    return {
      answer: answer || 'Ở Gym Mode, mình chỉ trả lời dựa trên dữ liệu GymSystem. Bạn hãy hỏi về gói tập, PT, lịch tập hoặc sản phẩm gym nhé.',
      mode: 'gym',
      tool: null,
      data: null,
    }
  }

  const functionCall = functionCalls[0]
  const toolResult = await runGymTool(functionCall.name, functionCall.args || {}, {
    userId: user._id,
    role: user.role,
  })

  const answer = await finishWithToolResult({
    query,
    user,
    conversationContext,
    functionCall,
    toolResult,
  })

  return {
    answer: answer || 'Mình đã xử lý yêu cầu bằng dữ liệu thật từ GymSystem.',
    mode: 'gym',
    tool: functionCall.name,
    data: toolResult,
    aiAction: true,
  }
}
