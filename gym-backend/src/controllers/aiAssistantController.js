import Plan from '../models/Plan.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import AiChatHistory from '../models/AiChatHistory.js'
import {
    classifyQueryIntent,
    generateAssistantResponse,
    generateAssistantResponseStream,
} from '../services/aiAssistantService.js'
import {
    buildAiMemoryContext,
    getAiUserMemory,
    updateAiUserMemoryIfDue,
} from '../services/aiMemoryService.js'
import { recordAuditLog } from '../services/auditLogService.js'
import {
    buildShopeeLinkAnswer,
    getShopeeWebSearchQuery,
    isShopeeLinkIntent,
    searchWeb,
    searchFitnessWeb,
    shouldSearchFitnessWeb,
    shouldSearchWeb,
} from '../services/webSearchService.js'
import AppError from '../utils/appError.js'
import { runGymAiAction } from '../ai/services/aiService.js'

const MAX_CHAT_SESSIONS = 20
const CHAT_RETENTION_DAYS = 30

const logAiAnswerBeforeSend = (label, answer) => {
    const text = String(answer || '')
    console.log(`[AI Assistant:${label}] answer before client:`, text)
    console.log(`[AI Assistant:${label}] answer length:`, text.length)
}

const writeSseEvent = (res, event, data = {}) => {
    if (res.destroyed || res.writableEnded) return false
    const seq = (res.locals.sseSeq || 0) + 1
    res.locals.sseSeq = seq
    const payload = data && typeof data === 'object' && !Array.isArray(data)
        ? { ...data, seq }
        : { value: data, seq }
    res.write(`id: ${seq}\n`)
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
    res.flush?.()
    return true
}

const initSseResponse = (res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    res.write(': stream-open\n\n')
    res.flush?.()
}

const getSessionLastActivityMs = (session) => {
    const latestMessageAt = Array.isArray(session.messages) && session.messages.length > 0
        ? session.messages[session.messages.length - 1]?.createdAt
        : ''
    const value = latestMessageAt || session.createdAt
    const time = new Date(value).getTime()
    return Number.isFinite(time) ? time : 0
}

const normalizeSessions = (sessions) => {
    if (!Array.isArray(sessions)) return []
    const cutoff = Date.now() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    return sessions
        .map((session) => {
            const safeSession = normalizeObject(session)
            return {
                sessionId: String(safeSession.sessionId || `session-${Date.now()}`),
                title: String(safeSession.title || 'New Chat').slice(0, 120),
                createdAt: String(safeSession.createdAt || new Date().toISOString()),
                messages: Array.isArray(safeSession.messages)
                    ? safeSession.messages.slice(-200).map((message) => {
                        const safeMessage = normalizeObject(message)
                        return {
                            id: String(safeMessage.id || `${Date.now()}-${Math.random()}`),
                            userId: String(safeMessage.userId || ''),
                            role: ['user', 'assistant', 'system'].includes(safeMessage.role) ? safeMessage.role : 'system',
                            content: String(safeMessage.content || '').slice(0, 8000),
                            ...(typeof safeMessage.answer === 'string' ? { answer: safeMessage.answer.slice(0, 8000) } : {}),
                            createdAt: String(safeMessage.createdAt || new Date().toISOString()),
                            ...(typeof safeMessage.type === 'string' ? { type: safeMessage.type } : {}),
                            ...(safeMessage.plan && typeof safeMessage.plan === 'object' ? { plan: safeMessage.plan } : {}),
                            ...(Array.isArray(safeMessage.plans) ? { plans: safeMessage.plans } : {}),
                            ...(safeMessage.recommendedPlan && typeof safeMessage.recommendedPlan === 'object' ? { recommendedPlan: safeMessage.recommendedPlan } : {}),
                            ...(Array.isArray(safeMessage.alternatives) ? { alternatives: safeMessage.alternatives.slice(0, 2) } : {}),
                            ...(typeof safeMessage.reason === 'string' ? { reason: safeMessage.reason.slice(0, 1200) } : {}),
                            ...(typeof safeMessage.conclusion === 'string' ? { conclusion: safeMessage.conclusion.slice(0, 1200) } : {}),
                            ...(safeMessage.data && typeof safeMessage.data === 'object' ? { data: safeMessage.data } : {}),
                            ...(safeMessage.planPayload && typeof safeMessage.planPayload === 'object' ? { planPayload: safeMessage.planPayload } : {}),
                            ...(typeof safeMessage.intent === 'string' ? { intent: safeMessage.intent } : {}),
                            ...(typeof safeMessage.action === 'string' ? { action: safeMessage.action } : {}),
                            ...(typeof safeMessage.subject === 'string' ? { subject: safeMessage.subject } : {}),
                            ...(safeMessage.metadata && typeof safeMessage.metadata === 'object' && !Array.isArray(safeMessage.metadata) ? { metadata: safeMessage.metadata } : {}),
                            ...(Array.isArray(safeMessage.suggestions) ? { suggestions: safeMessage.suggestions.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 4) } : {}),
                            ...(safeMessage.webSearch && typeof safeMessage.webSearch === 'object' ? { webSearch: normalizeWebSearchPayload(safeMessage.webSearch) } : {}),
                        }
                    }).filter((message) => message.content || message.type || message.planPayload)
                    : [],
            }
        })
        .filter((session) => getSessionLastActivityMs(session) >= cutoff)
        .sort((a, b) => getSessionLastActivityMs(b) - getSessionLastActivityMs(a))
        .slice(0, MAX_CHAT_SESSIONS)
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildSearchRegex = (values) => {
    const clean = values
        .filter(Boolean)
        .map((value) => escapeRegex(value.toString().trim()))
        .filter(Boolean)

    if (clean.length === 0) {
        return /.+/i
    }

    return new RegExp(clean.join('|'), 'i')
}

const isPrivacyQuestion = (query) => {
    return /(số điện thoại|email|thông tin cá nhân|địa chỉ|liên hệ|contact|phone)/i.test(query)
}

const normalizeSearchText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()

const getSearchTokens = (query) => normalizeSearchText(query).match(/[a-z0-9]+/g) || []
const normalizeLiteralText = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')

const productActionWords = new Set(['tim', 'kiem', 'mua', 'ban', 'gia', 'shop', 'product', 'products', 'searchproducts'])
const productWords = new Set(['ta', 'dumbbell', 'dumbell', 'whey', 'protein', 'supplement', 'creatine', 'may', 'giay', 'gang', 'glove', 'gloves', 'wrist', 'strap', 'day', 'tham'])
const ptWords = new Set(['pt', 'coach', 'trainer'])
const ptGoalWords = new Set(['giam', 'mo', 'can', 'tang', 'co', 'suc', 'manh', 'lich', 'tap'])
const generalKnowledgeIntentWords = new Set([
    'explain', 'summary', 'summarize', 'code', 'math', 'toan', 'phim', 'movie', 'anime', 'technology',
])
const explicitProductIntentWords = new Set([
    'tim', 'kiem', 'mua', 'ban', 'gia', 'shop', 'product', 'products', 'searchproducts',
    'san', 'pham', 'danh', 'muc', 'category', 'cua', 'hang', 'bao', 'nhieu', 'tien',
])
const explicitPtIntentWords = new Set(['tim', 'kiem', 'dat', 'thue', 'chon', 'gioi', 'thieu', 'lich'])
const urlLookupIntentWords = new Set(['link', 'url', 'website', 'source', 'docs', 'github', 'youtube', 'facebook', 'google', 'shopee'])
const productStopWords = new Set([
    'tim', 'kiem', 'mua', 'san', 'pham', 'product', 'products', 'shop', 'ban', 'gia',
    'cho', 'toi', 'giup', 'minh', 'trong', 'cua', 'hang', 'o', 'tai', 'searchproducts',
])
const productSynonyms = {
    ta: ['tạ', 'ta', 'dumbbell', 'dumbell'],
    dumbbell: ['tạ', 'ta', 'dumbbell', 'dumbell'],
    dumbell: ['tạ', 'ta', 'dumbbell', 'dumbell'],
    may: ['máy tập', 'may tap'],
    giay: ['giày gym', 'giay gym'],
    gang: ['găng tay', 'gang tay'],
    glove: ['găng tay', 'gang tay', 'glove', 'gym glove', 'phụ kiện tay', 'phu kien tay', 'wrist support'],
    gloves: ['găng tay', 'gang tay', 'glove', 'gym glove', 'phụ kiện tay', 'phu kien tay', 'wrist support'],
    wrist: ['wrist support', 'bảo vệ cổ tay', 'bao ve co tay', 'phụ kiện tay', 'phu kien tay'],
    strap: ['strap', 'băng quấn tay', 'bang quan tay', 'wrist support', 'phụ kiện tay', 'phu kien tay'],
    day: ['dây kháng lực', 'day khang luc'],
    tham: ['thảm tập', 'tham tap'],
}

const categorySynonyms = {
    ta: ['ta', 'tạ', 'dumbbell', 'tạ đơn', 'tạ đôi'],
    gang: ['găng tay', 'gang tay', 'glove', 'phụ kiện tay', 'phu kien tay', 'wrist support', 'băng quấn tay', 'strap'],
    glove: ['găng tay', 'gang tay', 'glove', 'phụ kiện tay', 'phu kien tay', 'wrist support', 'băng quấn tay', 'strap'],
    gloves: ['găng tay', 'gang tay', 'glove', 'phụ kiện tay', 'phu kien tay', 'wrist support', 'băng quấn tay', 'strap'],
    day: ['dây', 'dây kháng lực', 'day khang luc'],
    may: ['máy tập', 'may tap', 'máy chạy bộ'],
    whey: ['whey', 'protein', 'whey protein'],
}

const strictProductGroups = {
    hand_accessory: {
        triggers: ['gang', 'glove', 'gloves', 'wrist', 'strap'],
        terms: ['găng tay', 'gang tay', 'glove', 'gym glove', 'phụ kiện tay', 'phu kien tay', 'wrist support', 'băng quấn tay', 'bang quan tay', 'strap', 'bảo vệ cổ tay', 'bao ve co tay'],
        emptyMessage: 'Hiện shop chưa có găng tay tập gym. Bạn có thể tham khảo băng quấn tay hoặc strap hỗ trợ nhé.',
    },
    dumbbell: {
        triggers: ['dumbbell', 'dumbell'],
        exactPhrases: ['tạ đơn'],
        phrases: ['dumbbell', 'dumbell'],
        terms: ['tạ đơn', 'dumbbell', 'dumbell'],
        emptyMessage: 'Hiện shop chưa có tạ đơn phù hợp. Bạn thử mô tả mức kg của tạ đơn rõ hơn nhé.',
    },
    barbell: {
        triggers: ['barbell'],
        exactPhrases: ['tạ đòn'],
        phrases: ['barbell'],
        terms: ['tạ đòn', 'barbell'],
        emptyMessage: 'Hiện shop chưa có tạ đòn phù hợp. Bạn thử mô tả mức kg của tạ đòn rõ hơn nhé.',
    },
    weight: {
        triggers: ['ta', 'dumbbell', 'dumbell'],
        terms: ['tạ', 'ta'],
        emptyMessage: 'Hiện shop chưa có sản phẩm tạ phù hợp. Bạn thử mô tả loại tạ hoặc mức kg rõ hơn nhé.',
    },
    resistance: {
        triggers: ['day'],
        terms: ['dây kháng lực', 'day khang luc', 'resistance band', 'band'],
        emptyMessage: 'Hiện shop chưa có dây kháng lực phù hợp. Bạn thử mô tả loại dây hoặc mức kháng lực rõ hơn nhé.',
    },
}

const detectStrictProductGroup = (query) => {
    const normalized = normalizeSearchText(query)
    const literal = normalizeLiteralText(query)
    const tokens = getSearchTokens(query)
    const exactPhraseMatch = Object.values(strictProductGroups).find((group) =>
        Array.isArray(group.exactPhrases) && group.exactPhrases.some((phrase) => literal.includes(normalizeLiteralText(phrase)))
    )
    if (exactPhraseMatch) return exactPhraseMatch

    const phraseMatch = Object.values(strictProductGroups).find((group) =>
        Array.isArray(group.phrases) && group.phrases.some((phrase) => normalized.includes(normalizeSearchText(phrase)))
    )
    if (phraseMatch) return phraseMatch

    return Object.values(strictProductGroups).find((group) =>
        tokens.some((token) => group.triggers.includes(token))
    ) || null
}

const productMatchesTerms = (product, terms, strictCategory = false) => {
    const source = strictCategory
        ? [product.category, product.name].filter(Boolean).join(' ')
        : [product.name, product.category, product.description].filter(Boolean).join(' ')
    const normalizedHaystack = normalizeSearchText(source)
    const literalHaystack = normalizeLiteralText(source)

    return terms.some((term) => {
        const hasVietnameseMarks = /[^\u0000-\u007f]/.test(term)
        return hasVietnameseMarks
            ? literalHaystack.includes(normalizeLiteralText(term))
            : normalizedHaystack.includes(normalizeSearchText(term))
    })
}

const extractRequestedWeight = (query) => {
    const match = normalizeSearchText(query).match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilo)\b/)
    if (!match) return null
    const value = Number(match[1].replace(',', '.'))
    return Number.isFinite(value) ? value : null
}

const parseVariantWeight = (label) => {
    const match = normalizeSearchText(label).match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilo)\b/)
    if (!match) return null
    const value = Number(match[1].replace(',', '.'))
    return Number.isFinite(value) ? value : null
}

const getProductVariantLabels = (product) => {
    const labels = [
        ...(Array.isArray(product.weightVariants) ? product.weightVariants.map((variant) => variant.label) : []),
        ...(Array.isArray(product.weights) ? product.weights : []),
    ]
    return [...new Set(labels.map((label) => String(label || '').trim()).filter(Boolean))]
}

const chooseClosestVariant = (product, requestedWeight) => {
    if (!requestedWeight) return ''
    const variants = getProductVariantLabels(product)
        .map((label) => ({ label, weight: parseVariantWeight(label) }))
        .filter((variant) => variant.weight != null)

    if (variants.length === 0) return ''
    return variants.sort((a, b) => Math.abs(a.weight - requestedWeight) - Math.abs(b.weight - requestedWeight))[0].label
}

const normalizeCategoryKey = (category) => normalizeLiteralText(category)

const slugifyCategory = (category) => normalizeCategoryKey(category).replace(/\s+/g, '-')

const isGeneralKnowledgeIntent = (query) => {
    const normalized = normalizeSearchText(query)
    const tokens = getSearchTokens(query)
    if (/(tom tat|giai thich|viet code|sua code|debug|la gi|vi sao|tai sao|kien thuc|cong nghe|bo phim|phim|anime)/i.test(normalized)) {
        return true
    }
    return tokens.some((token) => generalKnowledgeIntentWords.has(token))
}

const normalizeObject = (value) => (
    value && typeof value === 'object' && !Array.isArray(value) ? value : {}
)

const normalizeLanguage = (language) => language === 'en' ? 'en' : 'vi'

const normalizeWebSearchPayload = (webSearch) => {
    const safeWebSearch = normalizeObject(webSearch)
    return {
        needed: Boolean(safeWebSearch.needed),
        used: Boolean(safeWebSearch.used),
        reason: String(safeWebSearch.reason || 'not_needed'),
        results: Array.isArray(safeWebSearch.results) ? safeWebSearch.results : [],
    }
}

const normalizeSourcesPayload = (sources) => {
    if (Array.isArray(sources)) {
        return sources
            .filter((item) => item && typeof item === 'object' && typeof item.url === 'string' && item.url.trim())
            .map((item) => ({
                title: typeof item.title === 'string' ? item.title : '',
                url: item.url,
            }))
            .slice(0, 5)
    }
    return normalizeObject(sources)
}

const cleanAssistantAnswer = (value) => {
    const cleaned = String(value || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/^```[a-z0-9_-]*\s*/i, '')
        .replace(/\s*```$/i, '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
    if (/^\s*\{[\s\S]*\}\s*$/.test(cleaned)) {
        try {
            const parsed = JSON.parse(cleaned)
            return typeof parsed?.answer === 'string' ? parsed.answer.trim() : ''
        } catch {
            return ''
        }
    }
    return cleaned
}

const normalizeAiActionResponse = (response, mode = 'gym') => {
    const safeResponse = normalizeObject(response)
    const safeData = normalizeObject(safeResponse.data)
    const plans = Array.isArray(safeResponse.plans) ? safeResponse.plans : []
    return {
        ...safeResponse,
        answer: typeof safeResponse.answer === 'string' ? cleanAssistantAnswer(safeResponse.answer) : '',
        suggestions: Array.isArray(safeResponse.suggestions)
            ? safeResponse.suggestions.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 4)
            : [],
        mode: safeResponse.mode === 'general' ? 'general' : mode,
        tool: typeof safeResponse.tool === 'string' ? safeResponse.tool : null,
        data: safeData,
        pts: Array.isArray(safeResponse.pts) ? safeResponse.pts : Array.isArray(safeData.pts) ? safeData.pts : [],
        products: Array.isArray(safeResponse.products) ? safeResponse.products : Array.isArray(safeData.products) ? safeData.products : [],
        ...(plans.length > 0 ? { plans } : {}),
        sources: normalizeSourcesPayload(safeResponse.sources),
        metadata: normalizeObject(safeResponse.metadata),
        webSearch: normalizeWebSearchPayload(safeResponse.webSearch),
    }
}

const updateAiMemoryAfterResponse = async (req, query, mode) => {
    try {
        await updateAiUserMemoryIfDue({
            userId: req.user?._id,
            query,
            mode,
        })
    } catch (error) {
        console.error('AI memory update error:', error)
    }
}

const sanitizeConversationContext = (value) => {
    const source = value && typeof value === 'object' ? value : {}
    const recentMessages = Array.isArray(source.recentMessages)
        ? source.recentMessages
            .slice(-10)
            .filter((message) => message && typeof message.content === 'string')
            .map((message) => ({
                role: ['user', 'assistant', 'system'].includes(message.role) ? message.role : 'user',
                content: String(message.content).slice(0, 1200),
                intent: typeof message.intent === 'string' ? message.intent : undefined,
                action: typeof message.action === 'string' ? message.action : undefined,
                subject: typeof message.subject === 'string' ? message.subject : undefined,
            }))
        : []

    return {
        conversationId: typeof source.conversationId === 'string' ? source.conversationId.slice(0, 120) : '',
        sessionId: typeof source.sessionId === 'string' ? source.sessionId.slice(0, 120) : '',
        recentMessages,
        lastIntent: typeof source.lastIntent === 'string' ? source.lastIntent : '',
        lastSubject: typeof source.lastSubject === 'string' ? source.lastSubject : '',
        lastAction: typeof source.lastAction === 'string' ? source.lastAction : '',
        lastSearchQuery: typeof source.lastSearchQuery === 'string' ? source.lastSearchQuery.slice(0, 300) : '',
        lastMode: typeof source.lastMode === 'string' ? source.lastMode : '',
        lastProduct: typeof source.lastProduct === 'string' ? source.lastProduct : '',
        lastThemeAction: source.lastThemeAction && typeof source.lastThemeAction === 'object'
            ? {
                themeName: typeof source.lastThemeAction.themeName === 'string' ? source.lastThemeAction.themeName : '',
                color: typeof source.lastThemeAction.color === 'string' ? source.lastThemeAction.color : '',
            }
            : undefined,
    }
}

const isShortContextFollowUp = (query) => getSearchTokens(query).length <= 5

const buildEffectiveQuery = (query, conversationContext) => {
    const normalized = normalizeSearchText(query)
    if (!isShortContextFollowUp(query)) return query

    if (
        conversationContext.lastSearchQuery
        && (
            /\b(re hon|gia re|thap hon|mem hon|dat hon|cao cap hon|loai re|loai nao re|cai dau tien|cai thu nhat)\b/.test(normalized)
            || /\b(loai|cai|mau|ban|option)\b/.test(normalized)
        )
    ) {
        return `${conversationContext.lastSearchQuery} ${query}`
    }

    return query
}

const isUrlLookupIntent = (query) => {
    const normalized = normalizeSearchText(query)
    const tokens = getSearchTokens(query)
    return tokens.some((token) => urlLookupIntentWords.has(token))
        || normalized.includes('o dau')
        || normalized.includes('trang web')
        || normalized.includes('nguon')
        || normalized.includes('tai lieu')
}

const detectToolIntent = (query, mode = 'gym') => {
    const normalized = normalizeSearchText(query)
    const tokens = getSearchTokens(query)
    const tokenSet = new Set(tokens)
    const isGeneralMode = mode === 'general'

    if (isGeneralMode && isGeneralKnowledgeIntent(query)) {
        return null
    }

    if (isGeneralMode && isUrlLookupIntent(query)) {
        return null
    }

    const hasProductAction = tokens.some((token) => productActionWords.has(token)) || normalized.includes('san pham')
    const hasProductKeyword = tokens.some((token) => productWords.has(token)) || normalized.includes('may tap') || normalized.includes('giay gym')
    const hasExplicitProductIntent = tokens.some((token) => explicitProductIntentWords.has(token))
        || normalized.includes('san pham')
        || normalized.includes('danh muc')
        || normalized.includes('cua hang')
        || normalized.includes('bao nhieu tien')
        || normalized.includes('gia bao nhieu')
    const isProduct = isGeneralMode
        ? hasExplicitProductIntent && (hasProductKeyword || normalized.includes('san pham') || normalized.includes('shop') || normalized.includes('cua hang'))
        : hasProductKeyword || (hasProductAction && !tokenSet.has('pt') && !normalized.includes('huan luyen vien'))
    const isPt = tokens.some((token) => ptWords.has(token)) || normalized.includes('huan luyen vien')
        || (tokens.includes('tim') && tokens.some((token) => ptGoalWords.has(token)))
    const isExplicitPt = isPt && (
        tokens.some((token) => explicitPtIntentWords.has(token))
        || normalized.includes('huan luyen vien')
        || normalized.includes('pt')
    )
    if (isGeneralMode && isExplicitPt && !hasProductKeyword) return 'pt'
    if (!isGeneralMode && isPt && !hasProductKeyword) return 'pt'
    if (isProduct) return 'product'
    if (!isGeneralMode && isPt) return 'pt'
    return null
}

const extractDateRange = (query) => {
    const currentYear = new Date().getFullYear()
    const matches = [...query.matchAll(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/g)]

    const toIsoDate = (match) => {
        const day = Number(match[1])
        const month = Number(match[2])
        const rawYear = match[3] ? Number(match[3]) : currentYear
        const year = rawYear < 100 ? 2000 + rawYear : rawYear
        if (!day || !month || month > 12 || day > 31) return ''
        return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
    }

    return {
        availableFrom: matches[0] ? toIsoDate(matches[0]) : '',
        availableTo: matches[1] ? toIsoDate(matches[1]) : '',
    }
}

const getProductSearchTerms = (query) => {
    const tokens = getSearchTokens(query)
        .filter((token) => !productStopWords.has(token))
        .filter((token) => !/^\d+$/.test(token) && token !== 'kg' && token !== 'kilo' && token !== 'kilogram')
    const terms = new Set()

    tokens.forEach((token) => {
        if (productSynonyms[token]) {
            productSynonyms[token].forEach((term) => terms.add(term))
        } else {
            terms.add(token)
        }
    })

    return [...terms].filter(Boolean)
}

const getCategorySearchTerms = (query) => {
    const tokens = getSearchTokens(query).filter((token) => !productStopWords.has(token))
    const terms = new Set()

    tokens.forEach((token) => {
        if (categorySynonyms[token]) {
            categorySynonyms[token].forEach((term) => terms.add(term))
        } else if (!/^\d+$/.test(token) && token !== 'kg') {
            terms.add(token)
        }
    })

    return [...terms].filter(Boolean)
}

const buildGlobalCategoryPayload = async (searchTerms = []) => {
    const products = await Product.find({ isActive: true })
        .select('category')
        .lean()
    const categoryMap = new Map()

    products.forEach((product) => {
        const category = String(product.category || '').trim()
        if (!category) return
        const key = normalizeCategoryKey(category)
        if (!key || categoryMap.has(key)) return
        categoryMap.set(key, { name: key, slug: slugifyCategory(category) })
    })

    const categories = [...categoryMap.values()]
    const filtered = searchTerms.length > 0
        ? categories.filter((category) => {
            const key = normalizeCategoryKey(category.name)
            return searchTerms.some((term) => key.includes(normalizeCategoryKey(term)) || normalizeCategoryKey(term).includes(key))
        })
        : categories

    return {
        type: 'category_list',
        items: (filtered.length > 0 ? filtered : categories).slice(0, 8),
    }
}

const extractPtGoal = (query) => {
    const goalMatch = query.match(/(giảm mỡ|giảm cân|tăng cơ|tăng cân|tăng sức mạnh|pt nữ|pt nam|lịch tập|dinh dưỡng)/i)
    if (goalMatch) return goalMatch[1]
    return query
        .replace(/tìm|kiếm|pt|huấn luyện viên|coach|trainer|cho tôi|giúp tôi|từ ngày|đến ngày/gi, ' ')
        .replace(/\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

const createEmptyToolPayload = () => ({
    type: 'empty',
    message: 'Mình chưa tìm thấy đúng kết quả. Bạn thử mô tả rõ hơn hoặc mình gợi ý cái gần nhất nhé!',
})

const mapPtResult = (pt) => ({
    _id: pt._id,
    name: pt.name,
    specialties: pt.specialties || [],
    rating: pt.rating || 0,
    experienceYears: pt.experienceYears || 0,
    bio: pt.bio || '',
})

const mapPtToolItem = (pt) => ({
    name: pt.name || '',
    avatar: pt.avatar || '',
    phone: pt.phone || '',
    email: pt.email || '',
    specialty: Array.isArray(pt.specialties) ? pt.specialties.join(', ') : pt.specialties || pt.bio || '',
})

const mapProductResult = (product) => ({
    _id: product._id,
    name: product.name,
    price: product.price,
    category: product.category,
    description: product.description,
    image: product.image,
})

const mapProductToolItem = (product, selectedVariant = '') => ({
    name: product.name || '',
    price: Number(product.price) || 0,
    image: product.image || product.images?.[0] || '',
    link: `/dashboard/member/store/${product._id}`,
    ...(selectedVariant ? { selectedVariant } : {}),
})

const createWebSearchState = (needed = false, reason = 'not_needed') => ({
    needed,
    used: false,
    reason,
    results: [],
})

const resolveShopeeLinkResponse = async (query, mode = 'general') => {
    let webSearch = createWebSearchState(true, 'not_started')

    try {
        webSearch = {
            needed: true,
            ...await searchWeb(getShopeeWebSearchQuery(query), { maxResults: 5 }),
        }
    } catch (error) {
        console.error('Tavily Shopee link search error:', error)
        webSearch = createWebSearchState(true, 'search_failed')
    }

    const answer = buildShopeeLinkAnswer(query, webSearch.results)

    return {
        answer,
        pts: [],
        products: [],
        plans: [],
        mode,
        webSearch: {
            needed: true,
            used: webSearch.used,
            reason: webSearch.reason,
            results: webSearch.results,
        },
    }
}

const resolveGymFitnessWebSearch = async (query) => {
    const needsWebSearch = shouldSearchFitnessWeb(query)
    let webSearch = createWebSearchState(needsWebSearch, needsWebSearch ? 'not_started' : 'not_fitness_search')
    if (!needsWebSearch) return webSearch

    try {
        webSearch = {
            needed: true,
            ...await searchFitnessWeb(query, { maxResults: 5 }),
        }
    } catch (error) {
        console.error('Tavily gym fitness web search error:', error)
        webSearch = createWebSearchState(true, 'search_failed')
    }

    return webSearch
}

const mapPlanResult = (plan) => ({
    _id: plan._id,
    nameVi: plan.nameVi,
    nameEn: plan.nameEn,
    price: plan.price,
    durationDays: plan.durationDays,
    descriptionVi: plan.descriptionVi,
    descriptionEn: plan.descriptionEn,
    featuresVi: plan.featuresVi || [],
    featuresEn: plan.featuresEn || [],
    color: plan.color,
})

export const aiAssistant = async (req, res, next) => {
    try {
        const { query, mode = 'gym' } = req.body

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return next(new AppError('Vui lòng nhập câu hỏi', 400))
        }

        const normalizedQuery = query.trim()
        const conversationContext = sanitizeConversationContext(req.body?.conversationContext)
        const requestContext = req.body?.requestContext && typeof req.body.requestContext === 'object'
            ? req.body.requestContext
            : {}
        const language = normalizeLanguage(req.body?.language || requestContext.language)
        console.log('CHAT REQUEST:', {
            message: normalizedQuery,
            assistantType: requestContext.assistantType || 'member',
            domain: requestContext.domain || 'gym',
            language,
            mode: requestContext.mode || 'chat',
            tab: mode === 'general' ? 'Khác' : 'Gym',
            intent: requestContext.intent || 'member_question',
            source: requestContext.source || 'user_message',
        })
        const effectiveQuery = buildEffectiveQuery(normalizedQuery, conversationContext)
        const aiMode = mode === 'general' ? 'general' : 'gym'
        const memoryContext = buildAiMemoryContext(await getAiUserMemory(req.user?._id))

        if (aiMode === 'gym') {
            const actionResponse = await runGymAiAction({
                query: effectiveQuery,
                userMessage: normalizedQuery,
                user: req.user,
                conversationContext,
                language,
            })

            await recordAuditLog({
                req,
                module: 'ai',
                action: 'create',
                entity: req.user,
                details: `AI Gym Action query: ${normalizedQuery} | tool: ${actionResponse.tool || 'none'}`,
            })

            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
        return res.json({
            ...actionResponse,
            pts: actionResponse.data?.pts || [],
            products: actionResponse.data?.products || [],
        })
        }

        if (aiMode !== 'gym' && isShopeeLinkIntent(effectiveQuery)) {
            const shopeeResponse = await resolveShopeeLinkResponse(effectiveQuery, aiMode)
            await recordAuditLog({
                req,
                module: 'ai',
                action: 'create',
                entity: req.user,
                details: `AI Shopee link lookup: ${normalizedQuery} | webSearch: ${shopeeResponse.webSearch.used ? 'used' : 'fallback_search_url'} | mode: ${aiMode}`,
            })
            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
            return res.json(shopeeResponse)
        }

        const toolIntent = detectToolIntent(effectiveQuery, aiMode)

        if (toolIntent === 'product') {
            const categoryRequested = normalizeSearchText(effectiveQuery).includes('danh muc') || normalizeSearchText(effectiveQuery).includes('category')
            const strictGroup = detectStrictProductGroup(effectiveQuery)
            const searchTerms = getProductSearchTerms(effectiveQuery)
            const categoryTerms = getCategorySearchTerms(effectiveQuery)
            const requestedWeight = extractRequestedWeight(effectiveQuery)
            const effectiveSearchTerms = strictGroup ? strictGroup.terms : searchTerms
            const queryRegex = buildSearchRegex(effectiveSearchTerms)
            let usedFallback = false
            let productResults = await Product.find({
                isActive: true,
                $or: [
                    { name: queryRegex },
                    { category: queryRegex },
                    { description: queryRegex },
                ],
            })
                .select('name price image images category weights weightVariants stock')
                .limit(8)
                .lean()
            if (strictGroup) {
                productResults = productResults.filter((product) => productMatchesTerms(product, strictGroup.terms, true))
            }

            if (productResults.length === 0 && categoryTerms.length > 0) {
                usedFallback = true
                const categoryRegex = buildSearchRegex(strictGroup ? strictGroup.terms : categoryTerms)
                productResults = await Product.find({
                    isActive: true,
                    category: categoryRegex,
                })
                    .select('name price image images category weights weightVariants stock')
                    .limit(8)
                    .lean()
                if (strictGroup) {
                    productResults = productResults.filter((product) => productMatchesTerms(product, strictGroup.terms, true))
                }
            }

            if (!strictGroup && productResults.length === 0 && searchTerms.length > 0) {
                usedFallback = true
                const fallbackTerms = searchTerms.flatMap((term) => categorySynonyms[normalizeSearchText(term)] || [term])
                const fallbackRegex = buildSearchRegex(fallbackTerms)
                productResults = await Product.find({
                    isActive: true,
                    $or: [
                        { name: fallbackRegex },
                        { category: fallbackRegex },
                        { description: fallbackRegex },
                    ],
                })
                    .select('name price image images category weights weightVariants stock')
                    .limit(8)
                    .lean()
            }

            if (productResults.length === 0 && categoryRequested) {
                const payload = await buildGlobalCategoryPayload(strictGroup ? strictGroup.terms : categoryTerms)
                await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
                return res.json({
                    answer: JSON.stringify(payload),
                    pts: [],
                    products: [],
                    plans: [],
                    mode: aiMode,
                    tool: 'searchProducts',
                    data: payload,
                })
            }

            if (!strictGroup && productResults.length === 0) {
                usedFallback = true
                productResults = await Product.find({ isActive: true })
                    .select('name price image images category weights weightVariants stock')
                    .sort({ stock: -1, createdAt: -1 })
                    .limit(8)
                    .lean()
            }

            if (strictGroup && productResults.length === 0) {
                const payload = {
                    type: 'empty',
                    message: strictGroup.emptyMessage,
                }

                await recordAuditLog({
                    req,
                    module: 'ai',
                    action: 'create',
                    entity: req.user,
                    details: `AI tool searchProducts strict group empty | keyword: ${searchTerms.join(', ') || effectiveQuery} | mode: ${aiMode}`,
                })

                await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)

                return res.json({
                    answer: JSON.stringify(payload),
                    pts: [],
                    products: [],
                    plans: [],
                    mode: aiMode,
                    tool: 'searchProducts',
                    data: payload,
                })
            }

            let message = usedFallback && productResults.length > 0 && searchTerms.length > 0
                ? 'Mình chưa thấy kết quả khớp hoàn toàn, nên gợi ý vài sản phẩm gần nhất để bạn tham khảo nhé.'
                : ''
            const items = productResults.map((product) => {
                const selectedVariant = chooseClosestVariant(product, requestedWeight)
                return mapProductToolItem(product, selectedVariant)
            })

            if (requestedWeight && items.length > 0) {
                const exactItem = items.find((item) => parseVariantWeight(item.selectedVariant) === requestedWeight)
                if (exactItem?.selectedVariant) {
                    message = `Bạn đang xem mức ${exactItem.selectedVariant}, bạn có thể chọn đúng mức này để phù hợp bài tập nhé.`
                } else {
                    const firstVariant = items.find((item) => item.selectedVariant)?.selectedVariant
                    if (firstVariant) {
                        message = `Shop hiện chưa có đúng mức ${requestedWeight}kg. Mức gần nhất mình thấy là ${firstVariant}, bạn có thể tham khảo nhé.`
                    }
                }
            }

            const payload = items.length > 0
                ? { type: 'product_list', items, ...(message ? { message } : {}) }
                : createEmptyToolPayload()

            await recordAuditLog({
                req,
                module: 'ai',
                action: 'create',
                entity: req.user,
                details: `AI tool searchProducts keyword: ${searchTerms.join(', ') || effectiveQuery} | mode: ${aiMode}`,
            })

            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)

            return res.json({
                answer: JSON.stringify(payload),
                pts: [],
                products: productResults.map(mapProductResult),
                plans: [],
                mode: aiMode,
                tool: 'searchProducts',
                data: payload,
            })
        }

        if (toolIntent === 'pt') {
            const goal = extractPtGoal(effectiveQuery)
            const { availableFrom, availableTo } = extractDateRange(effectiveQuery)
            const queryRegex = buildSearchRegex(goal ? [goal] : [])
            const ptResults = await User.find({
                role: 'pt',
                isActive: true,
                $or: [
                    { name: queryRegex },
                    { bio: queryRegex },
                    { specialties: queryRegex },
                ],
            })
                .select('name avatar phone email specialties bio')
                .limit(8)
                .lean()

            const payload = ptResults.length > 0
                ? { type: 'pt_list', items: ptResults.map(mapPtToolItem) }
                : createEmptyToolPayload()

            await recordAuditLog({
                req,
                module: 'ai',
                action: 'create',
                entity: req.user,
                details: `AI tool searchPT goal: ${goal || normalizedQuery} | from: ${availableFrom || 'none'} | to: ${availableTo || 'none'} | mode: ${aiMode}`,
            })

            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)

            return res.json({
                answer: JSON.stringify(payload),
                pts: ptResults.map(mapPtResult),
                products: [],
                plans: [],
                mode: aiMode,
                tool: 'searchPT',
                data: payload,
            })
        }

        if (isPrivacyQuestion(normalizedQuery)) {
            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
            return res.json({
                answer: 'Tôi không thể cung cấp thông tin cá nhân của người dùng khác.',
                pts: [],
                products: [],
                plans: [],
                mode: aiMode,
            })
        }

        if (aiMode === 'general') {
            const needsWebSearch = shouldSearchWeb(effectiveQuery)
            let webSearch = {
                needed: needsWebSearch,
                used: false,
                reason: needsWebSearch ? 'not_started' : 'simple_query',
                results: [],
            }

            if (needsWebSearch) {
                try {
                    webSearch = {
                        needed: true,
                        ...await searchWeb(effectiveQuery, { maxResults: 5 }),
                    }
                } catch (error) {
                    console.error('Tavily web search error:', error)
                    webSearch = {
                        needed: true,
                        used: false,
                        reason: 'search_failed',
                        results: [],
                    }
                }
            }

            if (needsWebSearch && !webSearch.used) {
                const missingKeyMessage = webSearch.reason === 'missing_api_key'
                    ? 'Câu hỏi này cần dữ liệu realtime, nhưng backend chưa cấu hình TAVILY_API_KEY để search web.'
                    : 'Câu hỏi này cần dữ liệu realtime, nhưng hiện Tavily web search đang lỗi. Mình chưa thể trả lời chắc chắn mà không có nguồn mới.'

                await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)

                return res.json({
                    answer: missingKeyMessage,
                    pts: [],
                    products: [],
                    plans: [],
                    mode: aiMode,
                    webSearch,
                })
            }

            const answer = await generateAssistantResponse(
                effectiveQuery,
                [],
                [],
                [],
                aiMode,
                {
                    webContext: webSearch.context || '',
                    webSearchUsed: webSearch.used,
                    memoryContext,
                    conversationContext,
                    language,
                },
            )
            logAiAnswerBeforeSend('general', answer)

            await recordAuditLog({
                req,
                module: 'ai',
                action: 'create',
                entity: req.user,
                details: `AI Assistant general query: ${normalizedQuery} | webSearch: ${webSearch.used ? 'used' : 'skipped'} | reason: ${webSearch.reason}`,
            })

            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)

            return res.json({
                answer,
                pts: [],
                products: [],
                plans: [],
                mode: aiMode,
                webSearch: {
                    needed: webSearch.needed,
                    used: webSearch.used,
                    reason: webSearch.reason,
                    results: webSearch.results,
                },
            })
        }

        const classification = await classifyQueryIntent(effectiveQuery)
        const searchTerms = [classification.goal, ...(classification.keywords || []), effectiveQuery]
        const queryRegex = buildSearchRegex(searchTerms)

        const ptFilter = {
            role: 'pt',
            isActive: true,
            $or: [
                { name: queryRegex },
                { bio: queryRegex },
                { specialties: queryRegex },
            ],
        }

        const productFilter = {
            isActive: true,
            $or: [
                { name: queryRegex },
                { category: queryRegex },
                { description: queryRegex },
            ],
        }

        const planFilter = {
            isActive: true,
            $or: [
                { name: queryRegex },
                { description: queryRegex },
            ],
        }

        const priceSort = classification.budget === 'rẻ' ? { price: 1 } : classification.budget === 'cao cấp' ? { price: -1 } : { price: 1 }

        const [ptResults, productResults, planResults] = await Promise.all([
            User.find(ptFilter)
                .select('name specialties rating experienceYears bio')
                .limit(6)
                .lean(),
            Product.find(productFilter)
                .select('name price category description image')
                .sort(priceSort)
                .limit(6)
                .lean(),
            Plan.find(planFilter)
                .select('name price durationDays description color')
                .sort(priceSort)
                .limit(6)
                .lean(),
        ])

        const pts = ptResults.map(mapPtResult)
        const products = productResults.map(mapProductResult)
        const plans = planResults.map(mapPlanResult)
        const webSearch = await resolveGymFitnessWebSearch(effectiveQuery)

        const answer = await generateAssistantResponse(effectiveQuery, pts, products, plans, aiMode, {
            memoryContext,
            conversationContext,
            webContext: webSearch.context || '',
            webSearchUsed: webSearch.used,
            language,
        })
        logAiAnswerBeforeSend(aiMode, answer)

        await recordAuditLog({
            req,
            module: 'ai',
            action: 'create',
            entity: req.user,
            details: `AI Assistant được gọi với truy vấn: ${normalizedQuery} | mode: ${aiMode} | fitnessWebSearch: ${webSearch.used ? 'used' : webSearch.reason}`,
        })

        await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)

        res.json({
            answer,
            pts,
            products,
            plans,
            mode: aiMode,
            webSearch: {
                needed: webSearch.needed,
                used: webSearch.used,
                reason: webSearch.reason,
                results: webSearch.results,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const aiAssistantStream = async (req, res, next) => {
    try {
        const { query, mode = 'gym' } = req.body

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return next(new AppError('Vui lòng nhập câu hỏi', 400))
        }

        const normalizedQuery = query.trim()
        const conversationContext = sanitizeConversationContext(req.body?.conversationContext)
        const requestContext = req.body?.requestContext && typeof req.body.requestContext === 'object'
            ? req.body.requestContext
            : {}
        const language = normalizeLanguage(req.body?.language || requestContext.language)
        console.log('CHAT REQUEST:', {
            message: normalizedQuery,
            assistantType: requestContext.assistantType || 'member',
            domain: requestContext.domain || 'gym',
            language,
            mode: requestContext.mode || 'chat',
            tab: mode === 'general' ? 'Khác' : 'Gym',
            intent: requestContext.intent || 'member_question',
            source: requestContext.source || 'user_message',
        })
        const effectiveQuery = buildEffectiveQuery(normalizedQuery, conversationContext)
        const aiMode = mode === 'general' ? 'general' : 'gym'
        const memoryContext = buildAiMemoryContext(await getAiUserMemory(req.user?._id))

        initSseResponse(res)

        req.on('close', () => {
            console.log(`[AI Assistant stream] client closed connection | mode: ${aiMode}`)
        })

        if (aiMode === 'gym') {
            writeSseEvent(res, 'meta', {
                mode: aiMode,
                aiAction: true,
                toolCalling: true,
                status: 'calling_tool',
            })

            const actionResponse = await runGymAiAction({
                query: effectiveQuery,
                userMessage: normalizedQuery,
                user: req.user,
                conversationContext,
                language,
            })
            const safeActionResponse = normalizeAiActionResponse(actionResponse, aiMode)

            writeSseEvent(res, 'meta', {
                mode: aiMode,
                aiAction: Boolean(safeActionResponse.aiAction),
                tool: safeActionResponse.tool || null,
                status: 'tool_complete',
            })
            writeSseEvent(res, 'chunk', { text: safeActionResponse.answer })
            writeSseEvent(res, 'done', {
                ...safeActionResponse,
            })

            await recordAuditLog({
                req,
                module: 'ai',
                action: 'create',
                entity: req.user,
                details: `AI Gym Action stream query: ${normalizedQuery} | tool: ${safeActionResponse.tool || 'none'}`,
            })
            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
            return res.end()
        }

        if (aiMode !== 'gym' && isShopeeLinkIntent(effectiveQuery)) {
            const shopeeResponse = await resolveShopeeLinkResponse(effectiveQuery, aiMode)
            writeSseEvent(res, 'meta', {
                mode: aiMode,
                webSearch: shopeeResponse.webSearch,
            })
            writeSseEvent(res, 'chunk', { text: shopeeResponse.answer })
            writeSseEvent(res, 'done', shopeeResponse)
            await recordAuditLog({
                req,
                module: 'ai',
                action: 'create',
                entity: req.user,
                details: `AI Shopee link stream lookup: ${normalizedQuery} | webSearch: ${shopeeResponse.webSearch.used ? 'used' : 'fallback_search_url'} | mode: ${aiMode}`,
            })
            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
            return res.end()
        }

        const toolIntent = detectToolIntent(effectiveQuery, aiMode)

        if (toolIntent) {
            writeSseEvent(res, 'fallback', {
                reason: `tool_${toolIntent}`,
                message: 'Tool response uses JSON fallback.',
            })
            writeSseEvent(res, 'done', { answer: '', mode: aiMode, fallback: true })
            return res.end()
        }

        if (isPrivacyQuestion(normalizedQuery)) {
            const answer = 'Tôi không thể cung cấp thông tin cá nhân của người dùng khác.'
            writeSseEvent(res, 'chunk', { text: answer })
            writeSseEvent(res, 'done', { answer, mode: aiMode })
            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
            return res.end()
        }

        let webSearch = {
            needed: false,
            used: false,
            reason: 'not_needed',
            results: [],
        }

        if (aiMode === 'general') {
            const needsWebSearch = shouldSearchWeb(effectiveQuery)
            webSearch = {
                needed: needsWebSearch,
                used: false,
                reason: needsWebSearch ? 'not_started' : 'simple_query',
                results: [],
            }

            if (needsWebSearch) {
                try {
                    webSearch = {
                        needed: true,
                        ...await searchWeb(effectiveQuery, { maxResults: 5 }),
                    }
                } catch (error) {
                    console.error('Tavily web search stream error:', error)
                    webSearch = {
                        needed: true,
                        used: false,
                        reason: 'search_failed',
                        results: [],
                    }
                }
            }

            writeSseEvent(res, 'meta', {
                mode: aiMode,
                webSearch: {
                    needed: webSearch.needed,
                    used: webSearch.used,
                    reason: webSearch.reason,
                    results: webSearch.results,
                },
            })

            if (needsWebSearch && !webSearch.used) {
                const answer = webSearch.reason === 'missing_api_key'
                    ? 'Câu hỏi này cần dữ liệu realtime, nhưng backend chưa cấu hình TAVILY_API_KEY để search web.'
                    : 'Câu hỏi này cần dữ liệu realtime, nhưng hiện Tavily web search đang lỗi. Mình chưa thể trả lời chắc chắn mà không có nguồn mới.'
                writeSseEvent(res, 'chunk', { text: answer })
                writeSseEvent(res, 'done', { answer, mode: aiMode, webSearch })
                await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
                return res.end()
            }

            const answer = await generateAssistantResponseStream(
                effectiveQuery,
                [],
                [],
                [],
                aiMode,
                {
                    webContext: webSearch.context || '',
                    webSearchUsed: webSearch.used,
                    memoryContext,
                    conversationContext,
                    language,
                    onChunk: (text) => writeSseEvent(res, 'chunk', { text }),
                },
            )

            logAiAnswerBeforeSend('general-stream', answer)

            await recordAuditLog({
                req,
                module: 'ai',
                action: 'create',
                entity: req.user,
                details: `AI Assistant general stream query: ${normalizedQuery} | webSearch: ${webSearch.used ? 'used' : 'skipped'} | reason: ${webSearch.reason}`,
            })

            writeSseEvent(res, 'done', {
                answer,
                mode: aiMode,
                webSearch: {
                    needed: webSearch.needed,
                    used: webSearch.used,
                    reason: webSearch.reason,
                    results: webSearch.results,
                },
            })
            await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
            return res.end()
        }

        const classification = await classifyQueryIntent(effectiveQuery)
        const searchTerms = [classification.goal, ...(classification.keywords || []), effectiveQuery]
        const queryRegex = buildSearchRegex(searchTerms)
        const priceSort = classification.budget === 'rẻ' ? { price: 1 } : classification.budget === 'cao cấp' ? { price: -1 } : { price: 1 }

        const [ptResults, productResults, planResults] = await Promise.all([
            User.find({
                role: 'pt',
                isActive: true,
                $or: [
                    { name: queryRegex },
                    { bio: queryRegex },
                    { specialties: queryRegex },
                ],
            })
                .select('name specialties rating experienceYears bio')
                .limit(6)
                .lean(),
            Product.find({
                isActive: true,
                $or: [
                    { name: queryRegex },
                    { category: queryRegex },
                    { description: queryRegex },
                ],
            })
                .select('name price category description image')
                .sort(priceSort)
                .limit(6)
                .lean(),
            Plan.find({
                isActive: true,
                $or: [
                    { name: queryRegex },
                    { description: queryRegex },
                ],
            })
                .select('name price durationDays description color')
                .sort(priceSort)
                .limit(6)
                .lean(),
        ])

        const pts = ptResults.map(mapPtResult)
        const products = productResults.map(mapProductResult)
        const plans = planResults.map(mapPlanResult)
        const gymWebSearch = await resolveGymFitnessWebSearch(effectiveQuery)

        writeSseEvent(res, 'meta', {
            mode: aiMode,
            pts,
            products,
            plans,
            webSearch: {
                needed: gymWebSearch.needed,
                used: gymWebSearch.used,
                reason: gymWebSearch.reason,
                results: gymWebSearch.results,
            },
        })

        const answer = await generateAssistantResponseStream(
            effectiveQuery,
            pts,
            products,
            plans,
            aiMode,
            {
                memoryContext,
                conversationContext,
                webContext: gymWebSearch.context || '',
                webSearchUsed: gymWebSearch.used,
                language,
                onChunk: (text) => writeSseEvent(res, 'chunk', { text }),
            },
        )

        logAiAnswerBeforeSend('gym-stream', answer)

        await recordAuditLog({
            req,
            module: 'ai',
            action: 'create',
            entity: req.user,
            details: `AI Assistant stream được gọi với truy vấn: ${normalizedQuery} | mode: ${aiMode} | fitnessWebSearch: ${gymWebSearch.used ? 'used' : gymWebSearch.reason}`,
        })

        writeSseEvent(res, 'done', {
            answer,
            pts,
            products,
            plans,
            mode: aiMode,
            webSearch: {
                needed: gymWebSearch.needed,
                used: gymWebSearch.used,
                reason: gymWebSearch.reason,
                results: gymWebSearch.results,
            },
        })
        await updateAiMemoryAfterResponse(req, normalizedQuery, aiMode)
        return res.end()
    } catch (error) {
        if (res.headersSent) {
            console.error('AI Assistant stream error:', error)
            writeSseEvent(res, 'error', { message: error?.message || 'Lỗi streaming AI' })
            return res.end()
        }
        return next(error)
    }
}

export const aiWebSearch = async (req, res, next) => {
    try {
        const { query } = req.body
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return next(new AppError('Vui lòng nhập câu hỏi', 400))
        }

        const normalizedQuery = query.trim()
        const needed = shouldSearchWeb(normalizedQuery)
        if (!needed) {
            return res.json({
                needed,
                used: false,
                reason: 'simple_query',
                results: [],
            })
        }

        const result = await searchWeb(normalizedQuery, { maxResults: 5 })
        return res.json({
            needed,
            used: result.used,
            reason: result.reason,
            results: result.results,
        })
    } catch (error) {
        next(error)
    }
}

export const getAiChatHistory = async (req, res, next) => {
    try {
        const history = await AiChatHistory.findOne({ userId: req.user._id }).lean()
        return res.json({
            sessions: history?.sessions || [],
            activeSessionId: history?.activeSessionId || '',
        })
    } catch (error) {
        next(error)
    }
}

export const saveAiChatHistory = async (req, res, next) => {
    try {
        const sessions = normalizeSessions(req.body?.sessions)
        const activeSessionId = String(req.body?.activeSessionId || sessions[0]?.sessionId || '')

        const history = await AiChatHistory.findOneAndUpdate(
            { userId: req.user._id },
            { userId: req.user._id, sessions, activeSessionId },
            { returnDocument: 'after', upsert: true, runValidators: true },
        ).lean()

        return res.json({
            sessions: history.sessions || [],
            activeSessionId: history.activeSessionId || '',
        })
    } catch (error) {
        next(error)
    }
}

export const renameAiChatSession = async (req, res, next) => {
    try {
        const sessionId = String(req.params.sessionId || '')
        const title = String(req.body?.title || '').trim().slice(0, 120)

        if (!sessionId) return next(new AppError('Thiếu sessionId', 400))
        if (!title) return next(new AppError('Tên cuộc trò chuyện không được trống', 400))

        const history = await AiChatHistory.findOne({ userId: req.user._id })
        if (!history) return next(new AppError('Không tìm thấy lịch sử chat', 404))

        const session = history.sessions.find((item) => item.sessionId === sessionId)
        if (!session) return next(new AppError('Không tìm thấy cuộc trò chuyện', 404))

        session.title = title
        history.sessions = normalizeSessions(history.sessions)
        if (!history.sessions.some((item) => item.sessionId === history.activeSessionId)) {
            history.activeSessionId = history.sessions[0]?.sessionId || ''
        }
        await history.save()

        return res.json({
            sessions: history.sessions || [],
            activeSessionId: history.activeSessionId || '',
        })
    } catch (error) {
        next(error)
    }
}

export const deleteAiChatSession = async (req, res, next) => {
    try {
        const sessionId = String(req.params.sessionId || '')
        if (!sessionId) return next(new AppError('Thiếu sessionId', 400))

        const history = await AiChatHistory.findOne({ userId: req.user._id })
        if (!history) {
            return res.json({ sessions: [], activeSessionId: '' })
        }

        history.sessions = normalizeSessions(history.sessions.filter((session) => session.sessionId !== sessionId))
        if (history.activeSessionId === sessionId || !history.sessions.some((session) => session.sessionId === history.activeSessionId)) {
            history.activeSessionId = history.sessions[0]?.sessionId || ''
        }

        await history.save()

        return res.json({
            sessions: history.sessions || [],
            activeSessionId: history.activeSessionId || '',
        })
    } catch (error) {
        next(error)
    }
}
