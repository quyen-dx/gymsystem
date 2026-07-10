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

const SHOPEE_STOP_WORDS = new Set([
    'link', 'url', 'website', 'trang', 'web', 'tim', 'kiem', 'cho', 'minh', 'toi', 'san', 'pham',
    'shopee', 'mua', 'o', 'dau', 'ở', 'đâu', 'hang', 'cai', 'nay', 'giup',
])

const OUTSIDE_SYSTEM_KEYWORDS = [
    'web', 'internet', 'google', 'nguon', 'bai bao', 'nghien cuu', 'bao cao', 'so sanh',
    'cong ty', 'san pham', 'dien thoai', 'laptop', 'du lich', 'luat', 'y te', 'tai chinh',
    'nodejs', 'express', 'react', 'vite', 'mongodb', 'mongoose', 'tavily', 'gemini',
]

const FITNESS_SEARCH_KEYWORDS = [
    'gym', 'fitness', 'workout', 'exercise', 'training', 'tap', 'bai tap', 'lich tap',
    'squat', 'deadlift', 'bench', 'push up', 'pushup', 'pull up', 'pullup', 'plank',
    'cardio', 'hiit', 'chay bo', 'co bung', 'tap tay', 'tap chan', 'tap lung', 'tap vai',
    'nutrition', 'diet', 'dinh duong', 'an gi', 'calo', 'calorie', 'macro', 'protein',
    'whey', 'creatine', 'supplement', 'fat loss', 'giam can', 'giam mo', 'muscle',
    'tang co', 'tang can', 'bodybuilding', 'hypertrophy', 'strength', 'suc manh',
    'phuc hoi', 'recovery', 'stretch', 'mobility',
]

const FITNESS_SEARCH_NEEDS_WEB_KEYWORDS = [
    'moi nhat', 'cap nhat', 'nghien cuu', 'khoa hoc', 'evidence', 'science', 'study',
    'co nen', 'tot nhat', 'hieu qua', 'bao nhieu', 'nen an', 'an gi', 'lich tap',
    'plan', 'program', 'routine', 'so sanh', 'guide', 'huong dan',
]

const GYM_MODE_BLOCKED_WEB_KEYWORDS = [
    'shopee', 'lazada', 'tiki', 'sendo', 'amazon', 'mua o dau', 'link san pham',
    'iphone', 'dien thoai', 'laptop', 'crypto', 'bitcoin', 'chung khoan', 'gia vang',
    'code', 'react', 'nodejs', 'express', 'mongodb', 'api', 'bug', 'debug', 'openai',
    'gemini', 'chatgpt', 'claude', 'phim', 'anime', 'game', 'du lich', 'thoi tiet',
    'tin tuc', 'facebook', 'youtube', 'tiktok',
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

export const isFitnessSearchAllowed = (query) => {
    const normalized = normalizeText(query).trim()
    if (!normalized) return false
    const blocked = GYM_MODE_BLOCKED_WEB_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))
    if (blocked) return false

    return FITNESS_SEARCH_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))
}

export const shouldSearchFitnessWeb = (query) => {
    const normalized = normalizeText(query).trim()
    if (!isFitnessSearchAllowed(normalized)) return false

    const asksForFreshOrDeepFitnessInfo = FITNESS_SEARCH_NEEDS_WEB_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))
    const hasExplicitCurrentYear = /\b(2025|2026|2027)\b/.test(normalized)
    const words = normalized.match(/[a-z0-9]+/g) || []
    const isSpecificFitnessQuestion = words.length >= 5 && /(nhu the nao|bao nhieu|co nen|tot khong|hieu qua|plan|routine|program|guide)/i.test(normalized)

    return asksForFreshOrDeepFitnessInfo || hasExplicitCurrentYear || isSpecificFitnessQuestion
}

export const buildFitnessSearchQuery = (query) => {
    const normalized = normalizeText(query).trim()
    const topics = []

    if (/(giam can|giam mo|fat loss|weight loss)/i.test(normalized)) topics.push('fat loss workout diet')
    if (/(tang co|muscle|hypertrophy|bodybuilding)/i.test(normalized)) topics.push('muscle building hypertrophy workout nutrition')
    if (/(tang can|bulk|bulking)/i.test(normalized)) topics.push('healthy weight gain muscle gain nutrition')
    if (/(an gi|dinh duong|nutrition|diet|calo|calorie|macro)/i.test(normalized)) topics.push('sports nutrition diet calories')
    if (/(whey|protein|creatine|supplement)/i.test(normalized)) topics.push('sports supplements protein creatine evidence')
    if (/(tap tay|arm|biceps|triceps)/i.test(normalized)) topics.push('arm workout exercises biceps triceps')
    if (/(tap chan|leg|squat)/i.test(normalized)) topics.push('leg workout squat exercises')
    if (/(tap lung|back|deadlift)/i.test(normalized)) topics.push('back workout deadlift exercises')
    if (/(tap vai|shoulder)/i.test(normalized)) topics.push('shoulder workout exercises')
    if (/(push up|pushup|hit dat)/i.test(normalized)) topics.push('push-up exercise form progression')
    if (/(cardio|hiit|chay bo)/i.test(normalized)) topics.push('cardio HIIT running fitness')

    const base = topics.length > 0 ? [...new Set(topics)].join(' ') : 'fitness workout nutrition evidence'
    return `${base} ${query}`.replace(/\s+/g, ' ').trim()
}

export const searchFitnessWeb = async (query, options = {}) => {
    const fitnessQuery = buildFitnessSearchQuery(query)
    const result = await searchWeb(fitnessQuery, options)
    if (!result.used) {
        return {
            ...result,
            fitnessQuery,
        }
    }

    const results = result.results.filter((item) =>
        isFitnessSearchAllowed([item.title, item.content, item.url].filter(Boolean).join(' '))
    )

    return {
        ...result,
        fitnessQuery,
        used: results.length > 0,
        reason: results.length > 0 ? result.reason : 'no_fitness_results',
        results,
        context: buildWebSearchContext(results),
    }
}

export const webSearchNutrition = async (query, options = {}) => {
    const normalized = normalizeText(query).trim()
    const nutritionIntent = /\b(an gi|nen an|bua|thuc don|dinh duong|calo|calorie|macro|protein|diet|meal|nutrition|giam can|giam mo|tang co|healthy)\b/.test(normalized)
    if (!nutritionIntent || !isFitnessSearchAllowed(query)) {
        return {
            used: false,
            reason: 'not_nutrition_query',
            results: [],
            sources: [],
            context: '',
        }
    }

    const nutritionQuery = [
        'evidence based sports nutrition meal diet calories',
        query,
    ].join(' ')
    const result = await searchWeb(nutritionQuery, { maxResults: options.maxResults || 4 })
    const results = (result.results || []).filter((item) =>
        isFitnessSearchAllowed([item.title, item.content, item.url].filter(Boolean).join(' '))
    )
    const sources = results
        .map((item) => buildSourceMetadata(item))
        .filter(Boolean)
    return {
        ...result,
        nutritionQuery,
        used: results.length > 0,
        reason: results.length > 0 ? result.reason : (result.reason || 'no_nutrition_results'),
        results,
        sources,
        context: buildWebSearchContext(results),
    }
}

const buildSourceMetadata = (item = {}) => {
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    if (!url) return null
    let domain = ''
    try {
        domain = new URL(url).hostname.replace(/^www\./, '')
    } catch {
        domain = ''
    }
    const title = typeof item.title === 'string' && item.title.trim()
        ? item.title.trim()
        : (domain || url)
    const faviconDomain = domain || url
    return {
        title,
        url,
        domain,
        favicon: faviconDomain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(faviconDomain)}&sz=32` : '',
        sourceTitle: title,
        sourceUrl: url,
        sourceDomain: domain,
    }
}

export const isShopeeLinkIntent = (query) => {
    const normalized = normalizeText(query).trim()
    if (!normalized) return false
    const mentionsShopee = /\bshopee\b/.test(normalized)

    return mentionsShopee
}

export const getShopeeSearchKeyword = (query) => {
    const tokens = normalizeText(query).match(/[a-z0-9]+/g) || []
    const keyword = tokens
        .filter((token) => !SHOPEE_STOP_WORDS.has(token))
        .join(' ')
        .trim()

    return keyword || 'gym'
}

export const getShopeeSearchUrl = (query) => {
    return `https://shopee.vn/search?keyword=${encodeURIComponent(getShopeeSearchKeyword(query))}`
}

export const getShopeeWebSearchQuery = (query) => {
    return `site:shopee.vn ${getShopeeSearchKeyword(query)}`
}

export const buildShopeeLinkAnswer = (query, results = []) => {
    const directShopeeResult = Array.isArray(results)
        ? results.find((item) => {
            try {
                const hostname = new URL(item.url).hostname.toLowerCase()
                return hostname === 'shopee.vn' || hostname.endsWith('.shopee.vn')
            } catch {
                return false
            }
        })
        : null

    if (directShopeeResult?.url) {
        return `Mình tìm thấy link Shopee phù hợp:\n${directShopeeResult.url}`
    }

    return `Mình chưa tìm thấy link sản phẩm Shopee trực tiếp. Link tìm kiếm Shopee phù hợp:\n${getShopeeSearchUrl(query)}`
}

export const searchWeb = async (query, { maxResults = DEFAULT_MAX_RESULTS, includeAnswer = false, includeRawContent = false } = {}) => {
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
            include_answer: includeAnswer,
            include_raw_content: includeRawContent,
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
                content: String(item.content || item.snippet || '').slice(0, 2000),
                rawContent: includeRawContent ? String(item.raw_content || item.content || '').slice(0, 8000) : '',
                score: Number(item.score) || 0,
                publishedDate: item.published_date || '',
            }))
            .filter((item) => /^https:\/\//i.test(item.url))
        : []

    return {
        used: true,
        reason: 'searched',
        results,
        answer: includeAnswer ? (data.answer || '') : '',
        rawAnswer: includeAnswer ? (data.raw_answer || '') : '',
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
