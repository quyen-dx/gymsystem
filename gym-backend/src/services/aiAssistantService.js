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

const normalizePromptText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()

const SYSTEM_THEME_PRESETS = [
    { themeName: 'cyberpunk', color: '#ff00ff', keywords: ['cyberpunk', 'cyber punk'] },
    { themeName: 'gym_dark', color: '#991b1b', keywords: ['dark gym', 'gym dark', 'gym toi', 'tone gym', 'mau gym', 'phong gym', 'gym'] },
    { themeName: 'minimal_light', color: '#ffffff', keywords: ['minimal light', 'toi gian sang', 'trang toi gian', 'light minimal'] },
    { themeName: 'ocean_blue', color: '#0ea5e9', keywords: ['ocean blue', 'bien', 'dai duong', 'xanh bien', 'xanh nuoc bien'] },
    { themeName: 'sunset', color: '#f97316', keywords: ['sunset', 'hoang hon', 'chieu ta'] },
    { themeName: 'neon', color: '#39ff14', keywords: ['neon', 'phat sang'] },
    { themeName: 'pastel', color: '#f9a8d4', keywords: ['pastel', 'nhe nhang'] },
    { themeName: 'red', color: '#ef4444', keywords: ['do', 'red'] },
    { themeName: 'green', color: '#22c55e', keywords: ['xanh la', 'xanh luc', 'luc', 'green'] },
    { themeName: 'cyan', color: '#06b6d4', keywords: ['xanh ngoc', 'cyan', 'aqua'] },
    { themeName: 'blue', color: '#3b82f6', keywords: ['xanh duong', 'xanh', 'blue'] },
    { themeName: 'purple', color: '#8b5cf6', keywords: ['tim', 'purple', 'violet'] },
    { themeName: 'yellow', color: '#eab308', keywords: ['vang', 'yellow'] },
    { themeName: 'orange', color: '#f97316', keywords: ['cam', 'orange'] },
    { themeName: 'pink', color: '#ec4899', keywords: ['hong', 'pink'] },
    { themeName: 'black', color: '#111827', keywords: ['dark mode', 'che do toi', 'giao dien toi', 'nen toi', 'den', 'black'] },
    { themeName: 'white', color: '#ffffff', keywords: ['light mode', 'che do sang', 'giao dien sang', 'nen sang', 'trang', 'white'] },
]

const normalizeHexColor = (hex) => {
    const value = String(hex || '').trim().toLowerCase()
    if (/^#[0-9a-f]{6}$/.test(value)) return value
    if (/^#[0-9a-f]{3}$/.test(value)) return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
    return ''
}

const normalizeLanguage = (language) => language === 'en' ? 'en' : 'vi'

const getLanguageInstruction = (language) => normalizeLanguage(language) === 'en'
    ? 'Always answer in English. The website language is English. Do not switch languages based on the user message.'
    : 'Luôn trả lời bằng tiếng Việt. Ngôn ngữ hiện tại của website là tiếng Việt. Không tự đổi ngôn ngữ theo nội dung user nhập.'

const aiServiceMessages = {
    vi: {
        greeting: 'Chào bạn, mình là Doraemon AI của GymPro đây! Hôm nay bạn muốn hỏi về tập luyện, dinh dưỡng hay cần mình hỗ trợ gì khác nào?',
        noAnswer: 'Mình chưa có câu trả lời phù hợp.',
        gymOnly: 'Ở chế độ Gym, mình chỉ trả lời dựa trên dữ liệu hệ thống GymPro hiện tại như PT, sản phẩm, gói tập, tập luyện, dinh dưỡng và sức khỏe. Bạn có thể chuyển sang chế độ Tất cả để hỏi nội dung ngoài hệ thống.',
        noResults: 'Mình không tìm thấy kết quả phù hợp.',
    },
    en: {
        greeting: 'Hi, I am Doraemon AI from GymPro. What would you like help with today: workouts, nutrition, membership, or training progress?',
        noAnswer: 'I do not have a suitable answer yet.',
        gymOnly: 'In Gym mode, I only answer using current GymPro data such as trainers, products, membership plans, workouts, nutrition, and health. Switch to Other mode for non-gym questions.',
        noResults: 'I could not find suitable results.',
    },
}

const tAI = (key, language = 'vi') => {
    const lang = normalizeLanguage(language)
    return aiServiceMessages[lang]?.[key] || aiServiceMessages.vi[key] || key
}

const findSystemThemePreset = (normalized) => SYSTEM_THEME_PRESETS.find((preset) =>
    preset.keywords.some((keyword) => new RegExp(`(^|\\W)${keyword.replace(/\s+/g, '\\s+')}(\\W|$)`).test(normalized)),
)

const getThemeDisplayName = (themeName) => ({
    custom: 'màu bạn chọn',
    default: 'màu mặc định',
    red: 'tone đỏ',
    green: 'tone xanh lục',
    blue: 'tone xanh dương',
    purple: 'tone tím',
    yellow: 'tone vàng',
    orange: 'tone cam',
    pink: 'tone hồng',
    black: 'dark mode',
    white: 'light mode',
    neon: 'tone neon',
    cyberpunk: 'cyberpunk',
    gym_dark: 'dark gym',
    minimal_light: 'minimal light',
    sunset: 'sunset',
    ocean_blue: 'ocean blue',
    pastel: 'pastel',
    cyan: 'tone xanh ngọc',
}[themeName] || String(themeName || '').replace(/_/g, ' '))

const getThemeActionMessage = (themeName, language = 'vi') => normalizeLanguage(language) === 'en'
    ? `Switched to ${themeName === 'black' ? 'dark mode' : themeName === 'white' ? 'light mode' : getThemeDisplayName(themeName)}.`
    : `Đã đổi giao diện sang ${getThemeDisplayName(themeName)}.`

const getSystemUiCommandResponse = (query, conversationContext = {}, language = 'vi') => {
    const normalized = normalizePromptText(query)
    const preset = findSystemThemePreset(normalized)
    const lastThemeIntent = conversationContext?.lastIntent === 'change_theme'
        || conversationContext?.lastAction === 'change_theme'
        || Boolean(conversationContext?.lastThemeAction)
    const isShortFollowUp = normalized.split(/\s+/).filter(Boolean).length <= 4
    const followUpPreset = lastThemeIntent && isShortFollowUp
        ? preset
            || (/\b(toi hon|dam hon|dark hon)\b/.test(normalized) ? { themeName: 'black', color: '#111827' } : null)
            || (/\b(sang hon|nhat hon|light hon)\b/.test(normalized) ? { themeName: 'white', color: '#ffffff' } : null)
            || (/\b(dep hon|ngau hon|noi hon|chat hon)\b/.test(normalized) ? { themeName: 'cyberpunk', color: '#ff00ff' } : null)
        : null
    const hasChangeVerb = /\b(doi|thay|set|chuyen|change|switch|bat|apply|ap dung|cap nhat|chon|lam)\b/.test(normalized)
    const hasThemeTerm = /\b(mau|theme|giao dien|che do|accent|color|tone|tong|mode|ui|system|dark|light)\b/.test(normalized)
    const isStandaloneTone = Boolean(preset)
        && preset.themeName !== 'gym_dark'
        && preset.keywords.some((keyword) => normalized.trim() === keyword)
    const isThemeIntent = isStandaloneTone
        || Boolean(followUpPreset)
        || (hasChangeVerb && (hasThemeTerm || Boolean(preset)))

    console.log('DETECTED INTENT:', isThemeIntent ? 'change_theme' : 'member_question')
    if (!isThemeIntent) return null

    const resetIntent = /\b(mac dinh|default|reset|khoi phuc)\b/.test(normalized)
    const hex = normalizeHexColor(String(query || '').match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/)?.[0] || '')
    const resolved = hex
        ? { themeName: 'custom', color: hex }
        : resetIntent
            ? { themeName: 'default', color: '#e05a30' }
            : followUpPreset || preset || { themeName: 'gym_dark', color: '#991b1b' }

    return JSON.stringify({
        action: 'change_theme',
        themeName: resolved.themeName,
        color: resolved.color,
        message: getThemeActionMessage(resolved.themeName, language),
    }, null, 2)
}

const buildConversationContextText = (conversationContext) => {
    if (!conversationContext || typeof conversationContext !== 'object') return ''
    const recentMessages = Array.isArray(conversationContext.recentMessages)
        ? conversationContext.recentMessages
            .slice(-8)
            .filter((message) => message && typeof message.content === 'string')
            .map((message) => `${message.role || 'user'}: ${message.content.slice(0, 700)}`)
        : []

    const facts = [
        conversationContext.lastIntent ? `lastIntent: ${conversationContext.lastIntent}` : '',
        conversationContext.lastAction ? `lastAction: ${conversationContext.lastAction}` : '',
        conversationContext.lastSearchQuery ? `lastSearchQuery: ${conversationContext.lastSearchQuery}` : '',
        conversationContext.lastProduct ? `lastProduct: ${conversationContext.lastProduct}` : '',
        conversationContext.lastMode ? `lastMode: ${conversationContext.lastMode}` : '',
        conversationContext.lastThemeAction?.themeName || conversationContext.lastThemeAction?.color
            ? `lastThemeAction: ${conversationContext.lastThemeAction.themeName || ''} ${conversationContext.lastThemeAction.color || ''}`.trim()
            : '',
    ].filter(Boolean)

    if (recentMessages.length === 0 && facts.length === 0) return ''

    return `CONTEXT HỘI THOẠI GẦN ĐÂY:
${facts.length ? `${facts.join('\n')}
` : ''}${recentMessages.join('\n')}

QUY TẮC CONTEXT:
- Không xử lý message hiện tại như một câu hoàn toàn độc lập nếu nó là follow-up ngắn.
- Nếu người dùng nói "loại rẻ hơn", "cái đầu tiên", "màu tối hơn", "đẹp hơn", hãy nối với lastIntent/lastSearchQuery/lastAction.
- System/UI command vẫn ưu tiên cao nhất và không bị giới hạn bởi Gym mode.`
}

const isSummaryQuery = (query) => {
    const normalized = normalizePromptText(query)
    return /\b(tom tat|summary|summarize|rut gon|tong ket|noi dung chinh)\b/i.test(normalized)
}

const buildSummaryRules = (query) => {
    if (!isSummaryQuery(query)) return ''

    return `QUY TẮC SUMMARY MODE BẮT BUỘC:
- Đây là yêu cầu tóm tắt văn bản. Chỉ tóm tắt nội dung người dùng cung cấp trong câu hỏi.
- Output phải là đoạn văn hoàn chỉnh về mặt ngữ nghĩa, không chỉ liệt kê ý rời rạc.
- Bố cục phải có đủ 3 phần trong văn bản trả lời: mở ý giới thiệu nội dung chính, phần tóm tắt các ý quan trọng, và một câu kết luận ngắn.
- Không được cắt câu giữa chừng, không bỏ dở ý, không kết thúc đột ngột.
- Nếu văn bản dài, tự rút gọn nhưng vẫn giữ ý chính và bắt buộc có câu kết luận.
- Ưu tiên mạch lạc và đủ ý hơn quá ngắn gọn.
- Không thêm dữ liệu shop, gym, web hoặc thông tin ngoài văn bản được yêu cầu tóm tắt.`
}

const buildDefaultClassification = () => ({
    type: 'mixed',
    goal: 'không rõ',
    budget: 'unknown',
    keywords: [],
})

const readGeminiText = (response, label = 'generate') => {
    const text = response.text || ''
    console.log(`[Gemini:${label}] full response text:`, text)
    console.log(`[Gemini:${label}] response text length:`, text.length)
    return text
}

const readGeminiStreamChunkText = (chunk) => {
    return chunk.text || ''
}

const generateGeminiText = async (prompt, maxOutputTokens = 900, temperature = 0.35, label = 'generate') => {
    const geminiClient = createGeminiClient()
    const response = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature,
            maxOutputTokens,
        },
    })

    return readGeminiText(response, label)
}

const streamGeminiText = async (prompt, {
    maxOutputTokens = 900,
    temperature = 0.35,
    label = 'stream',
    onChunk,
} = {}) => {
    const geminiClient = createGeminiClient()
    const stream = await geminiClient.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature,
            maxOutputTokens,
        },
    })

    let fullText = ''
    for await (const chunk of stream) {
        const text = readGeminiStreamChunkText(chunk)
        if (!text) continue
        console.log(`[Gemini:${label}] stream chunk:`, text)
        fullText += text
        await onChunk?.(text)
    }

    console.log(`[Gemini:${label}] full stream text:`, fullText)
    console.log(`[Gemini:${label}] full stream text length:`, fullText.length)
    return fullText
}

export const classifyQueryIntent = async (query) => {
    if (!process.env.GEMINI_API_KEY) return buildDefaultClassification()

    const prompt = `Bạn là bộ phận phân tích truy vấn tìm kiếm GymPro.
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
            config: {
                temperature: 0.2,
                maxOutputTokens: 300,
            },
        })

        const content = readGeminiText(response, 'classifyQueryIntent').trim()
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

export const generateAssistantResponse = async (query, pts, products, plans, mode = 'gym', options = {}) => {
    const language = normalizeLanguage(options.language)
    const languageInstruction = getLanguageInstruction(language)
    const systemUiCommandResponse = getSystemUiCommandResponse(query, options.conversationContext, language)
    if (systemUiCommandResponse) return systemUiCommandResponse

    if (!process.env.GEMINI_API_KEY) return GEMINI_FALLBACK_MESSAGE

    const normalizedMode = mode === 'general' ? 'general' : 'gym'
    const webContext = String(options.webContext || '').trim()
    const webSearchUsed = Boolean(options.webSearchUsed && webContext)
    const memoryContext = String(options.memoryContext || '').trim()
    const conversationContextText = buildConversationContextText(options.conversationContext)
    const summaryRules = buildSummaryRules(query)
    const summaryMode = Boolean(summaryRules)
    const styleRules = `PHONG CÁCH BẮT BUỘC:
- Bạn là trợ lý AI của GymPro, thân thiện kiểu Doraemon nhưng vẫn chuyên nghiệp.
- Không trả lời cụt ngủn. Với câu hỏi đơn giản, trả lời câu chính rồi thêm 1 câu cảm xúc nhẹ nếu phù hợp.
- Không lan man; ưu tiên 1 câu chính và 1 câu bổ sung nhẹ.
- Tự nhiên như người thật, không robot, không roleplay quá đà.
- Có thể dùng emoji nhẹ khi hợp ngữ cảnh.
- Nếu người dùng muốn tìm sản phẩm hoặc PT, backend đã gọi tool lấy dữ liệu thật trước khi vào prompt này.
- Không bịa sản phẩm, PT, giá, số điện thoại hoặc email.`

    if (normalizedMode === 'gym' && isGreetingQuery(query)) {
        return tAI('greeting', language)
    }

    if (normalizedMode === 'general') {
        const prompt = `Bạn là trợ lý AI đa năng của GymPro.

Quy tắc:
- ${languageInstruction}
- Trả lời trực tiếp vào câu hỏi.
- Có thể trả lời toán học, lập trình, đời sống, công nghệ và kiến thức chung.
- Không roleplay PT và không thêm nội dung gym nếu câu hỏi không liên quan.
- Nếu người dùng muốn tìm sản phẩm hoặc PT, backend đã gọi tool lấy dữ liệu thật trước khi vào prompt này.
- Không bịa sản phẩm, PT, giá, số điện thoại hoặc email.
- Không tự ý đưa dữ liệu shop/gym/sản phẩm vào câu trả lời nếu người dùng không hỏi rõ về mua hàng, giá, sản phẩm, PT hoặc gói tập.
- Nếu người dùng yêu cầu tóm tắt, chỉ tóm tắt nội dung được cung cấp trong câu hỏi; không thêm dữ liệu shop, gym hoặc web.
- Nếu có "Context web", ưu tiên thông tin trong context đó và luôn thêm mục "Nguồn:" ở cuối với URL thật dạng https://...; không dùng markdown link.
- Nếu người dùng hỏi "link", "URL", "ở đâu", "nguồn" hoặc "tài liệu", trả URL trực tiếp từ context; không thay bằng mô tả hoặc sản phẩm.
- Nếu người dùng hỏi link Shopee, không hướng dẫn cách copy/tìm thủ công; trả link trực tiếp nếu có, nếu không có thì nói rõ không tìm thấy link trực tiếp.
- Không tạo link giả. Chỉ dùng URL có trong context web. Nếu không có URL thật, nói rõ không tìm thấy URL đáng tin cậy.
- Nếu context web không đủ để kết luận, nói rõ phần chưa chắc thay vì đoán.
- Trả lời đúng ngôn ngữ bắt buộc ở trên, rõ ràng, logic, ngắn gọn nhưng đủ ý.
- Không dừng giữa câu, không cắt ngang tên riêng hoặc câu trả lời.

${styleRules}

${memoryContext ? `${memoryContext}
` : ''}

${conversationContextText ? `${conversationContextText}
` : ''}

${summaryRules ? `${summaryRules}
` : ''}

${webSearchUsed ? `Context web từ Tavily:
${webContext}
` : 'Không có context web; câu hỏi được xử lý bằng kiến thức chung.'}

Câu hỏi: "${query}"`

        try {
            const text = await generateGeminiText(prompt, summaryMode ? 2200 : webSearchUsed ? 1400 : 900, 0.35, 'assistant-general')
            return text.trim() || tAI('noAnswer', language)
        } catch (error) {
            console.error('Gemini generateAssistantResponse general mode error:', error)
            return GEMINI_FALLBACK_MESSAGE
        }
    }

    if (!isGymRelatedQuery(query)) {
        return tAI('gymOnly', language)
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

    const prompt = `Bạn là một Huấn luyện viên cá nhân (PT) nhiệt tình, thân thiện và chuyên nghiệp cho GymPro.

Phong cách trả lời:
- ${languageInstruction}
- Sử dụng giọng nói khích lệ, gần gũi nhưng vẫn chuyên nghiệp.
- Không bao giờ yêu cầu người dùng nhập thêm từ khóa nếu họ chỉ chào hỏi.
- Luôn gợi ý hành động tiếp theo rõ ràng và hữu ích.
- Trả lời đúng ngôn ngữ bắt buộc ở trên, dễ hiểu, không quá máy móc.
- Không dừng giữa câu và không cắt ngang câu trả lời.
- Chỉ sử dụng dữ liệu hệ thống GymPro bên dưới, không tự lấy hoặc bịa dữ liệu ngoài hệ thống.
- Nếu có "Context web fitness", chỉ dùng nó như nguồn tham khảo chuyên môn về tập luyện, dinh dưỡng, thể hình và khoa học vận động.
- Nếu dữ liệu bên dưới không đủ để trả lời, nói rõ hiện hệ thống chưa có dữ liệu phù hợp và gợi ý người dùng hỏi về PT, sản phẩm hoặc gói tập hiện có.

${styleRules}

${memoryContext ? `${memoryContext}
` : ''}

${conversationContextText ? `${conversationContextText}
` : ''}

Dữ liệu tìm được từ hệ thống:
${context}

${webSearchUsed ? `Context web fitness từ Tavily:
${webContext}
` : 'Không có context web fitness; trả lời bằng kiến thức fitness nội bộ và dữ liệu hệ thống.'}

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
            config: {
                temperature: 0.35,
                maxOutputTokens: webSearchUsed ? 800 : 500,
            },
        })

        const text = readGeminiText(response, 'assistant-gym').trim()
        return text.trim() || tAI('noResults', language)
    } catch (error) {
        console.error('Gemini generateAssistantResponse error:', error)
        return GEMINI_FALLBACK_MESSAGE
    }
}

export const generateAssistantResponseStream = async (
    query,
    pts,
    products,
    plans,
    mode = 'gym',
    options = {},
) => {
    const language = normalizeLanguage(options.language)
    const languageInstruction = getLanguageInstruction(language)
    const systemUiCommandResponse = getSystemUiCommandResponse(query, options.conversationContext, language)
    if (systemUiCommandResponse) {
        await options.onChunk?.(systemUiCommandResponse)
        return systemUiCommandResponse
    }

    if (!process.env.GEMINI_API_KEY) {
        await options.onChunk?.(GEMINI_FALLBACK_MESSAGE)
        return GEMINI_FALLBACK_MESSAGE
    }

    const normalizedMode = mode === 'general' ? 'general' : 'gym'
    const onChunk = options.onChunk
    const webContext = String(options.webContext || '').trim()
    const webSearchUsed = Boolean(options.webSearchUsed && webContext)
    const memoryContext = String(options.memoryContext || '').trim()
    const conversationContextText = buildConversationContextText(options.conversationContext)
    const summaryRules = buildSummaryRules(query)
    const summaryMode = Boolean(summaryRules)
    const styleRules = `PHONG CÁCH BẮT BUỘC:
- Bạn là trợ lý AI của GymPro, thân thiện kiểu Doraemon nhưng vẫn chuyên nghiệp.
- Không trả lời cụt ngủn. Với câu hỏi đơn giản, trả lời câu chính rồi thêm 1 câu cảm xúc nhẹ nếu phù hợp.
- Không lan man; ưu tiên 1 câu chính và 1 câu bổ sung nhẹ.
- Tự nhiên như người thật, không robot, không roleplay quá đà.
- Có thể dùng emoji nhẹ khi hợp ngữ cảnh.
- Nếu người dùng muốn tìm sản phẩm hoặc PT, backend đã gọi tool lấy dữ liệu thật trước khi vào prompt này.
- Không bịa sản phẩm, PT, giá, số điện thoại hoặc email.`

    if (normalizedMode === 'gym' && isGreetingQuery(query)) {
        const greeting = tAI('greeting', language)
        await onChunk?.(greeting)
        return greeting
    }

    if (normalizedMode === 'general') {
        const prompt = `Bạn là trợ lý AI đa năng của GymPro.

Quy tắc:
- ${languageInstruction}
- Trả lời trực tiếp vào câu hỏi.
- Có thể trả lời toán học, lập trình, đời sống, công nghệ và kiến thức chung.
- Không roleplay PT và không thêm nội dung gym nếu câu hỏi không liên quan.
- Nếu người dùng muốn tìm sản phẩm hoặc PT, backend đã gọi tool lấy dữ liệu thật trước khi vào prompt này.
- Không bịa sản phẩm, PT, giá, số điện thoại hoặc email.
- Không tự ý đưa dữ liệu shop/gym/sản phẩm vào câu trả lời nếu người dùng không hỏi rõ về mua hàng, giá, sản phẩm, PT hoặc gói tập.
- Nếu người dùng yêu cầu tóm tắt, chỉ tóm tắt nội dung được cung cấp trong câu hỏi; không thêm dữ liệu shop, gym hoặc web.
- Nếu có "Context web", ưu tiên thông tin trong context đó và luôn thêm mục "Nguồn:" ở cuối với URL thật dạng https://...; không dùng markdown link.
- Nếu người dùng hỏi "link", "URL", "ở đâu", "nguồn" hoặc "tài liệu", trả URL trực tiếp từ context; không thay bằng mô tả hoặc sản phẩm.
- Nếu người dùng hỏi link Shopee, không hướng dẫn cách copy/tìm thủ công; trả link trực tiếp nếu có, nếu không có thì nói rõ không tìm thấy link trực tiếp.
- Không tạo link giả. Chỉ dùng URL có trong context web. Nếu không có URL thật, nói rõ không tìm thấy URL đáng tin cậy.
- Nếu context web không đủ để kết luận, nói rõ phần chưa chắc thay vì đoán.
- Trả lời đúng ngôn ngữ bắt buộc ở trên, rõ ràng, logic, ngắn gọn nhưng đủ ý.
- Không dừng giữa câu, không cắt ngang tên riêng hoặc câu trả lời.

${styleRules}

${memoryContext ? `${memoryContext}
` : ''}

${conversationContextText ? `${conversationContextText}
` : ''}

${summaryRules ? `${summaryRules}
` : ''}

${webSearchUsed ? `Context web từ Tavily:
${webContext}
` : 'Không có context web; câu hỏi được xử lý bằng kiến thức chung.'}

Câu hỏi: "${query}"`

        return streamGeminiText(prompt, {
            maxOutputTokens: summaryMode ? 2200 : webSearchUsed ? 1400 : 900,
            temperature: 0.35,
            label: 'assistant-general-stream',
            onChunk,
        })
    }

    if (!isGymRelatedQuery(query)) {
        const message = tAI('gymOnly', language)
        await onChunk?.(message)
        return message
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

    const prompt = `Bạn là một Huấn luyện viên cá nhân (PT) nhiệt tình, thân thiện và chuyên nghiệp cho GymPro.

Phong cách trả lời:
- ${languageInstruction}
- Sử dụng giọng nói khích lệ, gần gũi nhưng vẫn chuyên nghiệp.
- Không bao giờ yêu cầu người dùng nhập thêm từ khóa nếu họ chỉ chào hỏi.
- Luôn gợi ý hành động tiếp theo rõ ràng và hữu ích.
- Trả lời đúng ngôn ngữ bắt buộc ở trên, dễ hiểu, không quá máy móc.
- Không dừng giữa câu và không cắt ngang câu trả lời.
- Chỉ sử dụng dữ liệu hệ thống GymPro bên dưới, không tự lấy hoặc bịa dữ liệu ngoài hệ thống.
- Nếu có "Context web fitness", chỉ dùng nó như nguồn tham khảo chuyên môn về tập luyện, dinh dưỡng, thể hình và khoa học vận động.
- Nếu dữ liệu bên dưới không đủ để trả lời, nói rõ hiện hệ thống chưa có dữ liệu phù hợp và gợi ý người dùng hỏi về PT, sản phẩm hoặc gói tập hiện có.

${styleRules}

${memoryContext ? `${memoryContext}
` : ''}

${conversationContextText ? `${conversationContextText}
` : ''}

Dữ liệu tìm được từ hệ thống:
${context}

${webSearchUsed ? `Context web fitness từ Tavily:
${webContext}
` : 'Không có context web fitness; trả lời bằng kiến thức fitness nội bộ và dữ liệu hệ thống.'}

Nội dung trả lời:
- Nếu có kết quả phù hợp, đề xuất phương án rõ ràng.
- Nếu không có dữ liệu phù hợp, hãy khuyến khích người dùng thử câu hỏi khác hoặc gợi ý bước tiếp theo.
- Không chia sẻ thông tin cá nhân của người dùng khác.

Câu hỏi: "${query}"`

    return streamGeminiText(prompt, {
        maxOutputTokens: webSearchUsed ? 800 : 500,
        temperature: 0.35,
        label: 'assistant-gym-stream',
        onChunk,
    })
}
