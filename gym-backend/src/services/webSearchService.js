const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'
const DEFAULT_MAX_RESULTS = 5

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()

const SIMPLE_QUERY_PATTERNS = [
    /^(hi|hello|hey|chao|xin chao|alo)\b/i,
    /^(cam on|thank you|thanks|ok|oke|uh|um)$/i,
    /^(\d+(\.\d+)?\s*[-+*/x:]\s*)+\d+(\.\d+)?$/,
    /^(la gi|what is|ai la|ke chuyen|viet|dich|tom tat|giai thich)\b/i,
]

const REALTIME_KEYWORDS = [
    'moi nhat', 'hom nay', 'bay gio', 'hien tai', 'cap nhat', 'realtime', 'thoi gian thuc',
    'tin tuc', 'gia vang', 'gia do la', 'ty gia', 'chung khoan', 'co phieu', 'crypto', 'bitcoin',
    'lich thi dau', 'ket qua', 'thoi tiet', 'sap ra mat', 'phien ban moi', 'release', 'changelog',
    'api moi', 'framework', 'thu vien', 'docs', 'tai lieu', 'loi', 'bug', 'error', 'fix',
    'ai', 'gemini', 'openai', 'claude', 'chatgpt', 'model moi', 'xu huong',
]

const URL_LOOKUP_KEYWORDS = [
    'link', 'url', 'website', 'trang web', 'o dau', 'ở đâu', 'nguon', 'source',
    'shopee', 'google', 'youtube', 'github', 'facebook', 'docs', 'documentation', 'tai lieu',
]

const OUTSIDE_SYSTEM_KEYWORDS = [
    'web', 'internet', 'google', 'nguon', 'bai bao', 'nghien cuu', 'bao cao', 'so sanh',
    'cong ty', 'san pham', 'dien thoai', 'laptop', 'du lich', 'luat', 'y te', 'tai chinh',
    'nodejs', 'express', 'react', 'vite', 'mongodb', 'mongoose', 'tavily', 'gemini',
]

export const shouldSearchWeb = (query) => {
    const normalized = normalizeText(query).trim()
    if (!normalized) return false
    const asksForUrl = URL_LOOKUP_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))
    if (!asksForUrl && SIMPLE_QUERY_PATTERNS.some((pattern) => pattern.test(normalized))) return false

    const words = normalized.match(/[a-z0-9]+/g) || []
    const hasQuestionAboutCurrentData = REALTIME_KEYWORDS.some((keyword) => normalized.includes(keyword))
    const hasOutsideSystemTopic = OUTSIDE_SYSTEM_KEYWORDS.some((keyword) => normalized.includes(keyword))
    const hasExplicitCurrentYear = /\b(2025|2026|2027)\b/.test(normalized)
    const isLongSpecificQuestion = words.length >= 8 && /(o dau|nhu the nao|bao nhieu|khi nao|co nen|tot nhat|top|best|latest)/i.test(normalized)

    return asksForUrl || hasQuestionAboutCurrentData || hasExplicitCurrentYear || (hasOutsideSystemTopic && isLongSpecificQuestion)
}

export const searchWeb = async (query, { maxResults = DEFAULT_MAX_RESULTS } = {}) => {
    if (!process.env.TAVILY_API_KEY) {
        return {
            used: false,
            reason: 'missing_api_key',
            results: [],
            context: '',
        }
    }

    const response = await fetch(TAVILY_SEARCH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: 'advanced',
            max_results: maxResults,
            include_answer: false,
            include_raw_content: false,
        }),
    })

    if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`Tavily search failed: ${response.status} ${detail}`.trim())
    }

    const data = await response.json()
    const results = Array.isArray(data.results)
        ? data.results
            .slice(0, maxResults)
            .map((item) => ({
                title: String(item.title || '').slice(0, 180),
                url: String(item.url || ''),
                content: String(item.content || item.snippet || '').slice(0, 700),
                score: Number(item.score) || 0,
            }))
            .filter((item) => /^https:\/\//i.test(item.url))
        : []

    return {
        used: true,
        reason: 'searched',
        results,
        context: buildWebSearchContext(results),
    }
}

export const buildWebSearchContext = (results = []) => {
    if (!Array.isArray(results) || results.length === 0) return ''

    return results
        .map((item, index) => [
            `[${index + 1}] ${item.title || 'Không có tiêu đề'}`,
            `URL thật: ${item.url}`,
            `Tóm tắt: ${item.content || 'Không có nội dung tóm tắt.'}`,
        ].join('\n'))
        .join('\n\n')
}
