import Plan from '../models/Plan.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import AiChatHistory from '../models/AiChatHistory.js'
import { classifyQueryIntent, generateAssistantResponse } from '../services/aiAssistantService.js'
import { recordAuditLog } from '../services/auditLogService.js'
import AppError from '../utils/appError.js'

const MAX_CHAT_SESSIONS = 20
const CHAT_RETENTION_DAYS = 30

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
        .map((session) => ({
        sessionId: String(session.sessionId || `session-${Date.now()}`),
        title: String(session.title || 'New Chat').slice(0, 120),
        createdAt: String(session.createdAt || new Date().toISOString()),
        messages: Array.isArray(session.messages)
            ? session.messages.slice(-200).map((message) => ({
                id: String(message.id || `${Date.now()}-${Math.random()}`),
                userId: String(message.userId || ''),
                role: ['user', 'assistant', 'system'].includes(message.role) ? message.role : 'system',
                content: String(message.content || '').slice(0, 8000),
                createdAt: String(message.createdAt || new Date().toISOString()),
            })).filter((message) => message.content)
            : [],
        }))
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

const detectToolIntent = (query) => {
    const normalized = normalizeSearchText(query)
    const tokens = getSearchTokens(query)
    const tokenSet = new Set(tokens)
    const hasProductAction = tokens.some((token) => productActionWords.has(token)) || normalized.includes('san pham')
    const hasProductKeyword = tokens.some((token) => productWords.has(token)) || normalized.includes('may tap') || normalized.includes('giay gym')
    const isProduct = hasProductKeyword || (hasProductAction && !tokenSet.has('pt') && !normalized.includes('huan luyen vien'))
    const isPt = tokens.some((token) => ptWords.has(token)) || normalized.includes('huan luyen vien')
        || (tokens.includes('tim') && tokens.some((token) => ptGoalWords.has(token)))
    if (isPt && !hasProductKeyword) return 'pt'
    if (isProduct) return 'product'
    if (isPt) return 'pt'
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

const mapPlanResult = (plan) => ({
    _id: plan._id,
    name: plan.name,
    price: plan.price,
    durationDays: plan.durationDays,
    description: plan.description,
    color: plan.color,
})

export const aiAssistant = async (req, res, next) => {
    try {
        const { query, mode = 'gym' } = req.body

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return next(new AppError('Vui lòng nhập câu hỏi', 400))
        }

        const normalizedQuery = query.trim()
        const aiMode = mode === 'general' ? 'general' : 'gym'
        const toolIntent = detectToolIntent(normalizedQuery)

        if (toolIntent === 'product') {
            const categoryRequested = normalizeSearchText(normalizedQuery).includes('danh muc') || normalizeSearchText(normalizedQuery).includes('category')
            const strictGroup = detectStrictProductGroup(normalizedQuery)
            const searchTerms = getProductSearchTerms(normalizedQuery)
            const categoryTerms = getCategorySearchTerms(normalizedQuery)
            const requestedWeight = extractRequestedWeight(normalizedQuery)
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
                    details: `AI tool searchProducts strict group empty | keyword: ${searchTerms.join(', ') || normalizedQuery} | mode: ${aiMode}`,
                })

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
                details: `AI tool searchProducts keyword: ${searchTerms.join(', ') || normalizedQuery} | mode: ${aiMode}`,
            })

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
            const goal = extractPtGoal(normalizedQuery)
            const { availableFrom, availableTo } = extractDateRange(normalizedQuery)
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
            return res.json({
                answer: 'Tôi không thể cung cấp thông tin cá nhân của người dùng khác.',
                pts: [],
                products: [],
                plans: [],
                mode: aiMode,
            })
        }

        const classification = await classifyQueryIntent(normalizedQuery)
        const searchTerms = [classification.goal, ...(classification.keywords || []), normalizedQuery]
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

        const answer = await generateAssistantResponse(normalizedQuery, pts, products, plans, aiMode)

        await recordAuditLog({
            req,
            module: 'ai',
            action: 'create',
            entity: req.user,
            details: `AI Assistant được gọi với truy vấn: ${normalizedQuery} | mode: ${aiMode}`,
        })

        res.json({ answer, pts, products, plans, mode: aiMode })
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
            { new: true, upsert: true, runValidators: true },
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
