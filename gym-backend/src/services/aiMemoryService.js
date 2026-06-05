import AiChatHistory from '../models/AiChatHistory.js'
import AiUserMemory from '../models/AiUserMemory.js'

const MEMORY_UPDATE_INTERVAL = 4
const MAX_SUMMARY_LENGTH = 600

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()

const TOPIC_RULES = [
    { topic: 'gym', pattern: /\b(gym|tap|workout|cardio|bai tap|co|mo|fitness|health|suc khoe)\b/ },
    { topic: 'nutrition', pattern: /\b(dinh duong|an|calo|calorie|macro|protein|whey|creatine|meal|diet)\b/ },
    { topic: 'shop', pattern: /\b(mua|shop|san pham|gia|ban|shopee|link|ta|gang|whey|protein|giay|day|tham)\b/ },
    { topic: 'pt', pattern: /\b(pt|coach|trainer|huan luyen vien|lich tap)\b/ },
    { topic: 'web-search', pattern: /\b(moi nhat|hom nay|hien tai|cap nhat|link|url|nguon|source|search|google|shopee)\b/ },
    { topic: 'tech', pattern: /\b(code|react|node|api|bug|loi|debug|ai|gemini|openai|chatgpt)\b/ },
]

const getUserQueries = (history, currentQuery) => {
    const storedQueries = Array.isArray(history?.sessions)
        ? history.sessions.flatMap((session) =>
            Array.isArray(session.messages)
                ? session.messages
                    .filter((message) => message.role === 'user' && message.content)
                    .map((message) => String(message.content))
                : [],
        )
        : []

    return [...storedQueries, String(currentQuery || '').trim()].filter(Boolean)
}

const inferTopic = (query) => {
    const normalized = normalizeText(query)
    const match = TOPIC_RULES.find((rule) => rule.pattern.test(normalized))
    return match?.topic || 'general'
}

const inferMode = (query, selectedMode = 'gym') => {
    const topic = inferTopic(query)
    if (topic === 'shop') return 'shop'
    if (topic === 'web-search' || /\b(link|url|nguon|source|moi nhat|hom nay|shopee)\b/.test(normalizeText(query))) return 'search'
    if (selectedMode === 'general' || topic === 'tech' || topic === 'general') return 'general'
    return 'gym'
}

const inferResponseStyle = (queries = []) => {
    const haystack = normalizeText(queries.join(' '))
    const shortSignals = (haystack.match(/\b(ngan|gon|ngan gon|tom tat|short|brief|nhanh)\b/g) || []).length
    const longSignals = (haystack.match(/\b(chi tiet|day du|dai|phan tich|giai thich ky|deep)\b/g) || []).length
    if (shortSignals > longSignals) return 'short'
    if (longSignals > shortSignals) return 'long'
    return 'balanced'
}

const buildTopTopics = (queries = []) => {
    const counts = new Map()
    queries.forEach((query) => {
        const topic = inferTopic(query)
        counts.set(topic, (counts.get(topic) || 0) + 1)
    })

    return [...counts.entries()]
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
        .slice(0, 5)
}

const buildHistorySummary = (topTopics = [], responseStyle = 'balanced', favoriteMode = 'gym') => {
    if (topTopics.length === 0) return ''
    const topicText = topTopics.map((item) => `${item.topic} (${item.count})`).join(', ')
    const summary = `Người dùng thường hỏi về: ${topicText}. Mode có xu hướng phù hợp: ${favoriteMode}. Phong cách phản hồi ưa thích: ${responseStyle}.`
    return summary.slice(0, MAX_SUMMARY_LENGTH)
}

export const getAiUserMemory = async (userId) => {
    if (!userId) return null
    return AiUserMemory.findOne({ userId }).lean()
}

export const buildAiMemoryContext = (memory) => {
    if (!memory) return ''
    const topTopics = Array.isArray(memory.usagePattern?.topTopics)
        ? memory.usagePattern.topTopics.map((item) => `${item.topic}:${item.count}`).join(', ')
        : ''

    return [
        'MEMORY NGƯỜI DÙNG (nội bộ, không tiết lộ nguyên văn cho user):',
        `- Mode ưa thích: ${memory.preferences?.favoriteMode || 'gym'}.`,
        `- Độ dài câu trả lời ưa thích: ${memory.preferences?.responseStyle || 'balanced'}.`,
        memory.historySummary ? `- Tóm tắt hành vi: ${memory.historySummary}` : '',
        topTopics ? `- Chủ đề hay hỏi: ${topTopics}.` : '',
        '- Dùng memory để cá nhân hóa độ dài, trọng tâm và ví dụ; không nói rằng bạn đang dùng memory trừ khi user hỏi trực tiếp.',
    ].filter(Boolean).join('\n')
}

export const updateAiUserMemoryIfDue = async ({ userId, query, mode }) => {
    if (!userId || !query) return null

    const [history, currentMemory] = await Promise.all([
        AiChatHistory.findOne({ userId }).select('sessions').lean(),
        AiUserMemory.findOne({ userId }).lean(),
    ])
    const queries = getUserQueries(history, query)
    const messageCount = queries.length
    const lastAnalyzedCount = Number(currentMemory?.analyzedMessageCount || 0)

    if (messageCount < MEMORY_UPDATE_INTERVAL || messageCount - lastAnalyzedCount < MEMORY_UPDATE_INTERVAL) {
        return currentMemory
    }

    const topTopics = buildTopTopics(queries)
    const modeCounts = new Map()
    queries.forEach((item) => {
        const inferredMode = inferMode(item, mode)
        modeCounts.set(inferredMode, (modeCounts.get(inferredMode) || 0) + 1)
    })
    const favoriteMode = [...modeCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'gym'
    const recentQueries = queries.slice(-12)
    const responseStyle = inferResponseStyle(recentQueries)
    const lastTopics = recentQueries.map(inferTopic).slice(-5)
    const historySummary = buildHistorySummary(topTopics, responseStyle, favoriteMode)

    return AiUserMemory.findOneAndUpdate(
        { userId },
        {
            $set: {
                preferences: { favoriteMode, responseStyle },
                historySummary,
                usagePattern: { topTopics, lastTopics },
                analyzedMessageCount: messageCount,
            },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean()
}
