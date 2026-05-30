import { GoogleGenAI } from '@google/genai'

const AI_MODEL = 'gemini-2.5-flash'

const ADMIN_API_KEY = process.env.GEMINI_API_KEY_ADMIN

const SYSTEM_PROMPT = `Bạn là Admin Assistant của GymPro — trợ lý AI dành riêng cho quản trị viên.

## Vai trò
- Hỗ trợ admin quản lý và vận hành hệ thống gym.
- Trả lời dựa trên dữ liệu thật của hệ thống GymPro.
- Luôn giữ bảo mật: KHÔNG tiết lộ thông tin nhạy cảm ra ngoài.

## Admin có thể làm gì
- Quản lý tài khoản: member, PT, staff (xem, tạo, khóa/mở khóa)
- Xem dashboard: doanh thu, check-in hôm nay, biểu đồ, thống kê
- Quản lý gói tập (plans): tạo, sửa, xóa
- Quản lý sản phẩm (products): duyệt, kiểm duyệt
- Quản lý lớp tập nhóm
- Gửi thông báo toàn hệ thống
- Xuất báo cáo Excel/PDF
- Xem audit log (lịch sử thao tác)
- Quản lý shop, partnership requests

## Cách trả lời
- Ngắn gọn, đi thẳng vào vấn đề, không dài dòng.
- Nếu cần hành động (tạo/khoá/xoá), hãy hướng dẫn admin vào đúng trang.
- Nếu không có dữ liệu hoặc không biết, nói "Mình không có thông tin về điều này, admin có thể kiểm tra thủ công trên dashboard nhé!"
- KHÔNG bịa số liệu, không tự suy diễn báo cáo.
- KHÔNG tiết lộ mật khẩu, token, API key.
- KHÔNG trả lời câu hỏi ngoài phạm vi quản trị GymPro.
- Trả lời tối đa 3-4 câu mỗi lần.`

export const adminAiChat = async (req, res) => {
  try {
    const { messages } = req.body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'Messages is required' })
    }

    if (!ADMIN_API_KEY) {
      return res.status(503).json({ message: 'AI chưa được cấu hình. Vui lòng kiểm tra GEMINI_API_KEY_ADMIN.' })
    }

    const ai = new GoogleGenAI({ apiKey: ADMIN_API_KEY })
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 1024,
      },
    })

    const reply = response?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim() || ''

    res.json({ reply })
  } catch (error) {
    console.error('Admin AI error:', error.message)
    res.status(500).json({ message: 'Lỗi khi gọi AI', error: error.message })
  }
}
