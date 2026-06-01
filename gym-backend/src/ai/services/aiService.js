import { GoogleGenAI } from '@google/genai'
import { gymToolDeclarations, runGymTool } from '../tools/gymTools.js'

const memberKeys = [
  process.env.GEMINI_API_KEY_MEMBE_1,
  process.env.GEMINI_API_KEY_MEMBE_2,
  process.env.GEMINI_API_KEY_MEMBE_3,
  process.env.GEMINI_API_KEY_MEMBE_4,
  process.env.GEMINI_API_KEY_MEMBE_5,
].filter(Boolean)

let memberKeyIndex = 0

const createGeminiClient = (keyIndex) => new GoogleGenAI({ apiKey: memberKeys[keyIndex] })

async function callGeminiWithKeyRotation(contents, config) {
  for (let i = 0; i < memberKeys.length; i++) {
    const idx = (memberKeyIndex + i) % memberKeys.length
    try {
      const client = createGeminiClient(idx)
      const res = await client.models.generateContent({ contents, config })
      memberKeyIndex = idx
      return res
    } catch (err) {
      if (err?.status === 429 || err?.code === 429) continue
      throw err
    }
  }
  throw new Error('Tất cả API key member đã hết quota')
}

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

const buildGymProPrompt = ({ user, conversationContext }) => `
## Vai trò

Bạn là Doraemon — trợ lý ảo thân thiện của GymPro dành cho hội viên (member). Chỉ trả lời các câu hỏi liên quan đến trải nghiệm cá nhân của member trong GymPro. Tính cách: vui vẻ, ngắn gọn, dùng emoji, tối đa 3-4 câu.

---

## Được phép trả lời

✅ Check-in: xem QR cá nhân, QR tự refresh 30 giây
✅ Đặt lịch PT: chọn PT → xem lịch trống → đặt → hủy
✅ Lộ trình tập: xem lịch tập, bấm start buổi tập, timer đếm ngược
✅ Sức khoẻ: nhập cân nặng, số đo, xem chart BMI
✅ Cửa hàng: xem sản phẩm, mua, đánh giá
✅ Ví & thanh toán: nạp tiền QR, nạp Visa/Card, xem số dư, lịch sử giao dịch
✅ Thông báo: xem thông báo từ hệ thống
✅ Giao diện: đổi màu, dark/light mode, ngôn ngữ VI/EN
✅ Tài khoản cá nhân: đổi ảnh đại diện, ảnh bìa, thông tin cá nhân, địa chỉ

## Bảo mật tài khoản — Trả lời an toàn

✅ Hướng dẫn đổi mật khẩu: vào Profile → Đổi mật khẩu
✅ Quên mật khẩu: trang đăng nhập → Quên mật khẩu → nhập email/SĐT → nhận OTP
✅ Đăng xuất: bấm avatar → Đăng xuất
✅ Nhắc người dùng KHÔNG chia sẻ mật khẩu với bất kỳ ai kể cả staff
✅ Nếu nghi bị hack: đổi mật khẩu ngay + liên hệ staff tại quầy

❌ KHÔNG hỗ trợ đăng nhập hộ
❌ KHÔNG xác nhận email/SĐT của người dùng qua chat

## Khi bị hỏi về thông tin tài khoản người khác

Chỉ trả lời đúng 1 câu, KHÔNG giải thích gì thêm: "Mình không thể cung cấp thông tin tài khoản của người khác để bảo vệ quyền riêng tư nhé! 🔒"

## Tuyệt đối KHÔNG trả lời

❌ Doanh thu, doanh số, báo cáo tài chính
❌ Thông tin member khác
❌ Số lượng member toàn hệ thống
❌ Thông tin nội bộ staff/admin
❌ Câu hỏi ngoài GymPro

Nếu hỏi những điều trên: "Mình không có thông tin về điều này. Bạn cần hỗ trợ thêm thì liên hệ staff tại quầy nhé! 😊"
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
  const systemPrompt = buildGymProPrompt({ user, conversationContext })
  const contents = [
    {
      role: 'user',
      parts: [{ text: `${systemPrompt}\n\nCâu hỏi user: ${query}` }],
    },
  ]

  return callGeminiWithKeyRotation(contents, {
    model: 'gemini-2.5-flash',
    temperature: 0.2,
    maxOutputTokens: 900,
    tools: [{ functionDeclarations: gymToolDeclarations }],
  })
}

const finishWithToolResult = async ({ query, user, conversationContext, functionCall, toolResult }) => {
  const systemPrompt = buildGymProPrompt({ user, conversationContext })

  const response = await callGeminiWithKeyRotation(
    [
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
    {
      model: 'gemini-2.5-flash',
      temperature: 0.25,
      maxOutputTokens: 900,
    },
  )

  return getResponseText(response)
}

export const runGymAiAction = async ({ query, user, conversationContext }) => {
  if (memberKeys.length === 0) {
    return buildFallbackGymAnswer('Backend chưa cấu hình API key cho member AI.')
  }

  const firstResponse = await callGeminiWithTools({ query, user, conversationContext })
  const functionCalls = getFunctionCalls(firstResponse)

  if (functionCalls.length === 0) {
    const answer = getResponseText(firstResponse)
    return {
      answer: answer || 'Ở Gym Mode, mình chỉ trả lời dựa trên dữ liệu GymPro. Bạn hãy hỏi về gói tập, PT, lịch tập hoặc sản phẩm gym nhé.',
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
    answer: answer || 'Mình đã xử lý yêu cầu bằng dữ liệu thật từ GymPro.',
    mode: 'gym',
    tool: functionCall.name,
    data: toolResult,
    aiAction: true,
  }
}
