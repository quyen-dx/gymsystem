import { runAIWithFallback } from './aiFallbackService.js'

const REWRITE_ENABLED = process.env.NATURAL_RESPONSE_REWRITE !== 'false'

const ELIGIBLE_SUBJECTS = ['checkin', 'membership', 'nutrition', 'progress', 'workout', 'pt', 'health']

const INELIGIBLE_PATTERNS = [
  /\b(không có quyền|truy cập|forbidden|permission denied|bị tắt|đã tắt)\b/i,
  /\b(lỗi hệ thống|system error|có vấn đề|thất bại|failed|error)\b/i,
  /\b(bấm vào|vào trang|mở mục|vào mục|tại trang)\b/i,
]

const REWRITE_SYSTEM_PROMPT = `Bạn là GymPro AI - trợ lý tập luyện cá nhân tại phòng GymPro.

Nhiệm vụ của bạn: VIẾT LẠI câu trả lời AI bên dưới cho TỰ NHIÊN và THÂN THIỆN hơn.

## QUY TẮC TUYỆT ĐỐI (không được vi phạm):

1. GIỮ NGUYÊN tất cả số liệu, ngày tháng, tên gói, trạng thái, giá cả. KHÔNG thay đổi bất kỳ con số hay tên riêng nào.
2. KHÔNG thêm dữ liệu mới, không bịa thông tin, không thêm lời khuyên y tế.
3. KHÔNG đổi ý nghĩa câu trả lời gốc.
4. Giữ nguyên ngôn ngữ (tiếng Việt giữ tiếng Việt, tiếng Anh giữ tiếng Anh).
5. Viết 2-5 câu, tự nhiên như đang nói chuyện với bạn tập hoặc PT cá nhân.
6. Dùng giọng thân thiện, khích lệ, gần gũi.
7. Nếu câu gốc là câu hỏi hoặc lời đề nghị (như "Bạn muốn...?"), hãy giữ lại ý đó.
8. KHÔNG lặp lại nguyên văn câu gốc - hãy diễn đạt lại bằng cách khác.

## Định dạng đầu ra:
Chỉ trả về câu trả lời đã viết lại. Không kèm giải thích, không kèm nhãn.`

const ineligibleByPattern = (answer) => INELIGIBLE_PATTERNS.some((pattern) => pattern.test(answer))

const validateRewrite = (original, rewritten) => {
  if (!rewritten || rewritten.length < 15) return false

  const numbers = original.match(/\d+[\d,.\s]*(?:đ|₫|vnd|vnđ|ngày|ngay|tháng|thang|năm|nam|lần|lan|buổi|buoi|người|nguoi|điểm|diem)?/gi)
  if (numbers) {
    const rewrittenText = rewritten
    const allFound = numbers.every((num) => {
      const cleaned = num.replace(/[.,\s]/g, '')
      return rewrittenText.includes(cleaned) || rewrittenText.includes(num)
    })
    if (!allFound) return false
  }

  const planNames = original.match(/Gói\s+[A-ZÀ-Ỹ0-9][\wÀ-ỹ0-9\s-]{1,40}/g)
  if (planNames) {
    const allFound = planNames.every((name) => rewritten.includes(name))
    if (!allFound) return false
  }

  return true
}

export async function naturalResponseRewrite({ answer, query, subject, lang } = {}) {
  if (!REWRITE_ENABLED) return answer
  if (!answer || answer.length < 15) return answer
  if (!ELIGIBLE_SUBJECTS.includes(subject)) return answer
  if (ineligibleByPattern(answer)) return answer

  const userPrompt = [
    `=== CÂU HỎI GỐC ===`,
        query || '(không có)',
    ``,
    `=== CHỦ ĐỀ ===`,
        subject || 'general',
    ``,
    `=== CÂU TRẢ LỜI CẦN VIẾT LẠI ===`,
        answer,
    ``,
    `=== YÊU CẦU ===`,
        `Viết lại câu trả lời trên cho tự nhiên và thân thiện hơn.`,
        `GIỮ NGUYÊN số liệu, tên, ngày tháng. KHÔNG thêm dữ liệu.`,
        `Viết ${lang === 'en' ? 'tiếng Anh' : 'tiếng Việt'}.`,
        `Dài 2-5 câu.`,
  ].join('\n')

  try {
    const result = await runAIWithFallback({
      systemPrompt: REWRITE_SYSTEM_PROMPT,
      userMessage: userPrompt,
    }, { temperature: 0.5, maxTokens: 400, timeoutMs: 6000 })

    const rewritten = (result.text || '').trim()
    if (!validateRewrite(answer, rewritten)) return answer
    return rewritten
  } catch {
    return answer
  }
}
