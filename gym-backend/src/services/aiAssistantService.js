import { GoogleGenAI } from '@google/genai'

const GEMINI_FALLBACK_MESSAGE = 'Promp này quá mới -_-  Doraemon chưa cập nhật dữ liệu đó! '

const createGeminiClient = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const safeJsonParse = (text) => {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Không parse được JSON từ Gemini response')
    return JSON.parse(jsonMatch[0])
}

const normalizeGeminiError = (error) => {
    const status = error?.response?.status || error?.status || 500
    return { status, message: error?.message || 'Lỗi kết nối AI' }
}

const isGreetingQuery = (query) => /^(hi|hello|hey|chào|xin chào|alo)\b/i.test(query.trim())

const gymRelatedRegex = /(gym|tập|workout|cardio|dinh dưỡng|ăn|macro|protein|calo|calorie|supplement|whey|creatine|giảm cân|tăng cơ|tăng cân|sức khỏe|pt|huấn luyện|bài tập|cơ|mỡ|body|fitness|chạy|diet|meal|nutrition|health|exercise)/i

const isGymRelatedQuery = (query) => gymRelatedRegex.test(query)

const buildDefaultClassification = () => ({
    type: 'mixed',
    goal: 'không rõ',
    budget: 'unknown',
    keywords: [],
})

const generateGeminiText = async (prompt, maxOutputTokens = 180, temperature = 0.35) => {
    const geminiClient = createGeminiClient()
    const response = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        temperature,
        max_output_tokens: maxOutputTokens,
    })

    return response.text?.trim() || response.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export const classifyQueryIntent = async (query) => {
    if (!process.env.GEMINI_API_KEY) return buildDefaultClassification()

    const prompt = `Bạn là bộ phận phân tích truy vấn tìm kiếm GymSystem.
Trả về DUY NHẤT 1 object JSON với các trường sau:
{
  "type": "pt" | "product" | "plan" | "mixed",
  "goal": "tăng cân" | "giảm mỡ" | "tăng cơ" | "giảm cân" | "tăng sức mạnh" | "giảm stress" | "không rõ",
  "budget": "rẻ" | "cao cấp" | "bình thường" | "unknown",
  "keywords": ["..."]
}
Nếu không rõ, dùng "mixed" và "unknown".
Query: "${query}"`

    try {
        const geminiClient = createGeminiClient()
        const response = await geminiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            temperature: 0.2,
            max_output_tokens: 200,
        })

        const content = response.text?.trim() || response.candidates?.[0]?.content?.parts?.[0]?.text || ''
        try {
            return safeJsonParse(content)
        } catch {
            return buildDefaultClassification()
        }
    } catch (error) {
        console.error('Gemini classifyQueryIntent error:', error)
        const normalizedError = normalizeGeminiError(error)
        if (normalizedError.status === 429) return buildDefaultClassification()
        return buildDefaultClassification()
    }
}

export const generateAssistantResponse = async (query, pts, products, plans, mode = 'gym') => {
    if (!process.env.GEMINI_API_KEY) return GEMINI_FALLBACK_MESSAGE

    const normalizedMode = mode === 'general' ? 'general' : 'gym'
    const styleRules = `PHONG CÁCH BẮT BUỘC:
- Bạn là trợ lý AI của GymSystem, thân thiện kiểu Doraemon nhưng vẫn chuyên nghiệp.
- Không trả lời cụt ngủn. Với câu hỏi đơn giản, trả lời câu chính rồi thêm 1 câu cảm xúc nhẹ nếu phù hợp.
- Không lan man; ưu tiên 1 câu chính và 1 câu bổ sung nhẹ.
- Tự nhiên như người thật, không robot, không roleplay quá đà.
- Có thể dùng emoji nhẹ khi hợp ngữ cảnh.
- Nếu người dùng muốn tìm sản phẩm hoặc PT, backend đã gọi tool lấy dữ liệu thật trước khi vào prompt này.
- Không bịa sản phẩm, PT, giá, số điện thoại hoặc email.`

    if (normalizedMode === 'gym' && isGreetingQuery(query)) {
        return 'Chào bạn, mình là Doraemon AI của GymSystem đây! Hôm nay bạn muốn hỏi về tập luyện, dinh dưỡng hay cần mình hỗ trợ gì khác nào?'
    }

    if (normalizedMode === 'general') {
        const prompt = `Bạn là trợ lý AI đa năng của GymSystem.

Quy tắc:
- Trả lời trực tiếp vào câu hỏi.
- Có thể trả lời toán học, lập trình, đời sống, công nghệ và kiến thức chung.
- Không roleplay PT và không thêm nội dung gym nếu câu hỏi không liên quan.
- Nếu người dùng muốn tìm sản phẩm hoặc PT, backend đã gọi tool lấy dữ liệu thật trước khi vào prompt này.
- Không bịa sản phẩm, PT, giá, số điện thoại hoặc email.
- Trả lời bằng tiếng Việt, rõ ràng, logic, ngắn gọn nhưng đủ ý.

${styleRules}

Câu hỏi: "${query}"`

        try {
            const text = await generateGeminiText(prompt, 260, 0.35)
            return text.trim() || 'Mình chưa có câu trả lời phù hợp.'
        } catch (error) {
            console.error('Gemini generateAssistantResponse general mode error:', error)
            return GEMINI_FALLBACK_MESSAGE
        }
    }

    if (!isGymRelatedQuery(query)) {
        const prompt = `Bạn là trợ lý AI của GymSystem ở chế độ gym.

Quy tắc:
- Câu hỏi hiện tại không liên quan trực tiếp đến gym, tập luyện, dinh dưỡng hoặc sức khỏe.
- Vẫn trả lời câu hỏi hợp lệ thật ngắn gọn trong 1-2 câu, đúng trọng tâm.
- Không ép người dùng quay về gym nếu câu hỏi không liên quan gym.
- Không nói "ngoài chuyên môn" và không từ chối.
- Nếu người dùng muốn tìm sản phẩm hoặc PT, backend đã gọi tool lấy dữ liệu thật trước khi vào prompt này.
- Không bịa sản phẩm, PT, giá, số điện thoại hoặc email.
- Trả lời bằng tiếng Việt.

${styleRules}

Câu hỏi: "${query}"`

        try {
            const text = await generateGeminiText(prompt, 180, 0.25)
            return text.trim() || 'Mình chưa có câu trả lời phù hợp. Bạn thử hỏi lại rõ hơn một chút nhé.'
        } catch (error) {
            console.error('Gemini generateAssistantResponse gym short mode error:', error)
            return GEMINI_FALLBACK_MESSAGE
        }
    }

    const buildSummary = (items, label, fields) => {
        if (!items || items.length === 0) return `${label}: không tìm thấy kết quả phù hợp.`
        return `${label}: ${items
            .slice(0, 4)
            .map((item) => fields.map((field) => item[field]).filter(Boolean).join(' • '))
            .join(' | ')}`
    }

    const context = [
        buildSummary(pts, 'PT phù hợp', ['name', 'specialties', 'rating', 'experienceYears']),
        buildSummary(products, 'Sản phẩm gợi ý', ['name', 'category', 'price']),
        buildSummary(plans, 'Gói tập gợi ý', ['name', 'durationDays', 'price']),
    ].join('\n')

    const prompt = `Bạn là một Huấn luyện viên cá nhân (PT) nhiệt tình, thân thiện và chuyên nghiệp cho GymSystem.

Phong cách trả lời:
- Sử dụng giọng nói khích lệ, gần gũi nhưng vẫn chuyên nghiệp.
- Không bao giờ yêu cầu người dùng nhập thêm từ khóa nếu họ chỉ chào hỏi.
- Luôn gợi ý hành động tiếp theo rõ ràng và hữu ích.
- Trả lời bằng tiếng Việt, dễ hiểu, không quá máy móc.

${styleRules}

Dữ liệu tìm được từ hệ thống:
${context}

Nội dung trả lời:
- Nếu có kết quả phù hợp, đề xuất phương án rõ ràng.
- Nếu không có dữ liệu phù hợp, hãy khuyến khích người dùng thử câu hỏi khác hoặc gợi ý bước tiếp theo.
- Không chia sẻ thông tin cá nhân của người dùng khác.

Câu hỏi: "${query}"`

    try {
        const geminiClient = createGeminiClient()
        const response = await geminiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            temperature: 0.35,
            max_output_tokens: 180,
        })

        const text = response.text?.trim() || response.candidates?.[0]?.content?.parts?.[0]?.text || ''
        return text.trim() || 'Mình không tìm thấy kết quả phù hợp.'
    } catch (error) {
        console.error('Gemini generateAssistantResponse error:', error)
        return GEMINI_FALLBACK_MESSAGE
    }
}
