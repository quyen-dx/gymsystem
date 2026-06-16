import mongoose from 'mongoose'
import Booking from '../../models/Booking.js'
import Faq from '../../models/Faq.js'
import Feedback from '../../models/Feedback.js'
import Membership from '../../models/Membership.js'
import Order from '../../models/Order.js'
import Plan from '../../models/Plan.js'
import Policy from '../../models/Policy.js'
import Product from '../../models/Product.js'
import Transaction from '../../models/Transaction.js'
import User from '../../models/User.js'
import UserActivity from '../../models/UserActivity.js'
import { contextCache } from '../../services/conversationContextCache.js'
import { buildWebSearchContext, searchFitnessWeb } from '../../services/webSearchService.js'
import { runAIWithFallback } from './aiFallbackService.js'
import { buildPlanRecommendationPayload } from './dbResponder.js'
import { isProviderQuotaError } from './providerHelper.js'
import { generateSmartSuggestions } from './suggestionEngine.js'

const normalizeLanguage = (language) => language === 'en' ? 'en' : 'vi'
const getUserDisplayName = (user, fallback = '') =>
  String(user?.fullName || user?.displayName || user?.name || fallback || '').trim()

const detectAnswerLanguage = (userMessage = '', appLanguage = 'vi') => {
  const fallback = normalizeLanguage(appLanguage)
  const text = String(userMessage || '').trim()
  if (!text) return fallback

  const lower = text.toLowerCase()
  const hasVietnameseDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(lower)
  if (hasVietnameseDiacritics) return 'vi'

  const tokens = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length < 2) return fallback

  const englishWords = new Set([
    'which', 'what', 'how', 'why', 'when', 'where', 'who',
    'plan', 'plans', 'membership', 'price', 'cost', 'cheap', 'cheapest', 'affordable',
    'choose', 'should', 'need', 'do', 'does', 'can', 'compare', 'recommend',
    'personal', 'trainer', 'pt', 'workout', 'training', 'schedule', 'booking',
    'refund', 'policy', 'product', 'products', 'best', 'suitable',
  ])
  const vietnameseWords = new Set([
    'toi', 'minh', 'ban', 'nen', 'chon', 'goi', 'gia', 're', 'nhat',
    'so', 'sanh', 'tap', 'lich', 'dat', 'pt', 'can', 'khong', 'co',
    'bao', 'nhieu', 'thanh', 'toan', 'chinh', 'sach', 'hoan', 'tien',
    'san', 'pham', 'phu', 'hop', 'tu', 'van', 'dang', 'ky',
  ])

  const englishScore = tokens.reduce((score, token) => score + (englishWords.has(token) ? 1 : 0), 0)
  const vietnameseScore = tokens.reduce((score, token) => score + (vietnameseWords.has(token) ? 1 : 0), 0)

  if (englishScore >= 2 && englishScore > vietnameseScore) return 'en'
  if (vietnameseScore >= 2 && vietnameseScore >= englishScore) return 'vi'
  return fallback
}

const aiMessages = {
  vi: {
    missingKey: 'Backend chưa cấu hình API key cho member AI.',
    fallbackGymOnly: 'Ở Gym Mode, mình chỉ trả lời dựa trên dữ liệu GymPro. Bạn hãy hỏi về gói tập, PT, lịch tập hoặc sản phẩm gym nhé.',
    toolProcessed: 'Mình đã xử lý yêu cầu bằng dữ liệu thật từ GymPro.',
    bothFailed: 'AI hiện chưa khả dụng. Bạn vui lòng thử lại sau ít phút.',
    privacy: 'Mình không thể cung cấp thông tin tài khoản của người khác để bảo vệ quyền riêng tư nhé! 🔒',
    outOfScope: 'Mình không có thông tin về điều này. Bạn cần hỗ trợ thêm thì liên hệ staff tại quầy nhé! 😊',
  },
  en: {
    missingKey: 'The member AI API key is not configured on the backend.',
    fallbackGymOnly: 'In Gym Mode, I can only answer using GymPro member data. Please ask about your membership plan, trainer, workout schedule, check-ins, health metrics, or gym products.',
    toolProcessed: 'I processed your request using real GymPro data.',
    bothFailed: 'AI is currently unavailable. Please try again in a few minutes.',
    privacy: "I can't provide another user's account information to protect their privacy. 🔒",
    outOfScope: 'I do not have information about that. Please contact the front desk if you need more help. 😊',
  },
}

const tAI = (key, language = 'vi') => {
  const lang = normalizeLanguage(language)
  return aiMessages[lang]?.[key] || aiMessages.vi[key] || key
}

const stripJsonFence = (text) => String(text || '')
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim()

const extractJsonObjectString = (text = '') => {
  const source = String(text || '')
  for (let start = source.indexOf('{'); start !== -1; start = source.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < source.length; index += 1) {
      const char = source[index]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (char === '\\') {
          escaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }
      if (char === '"') {
        inString = true
      } else if (char === '{') {
        depth += 1
      } else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          const candidate = source.slice(start, index + 1)
          try {
            JSON.parse(candidate)
            return candidate
          } catch {
            break
          }
        }
      }
    }
  }
  return ''
}

const cleanAiOutput = (raw, { expectedJson = false, fallbackAnswer = '' } = {}) => {
  const fallback = fallbackAnswer || 'Mình chưa xử lý được câu trả lời này, bạn hỏi lại ngắn hơn giúp mình nhé.'
  const withoutThinking = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/^```[a-z0-9_-]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const withoutFence = stripJsonFence(withoutThinking)
  if (expectedJson) {
    const json = extractJsonObjectString(withoutFence)
    return json || ''
  }
  return withoutFence || fallback
}

const normalizeFinalAnswerText = (value = '') => String(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  .replace(/^```[a-z0-9_-]*\s*/i, '')
  .replace(/\s*```$/i, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/GymPro(?=[A-Za-zÀ-ỹ0-9])/g, 'GymPro ')
  .replace(/Gói(?=VIP|Cơ|Co|Nâng|Nang)/g, 'Gói ')
  .replace(/chưa(?=có|ghi|xử)/g, 'chưa ')
  .replace(/dữ(?=liệu)/g, 'dữ ')
  .replace(/cá(?=nhân)/g, 'cá ')
  .trim()

const getParseFailureAnswer = (language = 'vi') => normalizeLanguage(language) === 'en'
  ? 'Sorry, I could not process this answer. Please try asking again more briefly.'
  : 'Mình chưa xử lý được câu trả lời này, bạn hỏi lại ngắn hơn giúp mình nhé.'

const parseAiJsonPayload = (text, fallbackAnswer = '') => {
  const raw = String(text || '')
  console.log('[RAW AI LENGTH]', raw.length)
  const cleaned = cleanAiOutput(raw, { expectedJson: true, fallbackAnswer })
  console.log('[CLEANED AI]', cleaned.slice(0, 100))
  if (!raw) return { answer: fallbackAnswer, suggestions: [] }

  const candidates = [cleaned, stripJsonFence(cleaned)].filter(Boolean)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
      return {
        ...parsed,
        answer: typeof parsed.answer === 'string' && parsed.answer.trim() ? cleanAiOutput(parsed.answer).trim() : fallbackAnswer,
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
            .filter((item) => typeof item === 'string' && item.trim())
            .map((item) => item.trim())
            .slice(0, 4)
          : [],
      }
    } catch {}
  }

  return { answer: fallbackAnswer || 'Mình chưa xử lý được câu trả lời này, bạn hỏi lại ngắn hơn giúp mình nhé.', suggestions: [] }
}

const normalizeForIntent = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()

const removeRepeatedSuggestions = (suggestions, query) => {
  const normalizedQuery = normalizeForIntent(query).trim()
  const seen = new Set()
  return (Array.isArray(suggestions) ? suggestions : [])
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
    .filter((item) => {
      const normalized = normalizeForIntent(item).trim()
      if (!normalized || normalized === normalizedQuery || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
    .slice(0, 4)
}

const normalizeAiJsonAnswer = ({ text, query, language, fallbackAnswer = '' }) => {
  const parsed = parseAiJsonPayload(text, fallbackAnswer)
  const suggestions = removeRepeatedSuggestions(parsed.suggestions, query)
  return {
    ...parsed,
    answer: parsed.answer || fallbackAnswer,
    suggestions,
  }
}

const MEMBER_INTENTS = new Set([
  'workout',
  'schedule',
  'membership',
  'membership_compare',
  'membership_recommend',
  'checkin',
  'health',
  'nutrition',
  'progress',
  'dashboard',
  'notifications',
  'member_profile',
  'greeting',
  'web_fitness_knowledge',
  'unknown',
])

const DB_ONLY_INTENTS = new Set([
  'membership',
  'membership_compare',
  'schedule',
  'checkin',
  'health',
  'progress',
  'member_profile',
])

const AI_REASONING_INTENTS = new Set([
  'membership_recommend',
  'membership_compare',
  'workout',
  'nutrition',
  'health',
  'progress',
  'checkin',
  'schedule',
  'dashboard',
  'notifications',
  'web_fitness_knowledge',
])

const ADVISORY_QUERY_REGEX = /\b(nen|nên|co nen|có nên|chon|chọn|phu hop|phù hợp|dang tien|đáng tiền|tot khong|tốt không|lam gi|làm gì|nen lam|nên làm|tu van|tư vấn|giup toi|giúp tôi|recommend|should|which|best|worth|suitable|advice)\b/
const MOTIVATION_QUERY_REGEX = /\b(bo tap|bỏ tập|chua di tap|chưa đi tập|it tap|ít tập|luoi|lười|mat dong luc|mất động lực|nan|nản|streak giam|streak giảm|missed|demotivated|motivation|not training)\b/
const HEALTH_GOAL_QUERY_REGEX = /\b(tang co|tăng cơ|giam mo|giảm mỡ|giam can|giảm cân|tang can|tăng cân|dinh duong|dinh dưỡng|workout|bai tap|bài tập|meal|nutrition|fat loss|muscle|bulk|cut)\b/

const shouldUsePersonalReasoning = (intent, query = '') => {
  const normalized = normalizeForIntent(query)
  if (['membership_recommend', 'workout', 'nutrition', 'web_fitness_knowledge', 'dashboard', 'notifications'].includes(intent)) return true
  if (ADVISORY_QUERY_REGEX.test(normalized) || MOTIVATION_QUERY_REGEX.test(normalized) || HEALTH_GOAL_QUERY_REGEX.test(normalized)) return true
  if (intent === 'progress' && /\b(tien do|tiến độ|the nao|thế nào|danh gia|đánh giá|goal|muc tieu|mục tiêu)\b/.test(normalized)) return true
  if (intent === 'checkin' && /\b(deu khong|đều không|co deu|có đều|du khong|đủ không|can tap|cần tập|muc tieu|mục tiêu)\b/.test(normalized)) return true
  if (intent === 'health' && /\b(nen cai thien|nên cải thiện|chi so nao|chỉ số nào|score|bmi|fat|mo|mỡ)\b/.test(normalized)) return true
  return false
}

export const detectMemberIntent = (query = '', conversationContext = null) => {
  // Legacy keyword router is intentionally disabled. The active flow uses
  // context builder + AI classifier; keyword heuristics remain only in local
  // classifier fallback below when every AI provider fails.
  return 'unknown'
}

const asksGeneralExerciseKnowledge = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(bai tap nao|exercise|form|ky thuat|technique|dau lung|back pain|cardio hay tap ta|tap ta hay cardio|tot hon|better|hieu qua|effective|co nen|should i)\b/.test(normalized)
}

const lacksPersonalNutritionData = (memberContext) => {
  const missing = new Set(memberContext?.missingData || [])
  return missing.has('healthMetrics') || missing.has('goalsOrProgress')
}

const shouldUseMemberWebSearch = ({ intent, query, memberContext }) => (
  intent === 'web_fitness_knowledge'
  || (intent === 'nutrition' && lacksPersonalNutritionData(memberContext))
  || (intent === 'workout' && asksGeneralExerciseKnowledge(query))
)

const TRUSTED_FITNESS_SOURCE_DOMAINS = [
  'who.int',
  'nih.gov',
  'ncbi.nlm.nih.gov',
  'mayoclinic.org',
  'healthline.com',
  'clevelandclinic.org',
  'acefitness.org',
  'acsm.org',
  'eatright.org',
]

const getHostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

const getSourceTrustRank = (url) => {
  const hostname = getHostname(url)
  const index = TRUSTED_FITNESS_SOURCE_DOMAINS.findIndex((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  return index === -1 ? 999 : index
}

const normalizeWebSources = (results = []) => (Array.isArray(results) ? results : [])
  .filter((item) => item?.title && /^https:\/\//i.test(item.url || ''))
  .sort((a, b) => getSourceTrustRank(a.url) - getSourceTrustRank(b.url))
  .map((item) => ({
    title: String(item.title || '').slice(0, 180),
    url: String(item.url || ''),
  }))
  .slice(0, 5)

const createWebSearchState = (needed = false, reason = 'not_needed') => ({
  needed,
  used: false,
  reason,
  results: [],
  context: '',
})

const resolveMemberWebSearch = async ({ query, intent, memberContext }) => {
  const needed = shouldUseMemberWebSearch({ intent, query, memberContext })
  if (!needed) return createWebSearchState(false, 'not_needed_for_personal_data')

  try {
    const result = await searchFitnessWeb(query, { maxResults: 5 })
    const selectedResults = (Array.isArray(result.results) ? result.results : [])
      .filter((item) => item?.title && /^https:\/\//i.test(item.url || ''))
      .sort((a, b) => getSourceTrustRank(a.url) - getSourceTrustRank(b.url))
      .slice(0, 5)
    return {
      needed: true,
      used: Boolean(result.used && selectedResults.length),
      reason: result.reason || 'searched',
      results: normalizeWebSources(selectedResults),
      context: buildWebSearchContext(selectedResults),
    }
  } catch (error) {
    console.error('Member AI web search error:', error)
    return createWebSearchState(true, 'search_failed')
  }
}

const toObjectIdOrNull = (value) => mongoose.Types.ObjectId.isValid(value)
  ? new mongoose.Types.ObjectId(value)
  : null

const ttlCache = new Map()
const getCached = async (key, ttlSeconds, loader) => {
  const now = Date.now()
  const cached = ttlCache.get(key)
  if (cached && cached.expiresAt > now) return cached.value
  const value = await loader()
  ttlCache.set(key, { value, expiresAt: now + ttlSeconds * 1000 })
  return value
}

const getConversationId = (conversationContext, user) => {
  const explicitId = conversationContext?.conversationId
    || conversationContext?.sessionId
    || conversationContext?.chatSessionId
  return String(explicitId || `user:${user?._id || 'anonymous'}`)
}

const createCacheContext = ({ user, conversationContext }) => ({
  conversationId: getConversationId(conversationContext, user),
  userId: String(user?._id || 'anonymous'),
})

const getContextCached = (cacheContext, key, ttlSeconds, loader, variant = '') => contextCache.getOrLoad({
  conversationId: cacheContext?.conversationId,
  userId: cacheContext?.userId,
  key,
  ttlSeconds,
  loader,
  variant,
})

const calculateRemainingDays = (endDate) => {
  const end = new Date(endDate)
  if (Number.isNaN(end.getTime())) return 0
  end.setHours(23, 59, 59, 999)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}

const serializeMembership = (membership) => {
  if (!membership) return { found: false }
  const remainingDays = calculateRemainingDays(membership.endDate)
  const plan = membership.planId || {}
  return {
    found: true,
    planName: plan.nameVi || plan.nameEn || 'Membership plan',
    planNameVi: plan.nameVi || '',
    planNameEn: plan.nameEn || '',
    planDurationDays: plan.durationDays || null,
    planPrice: plan.price || null,
    planDescriptionVi: plan.descriptionVi || '',
    planDescriptionEn: plan.descriptionEn || '',
    planFeaturesVi: plan.featuresVi || [],
    planFeaturesEn: plan.featuresEn || [],
    startDate: membership.startDate,
    endDate: membership.endDate,
    remainingDays,
    status: remainingDays <= 0 && membership.status === 'active' ? 'expired' : membership.status,
  }
}

const getLatestMembership = async (memberId) => Membership.findOne({ memberId })
  .sort({ endDate: -1 })
  .populate('planId', 'nameVi nameEn durationDays price descriptionVi descriptionEn featuresVi featuresEn color')
  .lean()

const getActivePlans = async (limit = 12) => {
  const plans = await Plan.find({ isActive: true })
    .select('nameVi nameEn price durationDays descriptionVi descriptionEn featuresVi featuresEn color')
    .sort({ price: 1 })
    .limit(limit)
    .lean()
  return plans.map((plan) => ({
    _id: plan._id,
    nameVi: plan.nameVi,
    nameEn: plan.nameEn,
    price: plan.price,
    durationDays: plan.durationDays,
    descriptionVi: plan.descriptionVi,
    descriptionEn: plan.descriptionEn,
    featuresVi: plan.featuresVi,
    featuresEn: plan.featuresEn,
    color: plan.color,
  }))
}

const summarizeCheckinFrequency = (checkins = []) => {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const inLastDays = (days) => checkins.filter((item) => {
    const time = new Date(item.createdAt || item.date).getTime()
    return Number.isFinite(time) && now - time <= days * dayMs
  }).length
  return {
    totalFetched: checkins.length,
    last7Days: inLastDays(7),
    last30Days: inLastDays(30),
    thisMonth: checkins.filter((item) => {
      const time = new Date(item.createdAt || item.date).getTime()
      return Number.isFinite(time) && time >= monthStart.getTime()
    }).length,
  }
}

const getUpcomingBookings = async (memberId, limit = 8) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const bookings = await Booking.find({
    memberId,
    date: { $gte: today },
    status: { $ne: 'cancelled' },
  })
    .sort({ date: 1, slot: 1 })
    .limit(limit)
    .populate('ptId', 'name specialties rating')
    .lean()

  return bookings.map((booking) => ({
    id: String(booking._id),
    date: booking.date,
    slot: booking.slot,
    status: booking.status,
    note: booking.note || '',
    ptName: booking.ptId?.name || '',
    ptSpecialties: booking.ptId?.specialties || [],
  }))
}

const getRecentBookings = async (memberId, limit = 12) => {
  const bookings = await Booking.find({ memberId })
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate('ptId', 'name specialties rating')
    .lean()

  return bookings.map((booking) => ({
    id: String(booking._id),
    date: booking.date,
    slot: booking.slot,
    status: booking.status,
    ptName: booking.ptId?.name || '',
  }))
}

const serializeUserBrief = (user) => ({
  id: String(user?._id || ''),
  name: getUserDisplayName(user),
  email: user?.email || '',
  phone: user?.phone || '',
  role: user?.role || '',
  specialties: user?.specialties || [],
  rating: user?.rating || 0,
  experienceYears: user?.experienceYears || 0,
  bio: user?.bio || '',
  avatar: user?.avatar || '',
})

const getMembershipHistory = async (memberId, limit = 6) => {
  const memberships = await Membership.find({ memberId })
    .sort({ endDate: -1, createdAt: -1 })
    .limit(limit)
    .populate('planId', 'nameVi nameEn durationDays price')
    .lean()
  return memberships.map((membership) => ({
    id: String(membership._id),
    planName: membership.planId?.nameVi || membership.planId?.nameEn || '',
    price: membership.planId?.price || null,
    durationDays: membership.planId?.durationDays || null,
    startDate: membership.startDate,
    endDate: membership.endDate,
    status: membership.status,
  }))
}

const getCheckinContext = async (memberId) => {
  const latestCheckins = await getActivitiesByKeywords(memberId, ['checkin', 'check-in', 'điểm danh', 'diem danh', 'qr'], 30)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayCheckinStatus = latestCheckins.some((item) => new Date(item.createdAt).getTime() >= today.getTime())
  return {
    checkinStats: summarizeCheckinFrequency(latestCheckins),
    latestCheckins: latestCheckins.slice(0, 10),
    streak: estimateCheckinStreak(latestCheckins),
    todayCheckinStatus,
  }
}

const estimateCheckinStreak = (checkins = []) => {
  const days = new Set(checkins.map((item) => {
    const date = new Date(item.createdAt || item.date)
    if (Number.isNaN(date.getTime())) return ''
    date.setHours(0, 0, 0, 0)
    return date.toISOString().slice(0, 10)
  }).filter(Boolean))
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

const getPTList = async (limit = 8) => {
  const pts = await User.find({ role: 'pt', isActive: true, status: { $ne: 'locked' } })
    .select('name email phone avatar specialties rating experienceYears bio')
    .sort({ rating: -1, experienceYears: -1 })
    .limit(limit)
    .lean()
  return pts.map(serializeUserBrief)
}

const getPTAvailability = async (query, limit = 8, cacheContext = null) => {
  const range = normalizeTimeRange(query)
  const pts = cacheContext
    ? await getContextCached(cacheContext, 'ptList', 5 * 60, () => getPTList(limit), String(limit))
    : await getCached(`ptList:${limit}`, 120, () => getPTList(limit))
  if (!range.start || !range.end) return { timeRange: range.label, availablePTs: pts, busyBookings: [] }
  const bookings = await Booking.find({
    ptId: { $in: pts.map((pt) => pt.id).filter(Boolean) },
    date: { $gte: range.start, $lte: range.end },
    status: { $ne: 'cancelled' },
  }).populate('ptId', 'name').lean()
  const busyPtIds = new Set(bookings.map((booking) => String(booking.ptId?._id || booking.ptId)))
  const availablePTs = pts.filter((pt) => !busyPtIds.has(String(pt.id)))
  return {
    timeRange: range.label,
    rangeStart: range.start,
    rangeEnd: range.end,
    availablePTs,
    availableSlots: availablePTs.map((pt) => ({
      ptId: pt.id,
      ptName: pt.name,
      slot: range.label,
      rangeStart: range.start,
      rangeEnd: range.end,
    })),
    busyBookings: bookings.slice(0, 12).map((booking) => ({
      ptName: booking.ptId?.name || '',
      date: booking.date,
      slot: booking.slot,
      status: booking.status,
    })),
  }
}

const getBookingContext = async (user, query, cacheContext = null) => {
  const userId = toObjectIdOrNull(user?._id)
  if (!userId) return { upcomingBookings: [], bookingHistory: [] }
  const role = getRole(user)
  const filter = role === 'pt' ? { ptId: userId } : role === 'admin' ? {} : { memberId: userId }
  const upcomingBookings = await Booking.find({
    ...filter,
    date: { $gte: new Date() },
    status: { $ne: 'cancelled' },
  }).sort({ date: 1, slot: 1 }).limit(8).populate('ptId memberId', 'name').lean()
  const bookingHistory = await Booking.find(filter).sort({ date: -1, createdAt: -1 }).limit(10).populate('ptId memberId', 'name').lean()
  return {
    upcomingBookings: upcomingBookings.map(serializeBookingBrief),
    bookingHistory: bookingHistory.map(serializeBookingBrief),
    ...(hasBookingActionIntent(query) ? { availableSlots: await getPTAvailability(query, 8, cacheContext) } : {}),
  }
}

const serializeBookingBrief = (booking) => ({
  id: String(booking._id),
  date: booking.date,
  slot: booking.slot,
  status: booking.status,
  note: booking.note || '',
  ptName: booking.ptId?.name || '',
  memberName: booking.memberId?.name || '',
})

const getWorkoutContext = async (memberId) => {
  const workoutProgress = await getActivitiesByKeywords(memberId, ['workout', 'bài tập', 'tap luyen', 'training', 'session', 'completed'], 12)
  const goalActivities = await getActivitiesByKeywords(memberId, ['goal', 'mục tiêu', 'muc tieu', 'progress', 'tiến độ', 'tien do'], 6)
  return {
    currentWorkoutPlan: workoutProgress[0] || null,
    workoutProgress,
    completedSessions: workoutProgress.filter((item) => /completed|hoan thanh|hoàn thành/i.test(`${item.type} ${item.title} ${item.description}`)).length,
    trainingGoal: goalActivities[0] || null,
  }
}

const getHealthContext = async (memberId) => {
  const healthLogs = await getActivitiesByKeywords(memberId, ['health', 'sức khỏe', 'suc khoe', 'bmi', 'weight', 'cân nặng', 'can nang', 'body fat', 'mo co the'], 12)
  const latest = healthLogs[0] || null
  return {
    latestHealthLog: latest,
    weightHistory: healthLogs.filter((item) => /weight|can nang|cân nặng/i.test(`${item.type} ${item.title} ${item.description}`)).slice(0, 8),
    bmi: latest?.metadata?.bmi ?? null,
    bodyFat: latest?.metadata?.bodyFat ?? latest?.metadata?.body_fat ?? null,
    progressSummary: healthLogs.slice(0, 6),
  }
}

const getProducts = async (limit = 8) => {
  const products = await Product.find({ isActive: true })
    .select('name price category description image images stock rating reviewCount weightVariants weights')
    .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
    .limit(limit)
    .lean()
  return products.map((product) => ({
    id: String(product._id),
    name: product.name,
    price: product.price,
    category: product.category,
    description: product.description,
    image: product.image || product.images?.[0] || '',
    stock: product.stock,
    rating: product.rating || 0,
    reviewCount: product.reviewCount || 0,
    variants: product.weightVariants || product.weights || [],
  }))
}

const getOrderHistory = async (user, limit = 8) => {
  const userId = toObjectIdOrNull(user?._id)
  if (!userId) return []
  const filter = getRole(user) === 'admin' ? {} : { userId, hiddenForUser: { $ne: true } }
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
  return orders.map((order) => ({
    id: String(order._id),
    totalAmount: order.totalAmount || order.totalPrice || 0,
    status: order.status,
    paymentStatus: order.paymentStatus,
    items: (order.items || []).map((item) => ({
      name: item.productName || item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
    })).slice(0, 5),
    createdAt: order.createdAt,
  }))
}

const getFaqs = async (limit = 8) => {
  const faqs = await Faq.find({ isPublished: true }).sort({ order: 1, createdAt: -1 }).limit(limit).lean()
  return faqs.map((faq) => ({
    id: String(faq._id),
    questionVi: faq.questionVi,
    questionEn: faq.questionEn,
    answerVi: faq.answerVi,
    answerEn: faq.answerEn,
    categoryVi: faq.categoryVi,
    categoryEn: faq.categoryEn,
  }))
}

const getPolicies = async (limit = 8) => {
  const policies = await Policy.find({ isPublished: true }).sort({ createdAt: -1 }).limit(limit).lean()
  return policies.map((policy) => ({
    id: String(policy._id),
    titleVi: policy.titleVi,
    titleEn: policy.titleEn,
    categoryVi: policy.categoryVi,
    categoryEn: policy.categoryEn,
    contentVi: String(policy.contentVi || '').slice(0, 1200),
    contentEn: String(policy.contentEn || '').slice(0, 1200),
  }))
}

const getFeedbackHistory = async (user, limit = 6) => {
  const userId = toObjectIdOrNull(user?._id)
  if (!userId) return []
  const filter = getRole(user) === 'admin' ? {} : { user: userId }
  const feedback = await Feedback.find(filter).sort({ createdAt: -1 }).limit(limit).populate('user', 'name fullName displayName').lean()
  return feedback.map((item) => ({
    id: String(item._id),
    title: item.title,
    type: item.type,
    priority: item.priority,
    status: item.status,
    adminReply: item.adminReply || '',
    userName: getUserDisplayName(item.user),
    createdAt: item.createdAt,
  }))
}

const getNotifications = async (memberId) => getActivitiesByKeywords(memberId, ['notification', 'thông báo', 'thong bao', 'reminder', 'alert', 'nhắc lịch', 'nhac lich'], 8)

const getDashboardStats = async () => {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const next30 = new Date(now)
  next30.setDate(next30.getDate() + 30)
  const [totalMembers, activeMembers, expiringMembers, activePlans, revenueAgg, orders] = await Promise.all([
    User.countDocuments({ role: 'member' }),
    User.countDocuments({ role: 'member', isActive: true, status: { $ne: 'locked' } }),
    Membership.find({ endDate: { $gte: now, $lte: next30 }, status: 'active' }).limit(10).populate('memberId planId', 'name nameVi nameEn').lean(),
    Plan.countDocuments({ isActive: true }),
    Transaction.aggregate([
      { $match: { status: 'completed', type: { $in: ['payment', 'deposit'] }, createdAt: { $gte: monthStart } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Order.find({ createdAt: { $gte: monthStart } }).select('totalAmount totalPrice status paymentStatus createdAt').limit(20).lean(),
  ])
  return {
    dashboardStats: { totalMembers, activeMembers, activePlans, monthOrders: orders.length },
    expiringMembers: expiringMembers.map((item) => ({
      memberName: item.memberId?.name || '',
      planName: item.planId?.nameVi || item.planId?.nameEn || '',
      endDate: item.endDate,
      daysLeft: calculateRemainingDays(item.endDate),
    })),
    revenueSummary: {
      monthStart,
      transactions: revenueAgg,
      orderRevenue: orders.reduce((sum, order) => sum + Number(order.totalAmount || order.totalPrice || 0), 0),
    },
    churnRisk: expiringMembers.slice(0, 5).map((item) => ({
      memberName: item.memberId?.name || '',
      reason: 'Membership expires within 30 days',
      daysLeft: calculateRemainingDays(item.endDate),
    })),
  }
}

const getActivitiesByKeywords = async (memberId, keywords, limit = 12) => {
  const regex = new RegExp(keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
  const activities = await UserActivity.find({
    user: memberId,
    $or: [
      { type: regex },
      { title: regex },
      { description: regex },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return activities.map((activity) => ({
    id: String(activity._id),
    type: activity.type,
    title: activity.title,
    description: activity.description || '',
    metadata: activity.metadata || {},
    createdAt: activity.createdAt,
  }))
}

const getMemberAssistantSnapshot = async (memberId) => {
  const [
    membershipDoc,
    checkins,
    upcomingBookings,
    recentBookings,
    healthMetrics,
    progressActivities,
    workoutActivities,
    notificationActivities,
  ] = await Promise.all([
    getLatestMembership(memberId),
    getActivitiesByKeywords(memberId, ['checkin', 'check-in', 'điểm danh', 'diem danh', 'qr'], 30),
    getUpcomingBookings(memberId, 5),
    getRecentBookings(memberId, 8),
    getActivitiesByKeywords(memberId, ['health', 'sức khỏe', 'suc khoe', 'bmi', 'weight', 'cân nặng', 'can nang', 'metric', 'score'], 8),
    getActivitiesByKeywords(memberId, ['progress', 'tiến độ', 'tien do', 'goal', 'mục tiêu', 'muc tieu', 'completed'], 10),
    getActivitiesByKeywords(memberId, ['workout', 'bài tập', 'tap luyen', 'training', 'session', 'completed'], 10),
    getActivitiesByKeywords(memberId, ['notification', 'thông báo', 'thong bao', 'reminder', 'alert', 'nhắc lịch', 'nhac lich'], 8),
  ])

  return {
    membership: serializeMembership(membershipDoc),
    checkins,
    checkinFrequency: summarizeCheckinFrequency(checkins),
    upcomingBookings,
    recentBookings,
    healthMetrics,
    progressActivities,
    workoutActivities,
    notificationActivities,
  }
}

const mergeAvailableData = (base, data) => {
  base.availableData = {
    ...(data || {}),
    ...(base.availableData || {}),
  }
  return base
}

const fetchMemberContextByIntent = async ({ intent, user, reasoningMode = false }) => {
  const memberId = toObjectIdOrNull(user?._id)
  if (!memberId) return { intent, availableData: {}, missingData: ['memberId'] }

  const safeIntent = MEMBER_INTENTS.has(intent) ? intent : 'unknown'
  const base = {
    intent: safeIntent,
    member: {
      id: String(user?._id || ''),
      name: getUserDisplayName(user),
      role: user?.role || 'member',
    },
    availableData: {},
    missingData: [],
  }

  if (safeIntent === 'greeting') return base

  if (safeIntent === 'member_profile') {
    const membership = serializeMembership(await getLatestMembership(memberId))
    base.availableData.profile = {
      id: String(user?._id || ''),
      name: getUserDisplayName(user),
      email: user?.email || '',
      phone: user?.phone || '',
      role: user?.role || 'member',
    }
    base.availableData.membership = membership
    if (!membership.found) base.missingData.push('membership')
    return base
  }

  if (safeIntent === 'web_fitness_knowledge') {
    const snapshot = await getMemberAssistantSnapshot(memberId)
    mergeAvailableData(base, snapshot)
    if (snapshot.healthMetrics.length === 0) base.missingData.push('healthMetrics')
    if (snapshot.progressActivities.length === 0) base.missingData.push('goalsOrProgress')
    return base
  }

  if (safeIntent === 'membership' || safeIntent === 'membership_compare' || safeIntent === 'membership_recommend') {
    const [
      membershipDoc,
      plans,
      checkins,
      recentBookings,
      healthMetrics,
      progressActivities,
    ] = await Promise.all([
      getLatestMembership(memberId),
      getActivePlans(12),
      reasoningMode ? getActivitiesByKeywords(memberId, ['checkin', 'check-in', 'điểm danh', 'diem danh'], 30) : Promise.resolve([]),
      reasoningMode ? getRecentBookings(memberId, 8) : Promise.resolve([]),
      reasoningMode ? getActivitiesByKeywords(memberId, ['health', 'sức khỏe', 'suc khoe', 'bmi', 'weight', 'cân nặng', 'can nang', 'metric'], 6) : Promise.resolve([]),
      reasoningMode ? getActivitiesByKeywords(memberId, ['goal', 'mục tiêu', 'muc tieu', 'progress', 'tiến độ', 'tien do', 'completed'], 8) : Promise.resolve([]),
    ])
    const membership = serializeMembership(membershipDoc)
    base.availableData.membership = membership
    base.availableData.availablePlans = plans
    if (reasoningMode) {
      base.availableData.checkins = checkins
      base.availableData.checkinFrequency = summarizeCheckinFrequency(checkins)
      base.availableData.recentBookings = recentBookings
      base.availableData.healthMetrics = healthMetrics
      base.availableData.progressActivities = progressActivities
    }
    if (!membership.found) base.missingData.push('membership')
    return base
  }

  if (safeIntent === 'schedule') {
    if (!reasoningMode) {
      const upcomingBookings = await getUpcomingBookings(memberId)
      base.availableData.upcomingBookings = upcomingBookings
      if (upcomingBookings.length === 0) base.missingData.push('upcomingBookings')
      return base
    }
    const snapshot = await getMemberAssistantSnapshot(memberId)
    mergeAvailableData(base, snapshot)
    if (snapshot.upcomingBookings.length === 0) base.missingData.push('upcomingBookings')
    return base
  }

  if (safeIntent === 'workout') {
    const [snapshot, plans] = await Promise.all([
      getMemberAssistantSnapshot(memberId),
      getActivePlans(12),
    ])
    mergeAvailableData(base, { ...snapshot, availablePlans: plans })
    if (snapshot.upcomingBookings.length === 0) base.missingData.push('upcomingBookings')
    if (snapshot.workoutActivities.length === 0) base.missingData.push('workoutActivities')
    return base
  }

  if (safeIntent === 'checkin') {
    if (!reasoningMode) {
      const checkins = await getActivitiesByKeywords(memberId, ['checkin', 'check-in', 'điểm danh', 'diem danh', 'qr'], 20)
      base.availableData.checkins = checkins
      base.availableData.checkinFrequency = summarizeCheckinFrequency(checkins)
      if (checkins.length === 0) base.missingData.push('checkins')
      return base
    }
    const snapshot = await getMemberAssistantSnapshot(memberId)
    mergeAvailableData(base, snapshot)
    if (snapshot.checkins.length === 0) base.missingData.push('checkins')
    return base
  }

  if (safeIntent === 'health') {
    if (!reasoningMode) {
      const healthMetrics = await getActivitiesByKeywords(memberId, ['health', 'sức khỏe', 'suc khoe', 'bmi', 'weight', 'cân nặng', 'can nang', 'metric'], 12)
      base.availableData.healthMetrics = healthMetrics
      if (healthMetrics.length === 0) base.missingData.push('healthMetrics')
      return base
    }
    const snapshot = await getMemberAssistantSnapshot(memberId)
    mergeAvailableData(base, snapshot)
    if (snapshot.healthMetrics.length === 0) base.missingData.push('healthMetrics')
    return base
  }

  if (safeIntent === 'nutrition') {
    const [snapshot, plans] = await Promise.all([
      getMemberAssistantSnapshot(memberId),
      getActivePlans(12),
    ])
    mergeAvailableData(base, { ...snapshot, availablePlans: plans })
    if (snapshot.healthMetrics.length === 0) base.missingData.push('healthMetrics')
    if (snapshot.progressActivities.length === 0) base.missingData.push('goalsOrProgress')
    return base
  }

  if (safeIntent === 'progress') {
    const snapshot = await getMemberAssistantSnapshot(memberId)
    mergeAvailableData(base, snapshot)
    if (snapshot.recentBookings.length === 0 && snapshot.checkins.length === 0 && snapshot.healthMetrics.length === 0 && snapshot.progressActivities.length === 0) base.missingData.push('progressData')
    return base
  }

  if (safeIntent === 'dashboard' || safeIntent === 'notifications') {
    const [snapshot, plans] = await Promise.all([
      getMemberAssistantSnapshot(memberId),
      getActivePlans(8),
    ])
    mergeAvailableData(base, { ...snapshot, availablePlans: plans })
    if (safeIntent === 'notifications' && snapshot.notificationActivities.length === 0) base.missingData.push('notifications')
    return base
  }

  base.missingData.push('matchedIntent')
  return base
}

const buildGymProPrompt = ({ user, query, conversationContext, memberContext, language = 'vi' }) => {
  const lang = normalizeLanguage(language)
  const context = buildReasoningContext({
    language: lang,
    userQuestion: query,
    memberContext,
    conversationContext,
  })
  const languageRule = lang === 'en'
    ? 'Always answer in the user message language; if unclear, use the app language. For this request, answer entirely in English. Use localized English context only. Do not manually translate database data.'
    : 'Luôn trả lời theo ngôn ngữ trong tin nhắn user; nếu không rõ, dùng ngôn ngữ app. Với request này, trả lời hoàn toàn bằng tiếng Việt. Chỉ dùng context tiếng Việt đã localize. Không tự dịch dữ liệu database.'

  return `
Bạn là GymPro AI Assistant.
${languageRule}

MỤC TIÊU
Không phải chatbot trả lời câu hỏi thông thường. Bạn là chuyên gia tư vấn gym, hội viên, gói tập, dinh dưỡng, luyện tập và trải nghiệm khách hàng của GymPro. Nhiệm vụ là hiểu ý định thật sự của người dùng và đưa ra câu trả lời hữu ích nhất.

==================================================
NGUYÊN TẮC SUY LUẬN
==================================================
Trước khi trả lời luôn suy nghĩ:
1. Người dùng THỰC SỰ muốn gì?
2. Dữ liệu nào liên quan nhất?
3. Có đủ dữ liệu để tư vấn chưa?
4. Có thể đưa ra đề xuất ngay không?
5. Câu trả lời nào ngắn gọn nhưng hữu ích nhất?

Không trả lời theo từ khóa. Không được thấy một từ rồi suy luận ngay. Luôn xem toàn bộ ngữ cảnh cuộc hội thoại.

==================================================
HIỂU TIỀN TỆ VIỆT NAM
==================================================
Luôn chuẩn hóa tiền trước khi suy luận:
- 1k = 1.000đ | 10k = 10.000đ | 50k = 50.000đ | 100k = 100.000đ | 500k = 500.000đ
- 1 triệu = 1tr = 1.000.000đ | 2 triệu = 2tr = 2.000.000đ | 5 triệu = 5tr = 5.000.000đ
- 100 nghìn = 100k | 200 nghìn = 200k
- 1 củ = 1.000.000đ | 2 củ = 2.000.000đ | 3 củ = 3.000.000đ
Nếu nhiều cách viết cùng giá trị (ví dụ: 200k, 200 nghìn, 0.2 triệu) => hiểu là cùng một số tiền.

==================================================
TƯ DUY TƯ VẤN & KHI NÀO ĐƯỢC HỎI THÊM
==================================================
- Không liệt kê tất cả gói tập. Không biến câu trả lời thành catalog. Mục tiêu là chọn gói phù hợp nhất:
  * "Tôi mới tập gym" => ưu tiên gói cơ bản/dành cho người mới.
  * "Tôi muốn tiết kiệm" => ưu tiên gói giá rẻ.
  * "Tôi muốn tập lâu dài" => ưu tiên gói có chi phí/ngày thấp.
  * "Tôi muốn giảm cân" => ưu tiên gói hỗ trợ mục tiêu giảm cân.
  * "Tôi muốn tăng cơ" => ưu tiên gói phù hợp tăng cơ.
- Chỉ hỏi thêm nếu thực sự thiếu dữ liệu (ví dụ: chỉ nói "Tôi muốn giảm cân" => có thể hỏi thêm).
- Nếu đã ĐỦ DỮ LIỆU (ví dụ: "Tôi có 500k", "Tôi muốn tăng cơ", "Tôi tập 5 buổi/tuần") => PHẢI tư vấn luôn, không được hỏi tiếp vô ích.

==================================================
SỬ DỤNG DỮ LIỆU HỆ THỐNG
==================================================
Mọi dữ liệu từ database (CONTEXT) là nguồn sự thật duy nhất (plans, memberships, schedules, health, checkins, progress). Không bịa thông tin. Không tạo quyền lợi không tồn tại.

==================================================
PHONG CÁCH TRẢ LỜI & GỢI Ý
==================================================
- Tự nhiên như PT hoặc tư vấn viên thật, không robot, không liệt kê dài dòng, không trả lời như tài liệu kỹ thuật.
- Nếu đã biết câu trả lời => trả lời thẳng.
- Nếu có lựa chọn tốt nhất => đề xuất rõ ràng.
- Nếu chưa đủ dữ liệu => hỏi đúng 1 câu quan trọng nhất.
- Gợi ý câu hỏi tiếp theo (suggestions) PHẢI là câu hỏi và dựa trên nội dung vừa nói. Chỉ tạo đúng 3-4 gợi ý. Tuyệt đối không gợi ý "Xem tất cả gói tập", "Chi tiết mọi gói", v.v.

CONTEXT:
${JSON.stringify(context, null, 2).slice(0, 9000)}

Return exactly one valid JSON object, no markdown:
{
  "answer": "string",
  "suggestions": ["3-4 follow-up questions"]
}
`
}

const buildReasoningContext = ({ language, userQuestion, memberContext, conversationContext }) => {
  const lang = normalizeLanguage(language)
  const data = memberContext?.availableData || {}
  return {
    language: lang,
    userQuestion,
    memberProfile: {
      ...(memberContext?.member || {}),
      ...(data.profile || {}),
    },
    currentMembership: localizeMembership(data.membership, lang),
    checkinStats: data.checkinFrequency || null,
    trainingGoal: inferTrainingGoalFromContext(memberContext, userQuestion),
    upcomingBookings: data.upcomingBookings || [],
    recentBookings: data.recentBookings || [],
    healthMetrics: data.healthMetrics || [],
    progressActivities: data.progressActivities || [],
    workoutActivities: data.workoutActivities || [],
    notificationActivities: data.notificationActivities || [],
    activePlans: (data.availablePlans || []).map((plan) => localizePlan(plan, lang)),
    recentConversation: conversationContext ? JSON.stringify(conversationContext).slice(0, 1600) : '',
    webSearch: memberContext?.webSearch || null,
  }
}

const buildPlanReasoningPrompt = ({ user, query, conversationContext, memberContext, language = 'vi' }) => {
  const lang = normalizeLanguage(language)
  const context = buildReasoningContext({ language: lang, userQuestion: query, memberContext, conversationContext })
  const languageRule = lang === 'en'
    ? 'Always answer in the user message language; if unclear, use the app language. For this request, answer entirely in English. Use localized English context only. Do not manually translate database data.'
    : 'Luôn trả lời theo ngôn ngữ trong tin nhắn user; nếu không rõ, dùng ngôn ngữ app. Với request này, trả lời hoàn toàn bằng tiếng Việt. Chỉ dùng context tiếng Việt đã localize. Không tự dịch dữ liệu database.'

  return `
Bạn là GymPro AI Assistant.
${languageRule}

MỤC TIÊU
Không phải chatbot trả lời câu hỏi thông thường. Bạn là chuyên gia tư vấn gym, hội viên, gói tập, dinh dưỡng, luyện tập và trải nghiệm khách hàng của GymPro. Nhiệm vụ là hiểu ý định thật sự của người dùng và đưa ra câu trả lời hữu ích nhất.

==================================================
NGUYÊN TẮC SUY LUẬN
==================================================
Trước khi trả lời luôn suy nghĩ:
1. Người dùng THỰC SỰ muốn gì?
2. Dữ liệu nào liên quan nhất?
3. Có đủ dữ liệu để tư vấn chưa?
4. Có thể đưa ra đề xuất ngay không?
5. Câu trả lời nào ngắn gọn nhưng hữu ích nhất?

Không trả lời theo từ khóa. Không được thấy một từ rồi suy luận ngay. Luôn xem toàn bộ ngữ cảnh cuộc hội thoại.

==================================================
HIỂU TIỀN TỆ VIỆT NAM
==================================================
Luôn chuẩn hóa tiền trước khi suy luận:
- 1k = 1.000đ | 10k = 10.000đ | 50k = 50.000đ | 100k = 100.000đ | 500k = 500.000đ
- 1 triệu = 1tr = 1.000.000đ | 2 triệu = 2tr = 2.000.000đ | 5 triệu = 5tr = 5.000.000đ
- 100 nghìn = 100k | 200 nghìn = 200k
- 1 củ = 1.000.000đ | 2 củ = 2.000.000đ | 3 củ = 3.000.000đ
Nếu nhiều cách viết cùng giá trị (ví dụ: 200k, 200 nghìn, 0.2 triệu) => hiểu là cùng một số tiền.

==================================================
TƯ DUY TƯ VẤN & KHI NÀO ĐƯỢC HỎI THÊM
==================================================
- Không liệt kê tất cả gói tập. Không biến câu trả lời thành catalog. Mục tiêu là chọn gói phù hợp nhất:
  * "Tôi mới tập gym" => ưu tiên gói cơ bản/dành cho người mới.
  * "Tôi muốn tiết kiệm" => ưu tiên gói giá rẻ.
  * "Tôi muốn tập lâu dài" => ưu tiên gói có chi phí/ngày thấp.
  * "Tôi muốn giảm cân" => ưu tiên gói hỗ trợ mục tiêu giảm cân.
  * "Tôi muốn tăng cơ" => ưu tiên gói phù hợp tăng cơ.
- Chỉ hỏi thêm nếu thực sự thiếu dữ liệu (ví dụ: chỉ nói "Tôi muốn giảm cân" => có thể hỏi thêm).
- Nếu đã ĐỦ DỮ LIỆU (ví dụ: "Tôi có 500k", "Tôi muốn tăng cơ", "Tôi tập 5 buổi/tuần") => PHẢI tư vấn luôn, không được hỏi tiếp vô ích.

==================================================
SỬ DỤNG DỮ LIỆU HỆ THỐNG
==================================================
Mọi dữ liệu từ database (CONTEXT) là nguồn sự thật duy nhất (plans, memberships, schedules, health, checkins, progress). Không bịa thông tin. Không tạo quyền lợi không tồn tại.

==================================================
PHONG CÁCH TRẢ LỜI & GỢI Ý
==================================================
- Tự nhiên như PT hoặc tư vấn viên thật, không robot, không liệt kê dài dòng, không trả lời như tài liệu kỹ thuật.
- Nếu đã biết câu trả lời => trả lời thẳng.
- Nếu có lựa chọn tốt nhất => đề xuất rõ ràng.
- Nếu chưa đủ dữ liệu => hỏi đúng 1 câu quan trọng nhất.
- Gợi ý câu hỏi tiếp theo (suggestions) PHẢI là câu hỏi và dựa trên nội dung vừa nói. Chỉ tạo đúng 3-4 gợi ý. Tuyệt đối không gợi ý "Xem tất cả gói tập", "Chi tiết mọi gói", v.v.

CONTEXT:
${JSON.stringify(context, null, 2).slice(0, 9000)}

Return exactly one valid JSON object, no markdown:
{
  "answer": "short advisory answer or clarification questions if information is not enough",
  "recommendedPlanId": "Mongo id string from activePlans, or 'none' if you are not proposing any plan yet because you need to ask questions first",
  "reason": "short reason based only on context",
  "alternativePlanIds": ["up to 2 Mongo id strings from activePlans, or empty array [] if not proposing any plan yet"],
  "suggestions": ["3-4 short follow-up questions complying with the system rules"]
}
`
}

const buildMemberSystemPrompt = (language = 'vi') => {
  const lang = normalizeLanguage(language)
  const languageRule = lang === 'en'
    ? 'Always answer in the user message language; if unclear, use the app language. For this request, answer entirely in English. Use localized English context only. Do not manually translate database data.'
    : 'Luôn trả lời theo ngôn ngữ trong tin nhắn user; nếu không rõ, dùng ngôn ngữ app. Với request này, trả lời hoàn toàn bằng tiếng Việt. Chỉ dùng context tiếng Việt đã localize. Không tự dịch dữ liệu database.'
  return `Bạn là GymPro AI Assistant.
${languageRule}

MỤC TIÊU
Không phải chatbot trả lời câu hỏi thông thường. Bạn là chuyên gia tư vấn gym, hội viên, gói tập, dinh dưỡng, luyện tập và trải nghiệm khách hàng của GymPro. Nhiệm vụ là hiểu ý định thật sự của người dùng và đưa ra câu trả lời hữu ích nhất.

==================================================
NGUYÊN TẮC SUY LUẬN
==================================================
Trước khi trả lời luôn suy nghĩ:
1. Người dùng THỰC SỰ muốn gì?
2. Dữ liệu nào liên quan nhất?
3. Có đủ dữ liệu để tư vấn chưa?
4. Có thể đưa ra đề xuất ngay không?
5. Câu trả lời nào ngắn gọn nhưng hữu ích nhất?

Không trả lời theo từ khóa. Không được thấy một từ rồi suy luận ngay. Luôn xem toàn bộ ngữ cảnh cuộc hội thoại.

==================================================
HIỂU TIỀN TỆ VIỆT NAM
==================================================
Luôn chuẩn hóa tiền trước khi suy luận:
- 1k = 1.000đ | 10k = 10.000đ | 50k = 50.000đ | 100k = 100.000đ | 500k = 500.000đ
- 1 triệu = 1tr = 1.000.000đ | 2 triệu = 2tr = 2.000.000đ | 5 triệu = 5tr = 5.000.000đ
- 100 nghìn = 100k | 200 nghìn = 200k
- 1 củ = 1.000.000đ | 2 củ = 2.000.000đ | 3 củ = 3.000.000đ
Nếu nhiều cách viết cùng giá trị (ví dụ: 200k, 200 nghìn, 0.2 triệu) => hiểu là cùng một số tiền.

==================================================
TƯ DUY TƯ VẤN & KHI NÀO ĐƯỢC HỎI THÊM
==================================================
- Không liệt kê tất cả gói tập. Không biến câu trả lời thành catalog. Mục tiêu là chọn gói phù hợp nhất:
  * "Tôi mới tập gym" => ưu tiên gói cơ bản/dành cho người mới.
  * "Tôi muốn tiết kiệm" => ưu tiên gói giá rẻ.
  * "Tôi muốn tập lâu dài" => ưu tiên gói có chi phí/ngày thấp.
  * "Tôi muốn giảm cân" => ưu tiên gói hỗ trợ mục tiêu giảm cân.
  * "Tôi muốn tăng cơ" => ưu tiên gói phù hợp tăng cơ.
- Chỉ hỏi thêm nếu thực sự thiếu dữ liệu (ví dụ: chỉ nói "Tôi muốn giảm cân" => có thể hỏi thêm).
- Nếu đã ĐỦ DỮ LIỆU (ví dụ: "Tôi có 500k", "Tôi muốn tăng cơ", "Tôi tập 5 buổi/tuần") => PHẢI tư vấn luôn, không được hỏi tiếp vô ích.

==================================================
SỬ DỤNG DỮ LIỆU HỆ THỐNG
==================================================
Mọi dữ liệu từ database là nguồn sự thật duy nhất. Không bịa thông tin. Không tạo quyền lợi không tồn tại.

==================================================
PHONG CÁCH TRẢ LỜI & GỢI Ý
==================================================
- Tự nhiên như PT hoặc tư vấn viên thật, không robot, không liệt kê dài dòng, không trả lời như tài liệu kỹ thuật.
- Nếu đã biết câu trả lời => trả lời thẳng.
- Nếu có lựa chọn tốt nhất => đề xuất rõ ràng.
- Nếu chưa đủ dữ liệu => hỏi đúng 1 câu quan trọng nhất.
- Gợi ý câu hỏi tiếp theo (suggestions) PHẢI là câu hỏi và dựa trên nội dung vừa nói. Chỉ tạo đúng 3-4 gợi ý. Tuyệt đối không gợi ý "Xem tất cả gói tập", "Chi tiết mọi gói", v.v.

Hãy trả lời bằng ngôn ngữ: ${lang}.`
}

const buildContextPrompt = ({ query, conversationContext, memberContext, language = 'vi', planMode = false }) => {
  const context = buildReasoningContext({
    language,
    userQuestion: query,
    memberContext,
    conversationContext,
  })

  return `CONTEXT:
${JSON.stringify(context, null, 2).slice(0, 9000)}

Output JSON only, no explanation:
${planMode
    ? `{
  "answer": "short advisory answer or clarification questions if information is not enough",
  "recommendedPlanId": "Mongo id string from activePlans, or 'none' if you are not proposing any plan yet because you need to ask questions first",
  "reason": "short reason based only on context",
  "alternativePlanIds": ["up to 2 Mongo id strings from activePlans, or empty array [] if not proposing any plan yet"],
  "suggestions": ["3-4 short follow-up questions complying with the system rules"]
}`
    : `{
  "answer": "short answer",
  "suggestions": ["3-4 short follow-up questions complying with the system rules"]
}`}`
}

const hasAnyProviderConfigured = () => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY)
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY)
  const hasGroq = Boolean(process.env.GROQ_API_KEY)
  return hasGemini || hasOpenRouter || hasGroq
}

const idsEqual = (a, b) => String(a || '') === String(b || '')

const RESPONSE_TYPES = new Set([
  'text_advice',
  'unclear_question',
  'plan_list',
  'plan_detail',
  'plan_recommend',
  'plan_compare',
  'plan_compare_two',
  'plan_compare_all',
  'schedule_info',
  'checkin_summary',
  'pt_list',
  'pt_detail',
  'pt_advice',
  'pt_advice_no_data',
  'pt_availability',
  'booking_list',
  'booking_suggestion',
  'health_advice',
  'workout_advice',
  'workout_progress',
  'health_summary',
  'product_list',
  'product_recommend',
  'notification_list',
  'policy_answer',
  'policy_refund',
  'policy_privacy',
  'policy_payment',
  'admin_dashboard',
  'report_summary',
  'action_result',
])

const normalizeResponseType = (type, classifierIntent) => {
  if (RESPONSE_TYPES.has(type)) return type
  if (type === 'trainer_list') return 'pt_list'
  if (classifierIntent === 'checkin_info') return 'checkin_summary'
  if (classifierIntent === 'checkin_summary') return 'checkin_summary'
  if (classifierIntent === 'checkin_goal') return 'checkin_summary'
  if (classifierIntent === 'pt_info') return 'pt_list'
  if (classifierIntent === 'pt_availability') return 'booking_suggestion'
  if (classifierIntent === 'pt_advice') return 'pt_list'
  if (classifierIntent === 'booking_info') return 'booking_list'
  if (classifierIntent === 'booking_action') return 'booking_suggestion'
  if (classifierIntent === 'workout_info') return 'workout_advice'
  if (classifierIntent === 'workout_advice') return 'workout_advice'
  if (classifierIntent === 'health_info' || classifierIntent === 'health_advice') return 'health_summary'
  if (classifierIntent === 'shop_info') return 'product_list'
  if (classifierIntent === 'shop_advice') return 'product_recommend'
  if (classifierIntent === 'notification_info') return 'notification_list'
  if (classifierIntent === 'policy_faq' || classifierIntent === 'policy_refund' || classifierIntent === 'policy_privacy' || classifierIntent === 'policy_payment' || classifierIntent === 'policy_terms' || classifierIntent === 'faq_answer') return 'policy_answer'
  if (classifierIntent === 'admin_report') return 'report_summary'
  if (classifierIntent === 'theme_action' || classifierIntent === 'feedback_action') return 'action_result'
  if (classifierIntent === 'plan_comparison') return 'plan_recommend'
  if (classifierIntent === 'cheapest_long_term_plan') return 'plan_recommend'
  if (classifierIntent === 'unclear_question') return 'unclear_question'
  return 'text_advice'
}

const pickCardsForType = ({ type, toolData, recommendedPlan, alternativePlans }) => {
  if (type === 'plan_recommend' && recommendedPlan) return [recommendedPlan, ...(alternativePlans || []).slice(0, 2)]
  if (type === 'plan_list') return (toolData.activePlans || toolData.plans || []).slice(0, 12)
  if (type === 'pt_list' || type === 'booking_suggestion') return (toolData.ptAvailability?.availablePTs || toolData.availablePTs || []).slice(0, 8)
  if (type === 'booking_list') return (toolData.upcomingBookings || []).slice(0, 8)
  if (type === 'product_list' || type === 'product_recommend') return (toolData.products || []).slice(0, 8)
  if (type === 'notification_list') return (toolData.notifications || []).slice(0, 8)
  if (type === 'policy_answer') return [...(toolData.policies || []), ...(toolData.faqs || [])].slice(0, 6)
  if (type === 'checkin_summary') return [toolData.checkinStats].filter(Boolean)
  if (type === 'health_summary') return [toolData.healthSummary].filter(Boolean)
  if (type === 'workout_progress') return (toolData.workoutProgress || []).slice(0, 6)
  if (type === 'admin_dashboard' || type === 'report_summary') return [toolData.dashboardStats, toolData.revenueSummary].filter(Boolean)
  return []
}

const CARD_RENDER_TYPES = new Set([
  'plan_list',
  'plan_detail',
  'plan_recommend',
  'plan_compare',
  'plan_compare_two',
  'plan_compare_all',
  'pt_list',
  'trainer_list',
  'booking_list',
  'product_list',
  'checkin_summary',
])

const TEXT_ONLY_TYPES = new Set([
  'text_advice',
  'policy_answer',
  'policy_refund',
  'policy_privacy',
  'policy_payment',
  'pt_advice_no_data',
  'unclear_question',
])

const applyRenderGate = (payload = {}, classifierResult = {}) => {
  const normalizedType = normalizeResponseType(payload.type, classifierResult.intent)
  const shouldRenderCard = !TEXT_ONLY_TYPES.has(normalizedType)
    && (CARD_RENDER_TYPES.has(normalizedType) || Boolean(classifierResult.shouldRenderCard))
  const isPlanType = /^plan_/.test(normalizedType)
  console.log('[RENDER_GATE]', normalizedType, shouldRenderCard)
  if (shouldRenderCard) {
    return {
      ...payload,
      type: normalizedType,
      planPayload: isPlanType ? payload.planPayload : null,
      plans: isPlanType ? (payload.plans || []) : [],
      recommendedPlan: isPlanType ? (payload.recommendedPlan || null) : null,
    }
  }
  return {
    ...payload,
    type: normalizedType,
    cards: [],
    plans: [],
    recommendedPlan: null,
    planPayload: null,
  }
}

const buildAiPlanRecommendationPayload = ({ aiPayload, memberContext, query, language }) => {
  const plans = memberContext?.availableData?.availablePlans || []
  if (!Array.isArray(plans) || plans.length === 0) return null
  const recommendedPlanId = aiPayload?.recommendedPlanId || aiPayload?.planId
  if (recommendedPlanId === 'none' || !recommendedPlanId) {
    return null
  }
  const recommendedPlan = plans.find((plan) => idsEqual(plan._id, recommendedPlanId))
  if (!recommendedPlan) return null

  const alternativeIds = Array.isArray(aiPayload?.alternativePlanIds)
    ? aiPayload.alternativePlanIds
    : Array.isArray(aiPayload?.alternatives) ? aiPayload.alternatives : []
  const alternatives = alternativeIds
    .map((id) => plans.find((plan) => idsEqual(plan._id, id)))
    .filter(Boolean)
    .filter((plan) => !idsEqual(plan._id, recommendedPlan._id))
    .slice(0, 2)

  const fallbackAlternatives = plans
    .filter((plan) => !idsEqual(plan._id, recommendedPlan._id) && !alternatives.some((item) => idsEqual(item._id, plan._id)))
    .slice(0, Math.max(0, 2 - alternatives.length))

  return {
    type: 'plan_recommend',
    recommendedPlan,
    reason: typeof aiPayload?.reason === 'string' && aiPayload.reason.trim()
      ? aiPayload.reason.trim()
      : aiPayload?.answer || '',
    alternatives: [...alternatives, ...fallbackAlternatives].slice(0, 2),
  }
}

const buildMemberProfileForSuggestions = (memberContext) => {
  const data = memberContext?.availableData || {}
  return {
    ...(memberContext?.member || {}),
    ...(data.profile || {}),
    checkinFrequency: data.checkinFrequency || null,
    recentBookings: data.recentBookings || [],
    upcomingBookings: data.upcomingBookings || [],
    healthMetrics: data.healthMetrics || [],
    progressActivities: data.progressActivities || [],
    workoutActivities: data.workoutActivities || [],
    notificationActivities: data.notificationActivities || [],
  }
}

const inferTrainingGoalFromContext = (memberContext, query = '') => {
  const data = memberContext?.availableData || {}
  const text = normalizeForIntent([
    query,
    ...(data.progressActivities || []).map((item) => `${item.title || ''} ${item.description || ''}`),
    ...(data.healthMetrics || []).map((item) => `${item.title || ''} ${item.description || ''}`),
    ...(data.workoutActivities || []).map((item) => `${item.title || ''} ${item.description || ''}`),
  ].join(' '))
  if (/\b(tang co|muscle|gain muscle|hypertrophy)\b/.test(text)) return 'muscle_gain'
  if (/\b(giam mo|giam can|fat loss|lose fat|weight loss|cut)\b/.test(text)) return 'fat_loss'
  if (/\b(tang can|bulk|bulking|gain weight)\b/.test(text)) return 'weight_gain'
  if (/\b(suc ben|endurance|cardio)\b/.test(text)) return 'endurance'
  return 'unknown'
}

// 1. Vietnamese Money Normalizer
export const normalizeVietnameseMoney = (text = '') => {
  const normalized = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/,/g, '')

  const cuMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:cu)\b/)
  if (cuMatch) return parseFloat(cuMatch[1]) * 1000000

  const trieuMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:trieu|tr)\b/)
  if (trieuMatch) return parseFloat(trieuMatch[1]) * 1000000

  const nghinMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:nghin|ngan)\b/)
  if (nghinMatch) return parseFloat(nghinMatch[1]) * 1000

  const kMatch = normalized.match(/(\d+(?:\.\d+)?)\s*k\b/)
  if (kMatch) return parseFloat(kMatch[1]) * 1000

  const numMatch = normalized.match(/\b(\d{4,9})\b/)
  if (numMatch) return parseInt(numMatch[1], 10)

  return null
}

const normalizeToolName = (toolName) => {
  const value = String(toolName || '').trim()
  if (value === 'trainers') return 'pt'
  if (value === 'activePlans') return 'plans'
  if (value === 'currentMembership') return 'membership'
  if (value === 'checkinStats') return 'checkins'
  if (value === 'upcomingSchedule') return 'schedule'
  if (value === 'healthSummary') return 'health'
  if (value === 'workoutProgress') return 'workout'
  if (value === 'ptAvailability') return 'ptAvailability'
  if (value === 'pts') return 'pt'
  if (value === 'availablePTs') return 'pt'
  return value
}

const ADMIN_ROLES = new Set(['admin'])
const getRole = (user) => user?.role || 'member'
const hasRole = (user, roles) => roles.has(getRole(user))

const getPermissionsForRole = (role = 'member') => ({
  canViewOwnData: true,
  canViewBasicMembers: ['admin', 'staff'].includes(role),
  canViewPtTeachingData: ['admin', 'pt'].includes(role),
  canViewReports: role === 'admin',
  canViewRevenue: role === 'admin',
  canManageSystem: role === 'admin',
  canHelpCheckin: ['admin', 'staff'].includes(role),
  canUseThemeAction: ['admin', 'pt', 'staff', 'member', 'seller'].includes(role),
})

const normalizeTimeRange = (text = '', now = new Date()) => {
  const normalized = normalizeForIntent(text)
  const start = new Date(now)
  const end = new Date(now)
  const setDay = (date) => {
    const s = new Date(date)
    s.setHours(0, 0, 0, 0)
    const e = new Date(date)
    e.setHours(23, 59, 59, 999)
    return { label: 'day', start: s, end: e }
  }
  if (/\b(hom nay|today)\b/.test(normalized)) return { ...setDay(now), raw: text }
  if (/\b(toi nay|tonight)\b/.test(normalized)) {
    start.setHours(18, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return { label: 'tonight', start, end, raw: text }
  }
  if (/\b(sang mai|tomorrow morning)\b/.test(normalized)) {
    start.setDate(start.getDate() + 1)
    start.setHours(5, 0, 0, 0)
    end.setDate(end.getDate() + 1)
    end.setHours(11, 59, 59, 999)
    return { label: 'tomorrow_morning', start, end, raw: text }
  }
  if (/\b(ngay mai|mai|tomorrow)\b/.test(normalized)) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return { ...setDay(tomorrow), raw: text }
  }
  if (/\b(tuan nay|this week)\b/.test(normalized)) {
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    end.setTime(start.getTime())
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { label: 'this_week', start, end, raw: text }
  }
  if (/\b(thang nay|this month)\b/.test(normalized)) {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    end.setMonth(start.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
    return { label: 'this_month', start, end, raw: text }
  }
  return { label: 'unknown', start: null, end: null, raw: text }
}

const hasExplicitScheduleIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(lich cua toi|hom nay co lich|tuan nay co lich|lich da dat|lich sap toi|lich pt|dat lich pt|huy lich|doi lich|booking|my schedule|upcoming schedule|cancel booking|book pt)\b/.test(normalized)
}

const hasBookingActionIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(dat lich|book|booking|huy lich|cancel booking|doi lich|reschedule)\b/.test(normalized)
}

const hasPtAvailabilityIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(pt nao|huan luyen vien nao|trainer nao)\b/.test(normalized)
    && /\b(ranh|trong|con lich|lich trong|available|free slot|slot)\b/.test(normalized)
    && !/\b(cua toi|toi co lich|lich cua toi|my booking|my schedule)\b/.test(normalized)
}

const hasPtAdviceIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(pt nao|huan luyen vien nao|trainer nao|personal trainer|which pt|which trainer|coach nao)\b/.test(normalized)
    && /\b(phu hop|hop|tu van|goi y|recommend|suitable|fit|cho nguoi moi|moi tap|beginner|tang co|muscle|ngan sach|budget|gia re|low budget)\b/.test(normalized)
    && !hasPtAvailabilityIntent(query)
    && !hasBookingInfoIntent(query)
}

const hasBookingInfoIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(cua toi|toi co lich|lich cua toi|lich da dat|lich sap toi|my booking|my schedule|upcoming booking)\b/.test(normalized)
    && /\b(pt|lich|booking|schedule)\b/.test(normalized)
}

const hasCheckinGoalIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(muc tieu|dat|goal|target|con thieu|thieu bao nhieu|bao nhieu nua|con thiếu|thiếu bao nhiêu)\b/.test(normalized)
    && /\b(checkin|check in|di tap|buoi\/thang|buoi thang|buoi moi thang|sessions per month)\b/.test(normalized)
}

const extractMonthlyCheckinTarget = (query = '') => {
  const normalized = normalizeForIntent(query)
  const match = normalized.match(/\b(\d{1,2})\s*(?:buoi|lan|ngay|sessions?)\s*(?:\/|moi|mot|per)?\s*(?:thang|month)\b/)
    || normalized.match(/\bdat\s+(\d{1,2})\s*(?:buoi|lan|ngay|sessions?)\b/)
  const target = match ? Number(match[1]) : null
  return Number.isFinite(target) && target > 0 && target <= 60 ? target : null
}

const hasRefundPolicyIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(hoan tien|refund|tra tien|lay lai tien|doi y|khong tap nua|huy goi|huy|cancel|doi tra)\b/.test(normalized)
    && /\b(goi|membership|mua|purchase|refund|hoan tien|tra tien|huy)\b/.test(normalized)
}

const hasPrivacyPolicyIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(bao mat|privacy|du lieu ca nhan|thong tin ca nhan|ban du lieu|chia se du lieu|ben thu ba|third party|personal data|sell my data|share my data)\b/.test(normalized)
}

const hasPaymentPolicyIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(thanh toan|payment|tra gop|chuyen khoan|hoa don|invoice)\b/.test(normalized)
}

const hasShopIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(whey|creatine|protein powder|san pham|shop|do tap|do gym|binh lac|gang tay|mua hang|don hang|cart|gio hang)\b/.test(normalized)
}

const hasMembershipAdviceIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return Boolean(normalizeVietnameseMoney(query))
    || /\b(sinh vien|ngan sach|budget|goi tap|goi nao|chon goi|nen mua vip|khong nen mua vip|vip|co ban|basic|lau dai|tiet kiem|phong tap|khong can pt|can pt|khoe hon|giam mo|tang co)\b/.test(normalized)
}

const hasCheapestLongTermIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  const longTerm = /\b(\d+\s*(thang|nam|month|year|ngay|day)|dai han|dai|long term|nhieu thang)\b/.test(normalized)
  const cheapest = /\b(re nhat|rẻ nhất|gia re|giá rẻ|cheap|cheapest|tiet kiem|tiết kiệm|it tien nhat|ít tiền nhất|chi it|chi .*tien|save money|economical|affordable)\b/.test(normalized)
  return longTerm && cheapest
    || /\b(chi it tien nhat|chi .*thang .*re|cheapest .*(month|year|long)|long.*cheapest|economical.*long|tiết kiệm.*lâu)\b/.test(normalized)
    || /\b(tap.*thang.*re|tập.*tháng.*rẻ|tiet kiem.*nhat.*thang)\b/.test(normalized)
}

const hasPlanPtAdviceQuestion = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(co nen|nen|should|worth|dang tien|tu van|advice)\b/.test(normalized)
    && /\b(goi|plan|membership)\b/.test(normalized)
    && /\b(pt|personal trainer|trainer|huan luyen vien)\b/.test(normalized)
}

const hasHealthOrWorkoutContext = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(tap|buoi\/tuan|giam mo|giam can|tang co|tang can|workout|bai tap|dinh duong|health|suc khoe|bmi|calo|protein|fat loss|muscle)\b/.test(normalized)
}

const asksPlanBenefitQuestion = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(co .* khong|include|includes|included|bao gom|quyen loi|feature|benefit|mien phi|free|ho tro|hỗ trợ)\b/.test(normalized)
    && /\b(goi|vip|premium|basic|co ban|nang cao|plan|membership)\b/.test(normalized)
}

const hasMembershipBenefitLookup = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(co .* khong|includes?|benefit|quyen loi|quyền lợi|ho tro|hỗ trợ)\b/.test(normalized)
    && /\b(vip|premium|basic|co ban|nang cao|goi|plan)\b/.test(normalized)
}

const extractAskedPlanBenefit = (query = '', language = 'vi') => {
  const lang = normalizeLanguage(language)
  const normalized = normalizeForIntent(query)
  if (/\b(ho boi|pool)\b/.test(normalized)) return lang === 'en' ? 'pool' : 'hồ bơi'
  if (/\b(pt|personal trainer|trainer|huan luyen vien)\b/.test(normalized)) return 'PT'
  if (/\b(xong hoi|sauna)\b/.test(normalized)) return lang === 'en' ? 'sauna' : 'xông hơi'
  if (/\b(lop nhom|group class|class)\b/.test(normalized)) return lang === 'en' ? 'group classes' : 'lớp nhóm'
  const match = normalized.match(/\b(?:co|includes?|included|bao gom)\s+(.+?)\s+(?:khong|không)\b/)
    || normalized.match(/\b(?:co|includes?|included|bao gom)\s+(.+)$/)
  return match?.[1]?.trim() || (lang === 'en' ? 'that benefit' : 'quyền lợi đó')
}

const findPlanMentionedInQuery = (plans = [], query = '') => {
  const normalized = normalizeForIntent(query)
  return (Array.isArray(plans) ? plans : []).find((plan) => {
    const names = [plan?.nameVi, plan?.nameEn]
      .filter(Boolean)
      .map((name) => normalizeForIntent(name).replace(/^goi\s+/, '').trim())
      .filter(Boolean)
    return names.some((name) => normalized.includes(name))
  }) || null
}

const inferGoalEntity = (query = '') => {
  const normalized = normalizeForIntent(query)
  if (/\b(tang co|muscle|hypertrophy|strength)\b/.test(normalized)) return 'muscle_gain'
  if (/\b(giam mo|giam can|fat loss|weight loss)\b/.test(normalized)) return 'fat_loss'
  if (/\b(tang can|gain weight|bulk)\b/.test(normalized)) return 'weight_gain'
  if (/\b(khoe hon|suc khoe|healthy|fitness)\b/.test(normalized)) return 'general_fitness'
  return null
}

const hasWorkoutFrequencyIntent = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\btap\s+\d{1,2}\s*(?:buoi|lan|ngay|sessions?)\s*(?:\/|mot|moi|tren|per)?\s*(?:tuan|week)\b/.test(normalized)
    || /\btap\s+moi\s+ngay\b/.test(normalized)
    || /\btap\s+deu\b/.test(normalized)
    || /\bcheckin\s+\d{1,2}\s*(?:buoi|lan|ngay|sessions?)\b/.test(normalized)
}

const inferSubjectFromIntent = (intent = '') => {
  if (intent.startsWith('membership_') || intent === 'plan_comparison') return 'plan'
  if (intent.startsWith('pt_')) return 'trainer'
  if (intent.startsWith('booking_')) return 'booking'
  if (intent.startsWith('checkin_')) return 'checkin'
  if (intent.startsWith('workout_')) return 'workout'
  if (intent.startsWith('health_')) return 'health'
  if (intent.startsWith('policy_') || intent === 'faq_answer') return 'policy'
  if (intent.startsWith('shop_')) return 'shop'
  return ''
}

const resolveClarificationFollowUp = (query = '', recentMessages = []) => {
  if (!Array.isArray(recentMessages) || recentMessages.length < 2) return null
  const lastAssistant = [...recentMessages].reverse().find(m => m.role === 'assistant')
  if (!lastAssistant) return null
  const assistantContent = normalizeForIntent(lastAssistant.content || '')
  const normalizedQuery = normalizeForIntent(query)

  const wasClarifying = /\b(ban muon|bạn muốn|what would you like|what do you want)\b/.test(assistantContent)
  if (!wasClarifying) return null

  const entity = /\bvip\b/.test(assistantContent) ? 'VIP' : null

  const asksPrice = /\b(gia|price|cost)\b/.test(normalizedQuery)
  const asksBenefits = /\b(quyen loi|quyền lợi|benefit|co .* khong|includes?|feature|ho tro|hỗ trợ)\b/.test(normalizedQuery)
  const asksComparison = /\b(so sanh|so sánh|compare|vs)\b/.test(normalizedQuery)

  if (asksBenefits && entity) {
    return { subject: 'plan', intent: 'membership_info', action: 'info', entity, shouldRenderCard: false, tools: ['plans'], needsAIReasoning: false, reason: 'memory: follow-up to clarification asking benefits' }
  }
  if (asksPrice && entity) {
    return { subject: 'plan', intent: 'membership_info', action: 'info', entity, shouldRenderCard: false, tools: ['plans'], needsAIReasoning: false, reason: 'memory: follow-up to clarification asking price' }
  }
  if (asksComparison && entity) {
    return { subject: 'plan', intent: 'plan_comparison', action: 'compare', entity, shouldRenderCard: true, tools: ['plans'], needsAIReasoning: false, reason: 'memory: follow-up to clarification asking comparison' }
  }
  return null
}

const buildSemanticConversationMemory = (conversationContext = {}, query = '') => {
  const normalizedQuery = normalizeForIntent(query).trim()
  const rawMessages = Array.isArray(conversationContext?.recentMessages) ? conversationContext.recentMessages : []
  const recentMessages = rawMessages
    .filter((message) => message && typeof message.content === 'string')
    .filter((message) => normalizeForIntent(message.content).trim() !== normalizedQuery)
    .slice(-5)
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').slice(0, 500),
      createdAt: message.createdAt,
      intent: message.intent,
      action: message.action,
      subject: message.subject,
    }))

  const lastClassifiedMessage = [...recentMessages].reverse().find((message) => message.intent || message.subject)
  const lastIntent = conversationContext?.lastIntent || lastClassifiedMessage?.intent || ''
  const lastSubject = conversationContext?.lastSubject || lastClassifiedMessage?.subject || inferSubjectFromIntent(lastIntent)
  const previousUserMessage = [...recentMessages].reverse().find((message) => message.role === 'user')?.content || ''
  const budgetMessage = [...recentMessages].reverse().find((message) => message.role === 'user' && normalizeVietnameseMoney(message.content))
  const budget = budgetMessage ? normalizeVietnameseMoney(budgetMessage.content) : null
  const budgetPeriod = budgetMessage && isMonthlyBudgetAdvice(normalizeForIntent(budgetMessage.content)) ? 'month' : 'unknown'
  const isSupplemental = hasWorkoutFrequencyIntent(query)

  const pendingClarification = resolveClarificationFollowUp(query, recentMessages)

  return {
    recentMessages,
    lastIntent,
    lastSubject,
    previousUserMessage,
    budget,
    budgetPeriod,
    budgetText: budgetMessage?.content || '',
    isSupplemental,
    supplementalSignals: {
      frequencyPerWeek: normalizeWeeklyFrequency(query),
      workoutFrequency: hasWorkoutFrequencyIntent(query),
    },
    pendingClarification,
  }
}

const isPlanAdviceMemory = (memory = {}) => (
  memory.lastSubject === 'plan'
  || memory.lastIntent === 'membership_advice'
  || memory.lastIntent === 'plan_comparison'
)

const buildReasoningQueryWithMemory = (query = '', memory = {}) => {
  if (memory?.budget && hasPlanPtAdviceQuestion(query)) {
    return `${memory.budgetText || `Ngân sách ${memory.budget} VND/tháng`}\n${query}`
  }
  if (!memory?.isSupplemental || !memory.previousUserMessage) return query
  return `${memory.previousUserMessage}\n${query}`
}

const isShortUnclearQuestion = (query = '') => {
  const normalized = normalizeForIntent(query).replace(/[?!.,:;]+/g, ' ').trim()
  if (!normalized) return true
  const tokens = normalized.split(/\s+/).filter(Boolean)
  return tokens.length <= 2
    && /\b(vip|pt|goi|plan|trainer|checkin|check in|shop|lich|schedule|policy|faq)\b/.test(normalized)
    && !/\b(gia|price|cost|quyen loi|benefit|compare|so sanh|list|danh sach|xem|show|detail|chi tiet|refund|privacy)\b/.test(normalized)
}

const inferUnclearSubject = (query = '') => {
  const normalized = normalizeForIntent(query)
  if (/\b(pt|trainer)\b/.test(normalized)) return 'trainer'
  if (/\b(vip|goi|plan)\b/.test(normalized)) return 'plan'
  if (/\b(checkin|check in)\b/.test(normalized)) return 'checkin'
  if (/\b(lich|schedule)\b/.test(normalized)) return 'booking'
  if (/\b(shop)\b/.test(normalized)) return 'shop'
  if (/\b(policy|faq)\b/.test(normalized)) return 'policy'
  return 'general'
}

const buildQuestionAnalysis = (query = '', language = 'vi') => {
  const lang = normalizeLanguage(language)
  const normalized = normalizeForIntent(query)
  const budget = normalizeVietnameseMoney(query)
  const frequencyPerWeek = normalizeWeeklyFrequency(query)
  const timeRange = normalizeTimeRange(query).label
  const hasPlanSubject = /\b(goi|goi tap|goi gym|goi vip|goi co ban|goi nang cao|membership|membership plan|package|plan|plans|vip)\b/.test(normalized)
  const hasTrainerSubject = /\b(pt|huan luyen vien|trainer|personal trainer|coach)\b/.test(normalized)
  const hasBookingSubject = /\b(lich da dat|lich sap toi|lich cua toi|toi co lich|booking|my booking|my schedule|upcoming booking|dat lich|huy lich|doi lich)\b/.test(normalized)
  const asksTrainerWhich = hasTrainerSubject && /\b(nao|which|recommend|goi y|tu van|phu hop|suitable|fit)\b/.test(normalized)
  const asksPlanWithPt = hasPlanSubject && hasTrainerSubject && /\b(co nen|nen|mua|chon|goi co pt|plan with pt|package with pt)\b/.test(normalized)
  const asksAvailability = hasTrainerSubject && /\b(ranh|trong|con lich|lich trong|available|free slot|slot)\b/.test(normalized)
  const asksOwnBooking = hasBookingSubject && /\b(cua toi|toi co|my|lich pt nao|lich tap)\b/.test(normalized)
  const bookingAction = hasBookingActionIntent(query)
  const planBenefit = asksPlanBenefitQuestion(query)
  const planList = /\b(xem cac goi|danh sach goi|cac goi tap|goi tap nao|membership plans|show plans|list plans)\b/.test(normalized)
  const planAdvice = hasPlanSubject && /\b(co nen|nen|chon|tu van|phu hop|recommend|should|which|best|dang tien|worth)\b/.test(normalized)
  const hasPlanAdviceCondition = Boolean(budget)
    || Boolean(frequencyPerWeek)
    || Boolean(inferGoalEntity(query))
    || /\b(sinh vien|student|ngan sach|budget|nguoi moi|moi tap|beginner|can pt|khong can pt|with pt|without pt|lau dai|long term|tiet kiem|affordable)\b/.test(normalized)
  const checkinSubject = /\b(checkin|check in|diem danh)\b/.test(normalized)
  const policySubject = /\b(chinh sach|quy dinh|faq|terms|dieu khoan|refund|privacy|payment)\b/.test(normalized)
    || hasPrivacyPolicyIntent(query)
    || hasRefundPolicyIntent(query)
    || hasPaymentPolicyIntent(query)
  const healthSubject = /\b(bmi|dau lung|dau nguc|kho tho|chong mat|chan thuong|huyet ap|health)\b/.test(normalized)
  const workoutSubject = /\b(bai tap|workout|lo trinh|tap gi|tap \d|buoi\/tuan|sessions per week)\b/.test(normalized) || Boolean(frequencyPerWeek)
  const workoutFrequency = hasWorkoutFrequencyIntent(query)

  const base = {
    subject: 'general',
    action: 'unclear',
    intent: 'unknown',
    confidence: 0.35,
    shouldAskClarify: false,
    shouldRenderCard: false,
    language: lang,
    needsAIReasoning: true,
    needsDatabase: true,
    tools: [],
    entities: {
      budget,
      goal: inferGoalEntity(query),
      frequencyPerWeek,
      timeRange,
      mentionedPlanNames: [],
      mentionedTrainerNames: [],
      needsPT: null,
    },
    reason: 'Layered subject/action analysis.',
  }

  if (isShortUnclearQuestion(query)) {
    return {
      ...base,
      subject: inferUnclearSubject(query),
      action: 'unclear',
      intent: 'unclear_question',
      confidence: 0.95,
      shouldAskClarify: true,
      needsAIReasoning: false,
      needsDatabase: false,
      tools: [],
      reason: 'Message is too short/ambiguous to choose intent or render UI.',
    }
  }

  if (policySubject) return { ...base, subject: 'policy', action: 'policy_lookup', intent: hasRefundPolicyIntent(query) ? 'policy_refund' : hasPrivacyPolicyIntent(query) ? 'policy_privacy' : hasPaymentPolicyIntent(query) ? 'policy_payment' : 'faq_answer', confidence: 0.9, tools: ['faqs', 'policies'], shouldRenderCard: false, needsAIReasoning: false, reason: 'User asks policy or FAQ.' }
  if (asksPlanWithPt) return { ...base, subject: 'plan', action: 'advice', intent: 'membership_advice', confidence: 0.9, tools: ['plans'], reason: 'User asks whether to buy/select a plan that includes PT.' }
  if (bookingAction && hasTrainerSubject) return { ...base, subject: 'booking', action: 'create', intent: 'booking_action', confidence: 0.9, tools: ['trainers', 'ptAvailability', 'bookings'], reason: 'User wants to create or change a PT booking.' }
  if (asksOwnBooking) return { ...base, subject: 'booking', action: 'personal_data', intent: 'booking_info', confidence: 0.9, tools: ['bookings'], shouldRenderCard: true, needsAIReasoning: false, reason: 'User asks about their own booked PT/training schedule.' }
  if (asksAvailability) return { ...base, subject: 'trainer', action: 'availability', intent: 'pt_availability', confidence: 0.9, tools: ['trainers', 'ptAvailability'], shouldRenderCard: true, needsAIReasoning: false, reason: 'User asks trainer availability/free slots.' }
  if (asksTrainerWhich) return { ...base, subject: 'trainer', action: 'advice', intent: 'pt_advice', confidence: 0.9, tools: ['trainers'], reason: 'User asks which trainer fits their constraints.' }
  if (planBenefit) return { ...base, subject: 'plan', action: 'info', intent: 'membership_info', confidence: 0.9, tools: ['plans'], shouldRenderCard: false, needsAIReasoning: false, reason: 'User asks a specific plan benefit/info question.' }
  if (planList) return { ...base, subject: 'plan', action: 'info', intent: 'membership_info', confidence: 0.85, tools: ['plans'], shouldRenderCard: true, needsAIReasoning: false, reason: 'User asks to view membership plans.' }
  if (planAdvice && !hasPlanAdviceCondition) return { ...base, subject: 'plan', action: 'unclear', intent: 'unclear_question', confidence: 0.86, shouldAskClarify: true, needsAIReasoning: false, needsDatabase: false, tools: [], reason: 'Plan advice request is too vague to recommend without one key constraint.' }
  if (hasCheapestLongTermIntent(query)) return { ...base, subject: 'plan', action: 'compare', intent: 'cheapest_long_term_plan', confidence: 0.85, tools: ['plans'], needsDatabase: true, needsAIReasoning: false, shouldRenderCard: false, reason: 'User asks for cheapest long-term plan option.' }
  if (planAdvice || hasMembershipAdviceIntent(query)) return { ...base, subject: 'plan', action: 'advice', intent: 'membership_advice', confidence: 0.8, tools: ['plans'], reason: 'User asks for membership plan advice.' }
  if (hasCheckinGoalIntent(query)) return { ...base, subject: 'checkin', action: 'info', intent: 'checkin_goal', confidence: 0.85, tools: ['checkins'], shouldRenderCard: true, needsAIReasoning: false, reason: 'User asks check-in goal/progress.' }
  if (workoutFrequency) return { ...base, subject: 'workout', action: 'info', intent: 'workout_info', confidence: 0.88, tools: ['workout'], shouldRenderCard: false, needsAIReasoning: true, reason: 'User states workout/check-in training frequency, not a booked schedule.' }
  if (checkinSubject) return { ...base, subject: 'checkin', action: 'personal_data', intent: 'checkin_summary', confidence: 0.75, tools: ['checkins'], shouldRenderCard: true, needsAIReasoning: false, reason: 'User asks check-in data.' }
  if (hasShopIntent(query)) return { ...base, subject: 'shop', action: 'advice', intent: 'shop_advice', confidence: 0.75, tools: ['products'], reason: 'User asks shop/product advice.' }
  if (healthSubject) return { ...base, subject: 'health', action: 'advice', intent: 'health_advice', confidence: 0.75, tools: ['health'], reason: 'User asks health/safety advice.' }
  if (workoutSubject) return { ...base, subject: 'workout', action: 'advice', intent: 'workout_advice', confidence: 0.7, tools: ['workout'], reason: 'User provides or asks workout/training context, not booked schedule.' }

  return base
}

const buildThemeActionFallback = (query = '', language = 'vi') => {
  const normalized = normalizeForIntent(query)
  const color = /\b(xanh la|green)\b/.test(normalized) ? '#22c55e'
    : /\b(xanh|xanh duong|blue)\b/.test(normalized) ? '#3b82f6'
      : /\b(do|red)\b/.test(normalized) ? '#ef4444'
        : /\b(tim|purple)\b/.test(normalized) ? '#8b5cf6'
          : /\b(vang|yellow)\b/.test(normalized) ? '#eab308'
            : /\b(den|toi|dark|black)\b/.test(normalized) ? '#111827'
              : null
  return {
    action: 'change_theme',
    themeName: color ? 'custom' : 'default',
    color: color || '#e05a30',
    path: null,
    message: language === 'en' ? 'Theme updated.' : 'Đã cập nhật giao diện.',
  }
}

const hasSeriousMedicalSignal = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(dau nguc|kho tho|chong mat|ngat|chan thuong nang|benh nen|heart|chest pain|shortness of breath|faint|severe injury)\b/.test(normalized)
}

const applyMedicalSafetyGuard = (payload, query, language = 'vi') => {
  if (!hasSeriousMedicalSignal(query)) return payload
  const lang = normalizeLanguage(language)
  const safety = lang === 'en'
    ? 'With symptoms like this, I cannot diagnose. Please stop intense exercise and consult a doctor or qualified medical professional as soon as possible.'
    : 'Với triệu chứng như vậy, mình không thể chẩn đoán. Bạn nên dừng tập nặng và gặp bác sĩ hoặc chuyên gia y tế sớm để được kiểm tra an toàn.'
  const answer = String(payload?.answer || '')
  if (normalizeForIntent(answer).includes(normalizeForIntent(safety).slice(0, 30))) return payload
  return {
    ...payload,
    type: payload?.type === 'text_advice' ? 'health_summary' : payload?.type,
    answer: answer ? `${safety}\n\n${answer}` : safety,
  }
}

const sanitizeClassifierTools = (tools = []) => (
  Array.isArray(tools)
    ? tools.map(normalizeToolName).filter(Boolean)
    : []
)

const normalizeWeeklyFrequency = (text = '') => {
  const normalized = normalizeForIntent(text)
  const match = normalized.match(/\b(\d{1,2})\s*(?:buoi|ngay|lan|sessions?)\s*(?:\/|mot|moi|tren|per)?\s*(?:tuan|week)\b/)
    || normalized.match(/\btap\s+(\d{1,2})\s*(?:buoi|ngay|lan)\b/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 && value <= 14 ? value : null
}

const countAdviceSignals = (query = '', classifierResult = {}) => {
  const normalized = normalizeForIntent(query)
  const entities = classifierResult?.entities || {}
  let count = 0
  if (entities.goal || /\b(giam mo|giam can|tang co|tang can|khoe hon|giảm mỡ|giảm cân|tăng cơ|khỏe hơn)\b/.test(normalized)) count += 1
  if (entities.budget || normalizeVietnameseMoney(query) || /\b(tiet kiem|tiết kiệm|gia re|rẻ|cheap|save money)\b/.test(normalized)) count += 1
  if (entities.frequencyPerWeek || normalizeWeeklyFrequency(query)) count += 1
  if (typeof entities.needsPT === 'boolean' || /\b(khong can pt|không cần pt|can pt|cần pt)\b/.test(normalized)) count += 1
  if (/\b(moi tap|mới tập|da tap|đã tập|kinh nghiem|beginner|newbie)\b/.test(normalized)) count += 1
  if (/\b(lau dai|lâu dài|3 thang|6 thang|1 nam|thang|nam|month|year)\b/.test(normalized)) count += 1
  return count
}

const isVagueAdviceQuery = (query = '') => {
  const normalized = normalizeForIntent(query).trim()
  return /^(tu van toi|tư vấn tôi|nen chon gi|nên chọn gì|toi muon tap|tôi muốn tập|tu van|tư vấn)$/.test(normalized)
}

const answerLooksLikePrematureClarification = (answer = '') => {
  const normalized = normalizeForIntent(answer)
  return /\b(ngan sach|ngân sách|budget|ban co the cho minh biet|bạn có thể cho mình biết|can biet them|cần biết thêm|cho minh biet them|cho mình biết thêm)\b/.test(normalized)
    && /\?/.test(answer)
}

const answerLooksLikeGenericPolicyStub = (answer = '') => {
  const normalized = normalizeForIntent(answer)
  return /\b(da kiem tra du lieu|đã kiểm tra dữ liệu|ben duoi|bên dưới|checked gympro policies|data below)\b/.test(normalized)
    && String(answer || '').length < 180
}

const splitReadableItems = (value) => {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 5)
  }
  const text = String(value || '').trim()
  if (!text) return []
  const normalized = text
    .replace(/\s*\((\d+)\)\s*/g, '\n- ')
    .replace(/\s*(?:;|；)\s*/g, '\n- ')
    .replace(/\n\s*[-*•]\s*/g, '\n- ')
    .trim()
  const bulletItems = normalized
    .split(/\n\s*-\s+/)
    .map(item => item.replace(/^-\s*/, '').trim())
    .filter(Boolean)
  if (bulletItems.length > 1) return bulletItems.slice(0, 5)
  return normalized
    .split(/(?<=[.!?。])\s+/)
    .map(item => item.replace(/^-\s*/, '').trim())
    .filter(item => item && item.length <= 180)
    .slice(0, 5)
}

const formatReadableAnswer = ({ conclusion, reasons = [], alternativeTitle, alternatives = [], lang = 'vi' }) => {
  const safeConclusion = String(conclusion || '').trim()
  const reasonItems = splitReadableItems(reasons)
  const alternativeItems = splitReadableItems(alternatives).slice(0, 2)
  const blocks = []
  if (safeConclusion) {
    blocks.push(`${lang === 'en' ? 'Conclusion' : 'Kết luận'}: ${safeConclusion}`)
  }
  if (reasonItems.length > 0) {
    blocks.push(`${lang === 'en' ? 'Reasons' : 'Lý do'}:\n${reasonItems.map(item => `- ${item}`).join('\n')}`)
  }
  if (alternativeItems.length > 0) {
    blocks.push(`${alternativeTitle || (lang === 'en' ? 'Alternative options' : 'Lựa chọn thay thế')}:\n${alternativeItems.map(item => `- ${item}`).join('\n')}`)
  }
  return blocks.join('\n\n')
}

const buildEnoughInfoAdviceFallback = ({ query, toolData, language }) => {
  const lang = normalizeLanguage(language)
  const plans = toolData.activePlans || toolData.plans || []
  const planPayload = buildPlanRecommendationPayload(plans, query, lang)
  const recommendedPlan = planPayload?.recommendedPlan || null
  const planName = getPlanName(recommendedPlan, lang)
  const conclusion = lang === 'en'
    ? (planName ? `Choose ${planName}.` : 'Choose the lowest-cost or best price-per-day plan available in GymPro.')
    : (planName ? `Bạn nên chọn ${planName}.` : 'Bạn nên ưu tiên gói rẻ nhất hoặc có giá/ngày tốt nhất trong GymPro.')
  const reason = lang === 'en'
    ? [
        'Your goal and training frequency are already enough for an initial recommendation.',
        'Saving money is the priority, so consistency matters more than PT booking.',
        'A cost-effective plan is enough to maintain regular training.'
      ]
    : [
        'Bạn đã có mục tiêu và tần suất tập rõ ràng nên có thể tư vấn ngay.',
        'Ưu tiên tiết kiệm tiền nên không cần chọn gói quá cao hoặc gắn PT riêng.',
        'Tập đều quan trọng hơn quyền lợi phụ nếu mục tiêu chính là giảm mỡ/khỏe hơn.'
      ]
  const alternatives = lang === 'en'
    ? ['If you want better progress tracking, choose a plan with health/workout tracking.']
    : ['Nếu muốn theo dõi tiến độ tốt hơn, chọn gói có health/workout tracking.']
  const answer = formatReadableAnswer({
    conclusion,
    reasons: reason,
    alternativeTitle: lang === 'en' ? 'Alternative' : 'Lựa chọn thay thế',
    alternatives,
    lang
  })
  return {
    type: recommendedPlan ? 'plan_recommend' : 'text_advice',
    answer,
    conclusion,
    reason,
    recommendedPlan,
    plans: [],
    cards: recommendedPlan ? [recommendedPlan, ...(planPayload?.alternatives || []).slice(0, 2)] : [],
    planPayload: recommendedPlan ? {
      type: 'plan_recommend',
      recommendedPlan,
      alternatives: (planPayload?.alternatives || []).slice(0, 2),
      conclusion,
      reason,
    } : null,
    suggestions: lang === 'en'
      ? ['How should I split 5 workouts per week?', 'Which plan is cheapest per day?', 'How do I track fat loss safely?']
      : ['Tôi nên chia 5 buổi tập thế nào?', 'Gói nào có giá/ngày rẻ nhất?', 'Theo dõi giảm mỡ an toàn ra sao?'],
    data: toolData,
    mode: 'gym',
    provider: 'rule_guard',
    model: 'local',
  }
}

const buildPolicyFallbackAnswer = ({ query, toolData, language }) => {
  const lang = normalizeLanguage(language)
  const normalizedQuery = normalizeForIntent(query)
  const policyKind = hasRefundPolicyIntent(query)
    ? 'refund'
    : hasPrivacyPolicyIntent(query)
      ? 'privacy'
      : hasPaymentPolicyIntent(query)
        ? 'payment'
        : 'general'
  const kindTokens = {
    refund: ['hoan tien', 'refund', 'tra tien', 'lay lai tien', 'doi y', 'doi tra', 'huy goi'],
    privacy: ['bao mat', 'privacy', 'du lieu ca nhan', 'thong tin ca nhan', 'ban du lieu', 'chia se du lieu', 'ben thu ba', 'third party', 'personal data'],
    payment: ['thanh toan', 'payment', 'tra gop', 'chuyen khoan', 'hoa don'],
    general: [],
  }[policyKind]
  const records = [...(toolData.policies || []), ...(toolData.faqs || [])]
  const scored = records.map((item) => {
    const categoryText = normalizeForIntent([
      item.category,
      item.categoryVi,
      item.categoryEn,
      item.type,
      item.policyType,
      item.kind,
    ].filter(Boolean).join(' '))
    const text = normalizeForIntent([
      item.titleVi,
      item.titleEn,
      item.contentVi,
      item.contentEn,
      item.questionVi,
      item.questionEn,
      item.answerVi,
      item.answerEn,
      item.categoryVi,
      item.categoryEn,
    ].filter(Boolean).join(' '))
    let score = 0
    if (policyKind !== 'general') {
      if (policyKind === 'refund' && /\b(refund|hoan tien|doi tra|huy goi)\b/.test(categoryText)) score += 100
      if (policyKind === 'privacy' && /\b(privacy|bao mat|du lieu ca nhan|personal data)\b/.test(categoryText)) score += 100
      if (policyKind === 'payment' && /\b(payment|thanh toan|invoice|hoa don)\b/.test(categoryText)) score += 100
    }
    for (const token of kindTokens) {
      if (text.includes(token)) score += 20
    }
    for (const token of normalizedQuery.split(/\s+/).filter((part) => part.length >= 3)) {
      if (text.includes(token)) score += 1
    }
    if (policyKind !== 'general' && kindTokens.length > 0 && !kindTokens.some((token) => text.includes(token))) {
      score -= 10
    }
    return { item, score }
  }).sort((a, b) => b.score - a.score)
  const best = scored.find((entry) => entry.score > 0)?.item || null
  if (best) {
    const title = lang === 'en' ? (best.titleEn || best.questionEn || best.titleVi || best.questionVi) : (best.titleVi || best.questionVi || best.titleEn || best.questionEn)
    const content = lang === 'en' ? (best.contentEn || best.answerEn || best.contentVi || best.answerVi) : (best.contentVi || best.answerVi || best.contentEn || best.answerEn)
    return {
      answer: `${title ? `${title}: ` : ''}${String(content || '').trim()}`,
      cards: [best],
    }
  }
  return {
    answer: lang === 'en'
      ? (policyKind === 'refund'
        ? 'GymPro data does not currently have a configured refund policy. Please check Policies/FAQ or contact the front desk.'
        : policyKind === 'privacy'
          ? 'GymPro data does not currently record a matching privacy policy.'
          : 'GymPro data does not currently record a matching policy.')
      : (policyKind === 'refund'
        ? 'Hiện GymPro chưa có chính sách hoàn tiền được cấu hình trong dữ liệu. Bạn có thể xem thêm tại mục Chính sách/FAQ hoặc liên hệ lễ tân.'
        : policyKind === 'privacy'
          ? 'Hiện dữ liệu GymPro chưa ghi nhận chính sách bảo mật phù hợp.'
          : 'Hiện dữ liệu GymPro chưa ghi nhận chính sách phù hợp.'),
    cards: [],
  }
}

const getDomainSuggestions = (intent, language = 'vi') => {
  const lang = normalizeLanguage(language)
  const vi = {
    membership: ['Gói nào tiết kiệm nhất?', 'So sánh với gói khác', 'Tôi có nên nâng cấp không?'],
    checkin: ['Tôi nên tập mấy buổi/tuần?', 'Gợi ý lịch tập tuần này', 'Làm sao giữ streak?'],
    pt: ['Đặt lịch PT tối nay', 'PT nào phù hợp tăng cơ?', 'Xem lịch PT tuần này'],
    policyRefund: ['Xem chính sách hoàn tiền', 'Liên hệ lễ tân', 'Chính sách thanh toán thế nào?'],
    policyPrivacy: ['GymPro lưu dữ liệu nào?', 'Xem chính sách bảo mật', 'Tôi có thể yêu cầu xóa dữ liệu không?'],
    policyPayment: ['Có thể thanh toán bằng cách nào?', 'Có xuất hóa đơn không?', 'Có hỗ trợ trả góp không?'],
    shop: ['Whey nào phù hợp tăng cơ?', 'Sản phẩm nào đang bán chạy?', 'Đơn hàng của tôi ở đâu?'],
  }
  const en = {
    membership: ['Which plan is the most economical?', 'Compare with another plan', 'Should I upgrade?'],
    checkin: ['How many sessions per week should I train?', 'Suggest a weekly workout schedule', 'How do I keep my streak?'],
    pt: ['Book a PT tonight', 'Which PT fits muscle gain?', 'Show PT schedule this week'],
    policyRefund: ['View refund policy', 'Contact the front desk', 'What is the payment policy?'],
    policyPrivacy: ['What data does GymPro store?', 'View privacy policy', 'Can I request data deletion?'],
    policyPayment: ['Which payment methods are supported?', 'Can I get an invoice?', 'Is installment payment available?'],
    shop: ['Which whey fits muscle gain?', 'Which products are best-selling?', 'Where is my order?'],
  }
  const set = lang === 'en' ? en : vi
  if (intent === 'checkin_goal' || intent === 'checkin_summary' || intent === 'checkin_info') return set.checkin
  if (intent === 'pt_availability' || intent === 'pt_advice' || intent === 'pt_info' || intent === 'booking_action') return set.pt
  if (intent === 'policy_refund') return set.policyRefund
  if (intent === 'policy_privacy') return set.policyPrivacy
  if (intent === 'policy_payment') return set.policyPayment
  if (intent === 'shop_advice' || intent === 'shop_info') return set.shop
  if (intent === 'membership_advice' || intent === 'membership_info' || intent === 'plan_comparison' || intent === 'cheapest_long_term_plan') return set.membership
  return lang === 'en' ? ['Which plan suits my budget?', 'How many days should I train?'] : ['Gói nào hợp ngân sách của tôi?', 'Tôi nên tập mấy buổi mỗi tuần?']
}

const buildClarificationAnswer = ({ analysis, query, language }) => {
  const lang = normalizeLanguage(language)
  const subject = analysis?.subject || inferUnclearSubject(query)
  const normalized = normalizeForIntent(query)
  const namedVip = /\bvip\b/.test(normalized)
  const subjectText = subject === 'plan' && namedVip
    ? (lang === 'en' ? 'VIP plan' : 'Gói VIP')
    : subject === 'plan'
      ? (lang === 'en' ? 'membership plan' : 'gói tập')
    : subject === 'trainer'
      ? 'PT'
      : subject === 'checkin'
        ? (lang === 'en' ? 'check-ins' : 'check-in')
        : subject === 'booking'
          ? (lang === 'en' ? 'schedule/booking' : 'lịch tập/lịch PT')
          : subject === 'shop'
            ? (lang === 'en' ? 'GymPro shop' : 'shop GymPro')
            : (lang === 'en' ? 'this topic' : 'nội dung này')
  const answer = subject === 'plan' && namedVip
    ? (lang === 'en'
      ? 'What would you like to know about the VIP plan: price, benefits, or comparison with another plan?'
      : 'Bạn muốn xem giá, quyền lợi hay so sánh Gói VIP?')
    : (lang === 'en'
      ? `What would you like to know about ${subjectText}: information, advice, availability, or comparison?`
      : `Bạn muốn hỏi gì về ${subjectText}: xem thông tin, tư vấn, lịch trống hay so sánh?`)

  const pendingEntity = namedVip ? 'VIP' : subject === 'plan' ? 'plan' : ''
  const pendingIntent = subject === 'plan' && namedVip ? 'membership_info' : ''
  const pendingClarification = subject === 'plan' && namedVip
    ? ['price', 'benefits', 'comparison']
    : []

  return {
    type: 'unclear_question',
    answer,
    recommendedPlan: null,
    plans: [],
    cards: [],
    planPayload: null,
    suggestions: subject === 'plan'
      ? (lang === 'en'
        ? ['Show VIP plan price', 'Show VIP benefits', 'Compare VIP with Basic']
        : ['Xem giá Gói VIP', 'Xem quyền lợi Gói VIP', 'So sánh VIP với Cơ Bản'])
      : subject === 'trainer'
        ? getDomainSuggestions('pt_advice', lang)
        : getDomainSuggestions('unknown', lang),
    mode: 'gym',
    provider: 'rule_based',
    model: 'local',
    metadata: {
      intent: 'unclear_question',
      answeredBy: 'clarification_gate',
      classifier: analysis,
      pendingEntity,
      pendingIntent,
      pendingClarification,
    },
  }
}

const buildCheckinGoalAnswer = ({ query, toolData, language }) => {
  const lang = normalizeLanguage(language)
  const target = extractMonthlyCheckinTarget(query) || 12
  const current = Number(toolData.checkinStats?.thisMonth ?? toolData.checkinStats?.last30Days ?? 0)
  const missing = Math.max(0, target - current)
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysLeft = Math.max(1, endOfMonth.getDate() - now.getDate() + 1)
  const weeksLeft = Math.max(daysLeft / 7, 0.25)
  const perWeek = missing > 0 ? Math.ceil((missing / weeksLeft) * 10) / 10 : 0
  const answer = lang === 'en'
    ? formatReadableAnswer({
        conclusion: `You have checked in ${current} time(s) this month. To reach ${target} sessions/month, you still need ${missing} session(s).`,
        reasons: missing > 0
          ? [`There are about ${daysLeft} day(s) left this month.`, `You need around ${perWeek} session(s)/week from now to month-end.`]
          : ['You have already reached the monthly target.', 'Keep a steady rhythm to maintain the streak.'],
        alternativeTitle: 'Pace suggestion',
        lang,
      })
    : formatReadableAnswer({
        conclusion: `Tháng này bạn đã check-in ${current} buổi. Để đạt ${target} buổi/tháng, bạn còn thiếu ${missing} buổi.`,
        reasons: missing > 0
          ? [`Còn khoảng ${daysLeft} ngày đến cuối tháng.`, `Bạn cần trung bình khoảng ${perWeek} buổi/tuần từ giờ đến cuối tháng.`]
          : ['Bạn đã đạt mục tiêu tháng này.', 'Tiếp tục giữ nhịp đều để duy trì streak.'],
        alternativeTitle: 'Gợi ý nhịp tập',
        lang,
      })
  return {
    type: 'checkin_summary',
    answer,
    data: toolData,
    cards: [toolData.checkinStats].filter(Boolean),
    suggestions: getDomainSuggestions('checkin_goal', lang),
    mode: 'gym',
    provider: 'rule_based',
    model: 'local',
  }
}

const buildWorkoutFrequencyAnswer = ({ query, toolData, language }) => {
  const lang = normalizeLanguage(language)
  const frequency = normalizeWeeklyFrequency(query)
  const normalized = normalizeForIntent(query)
  const isDaily = /\btap\s+moi\s+ngay\b/.test(normalized)
  const isSteady = /\btap\s+deu\b/.test(normalized)
  const label = frequency
    ? (lang === 'en' ? `${frequency} sessions/week` : `${frequency} buổi/tuần`)
    : isDaily
      ? (lang === 'en' ? 'daily training' : 'tập mỗi ngày')
      : isSteady
        ? (lang === 'en' ? 'steady training' : 'tập đều')
        : (lang === 'en' ? 'this training frequency' : 'tần suất này')
  const answer = lang === 'en'
    ? [
        `${label} is a fairly solid training frequency.`,
        'If your goal is muscle gain, it can work well when recovery and nutrition are managed.',
        'If you are new, monitor soreness, sleep, and recovery before increasing intensity.',
        '',
        'Are you aiming for muscle gain, fat loss, or endurance?',
      ].join('\n')
    : [
        `Tần suất ${label} khá cao.`,
        'Nếu mục tiêu tăng cơ thì phù hợp.',
        'Nếu mới tập nên theo dõi hồi phục.',
        '',
        'Bạn đang muốn tăng cơ, giảm mỡ hay tăng sức bền?',
      ].join('\n')

  return {
    type: 'workout_advice',
    answer,
    data: toolData,
    cards: [],
    recommendedPlan: null,
    plans: [],
    planPayload: null,
    suggestions: lang === 'en'
      ? ['Muscle gain', 'Fat loss', 'Endurance']
      : ['Tăng cơ', 'Giảm mỡ', 'Tăng sức bền'],
    mode: 'gym',
    provider: 'rule_based',
    model: 'local',
  }
}

const formatAvailabilitySlot = (slot, language = 'vi') => {
  const lang = normalizeLanguage(language)
  const start = slot?.rangeStart ? new Date(slot.rangeStart) : null
  const end = slot?.rangeEnd ? new Date(slot.rangeEnd) : null
  const validStart = start && !Number.isNaN(start.getTime())
  const validEnd = end && !Number.isNaN(end.getTime())
  const time = validStart && validEnd
    ? `${start.toLocaleTimeString(lang === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })}-${end.toLocaleTimeString(lang === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    : (slot?.slot || slot?.time || slot?.label || (lang === 'en' ? 'available' : 'còn trống'))
  return `${slot?.ptName || slot?.name || 'PT'}: ${time}`
}

const buildPtAvailabilityAnswer = ({ toolData, language }) => {
  const lang = normalizeLanguage(language)
  const availability = toolData.ptAvailability || {}
  const pts = availability.availablePTs || toolData.availablePTs || []
  const slots = availability.availableSlots || availability.slots || []
  const hasSlotData = Array.isArray(slots) && slots.length > 0
  const answer = hasSlotData
    ? (lang === 'en'
      ? formatReadableAnswer({
          conclusion: `I found ${pts.length || slots.length} PT option(s) with open time tonight.`,
          reasons: slots.slice(0, 5).map((slot) => formatAvailabilitySlot(slot, lang)),
          alternativeTitle: 'Available slots',
          lang,
        })
      : formatReadableAnswer({
          conclusion: `Mình tìm thấy ${pts.length || slots.length} PT có lịch trống trong khung giờ này.`,
          reasons: slots.slice(0, 5).map((slot) => formatAvailabilitySlot(slot, lang)),
          alternativeTitle: 'Khung giờ trống',
          lang,
        }))
    : (lang === 'en'
      ? 'GymPro does not currently have configured PT availability data for tonight.'
      : 'Hiện GymPro chưa có dữ liệu lịch trống của PT tối nay.')
  return {
    type: 'booking_suggestion',
    answer,
    data: toolData,
    cards: hasSlotData ? pts.slice(0, 8) : [],
    suggestions: getDomainSuggestions('pt_availability', lang),
    mode: 'gym',
    provider: 'rule_based',
    model: 'local',
  }
}

const buildPtAdviceAnswer = ({ query, toolData, language }) => {
  const lang = normalizeLanguage(language)
  const pts = Array.isArray(toolData.availablePTs)
    ? toolData.availablePTs
    : Array.isArray(toolData.pt) ? toolData.pt : []

  if (pts.length === 0) {
    return {
      type: 'pt_advice_no_data',
      answer: lang === 'en'
        ? 'GymPro currently does not have suitable trainer data to recommend. Please contact the front desk or check back after the PT list is updated.'
        : 'Hiện GymPro chưa có dữ liệu huấn luyện viên phù hợp để đề xuất. Bạn có thể liên hệ lễ tân hoặc quay lại sau khi hệ thống cập nhật danh sách PT.',
      cards: [],
      suggestions: getDomainSuggestions('pt_advice', lang),
      mode: 'gym',
    }
  }

  const normalized = normalizeForIntent(query)
  const scored = pts.map((pt) => {
    const text = normalizeForIntent([
      pt.name,
      pt.bio,
      ...(pt.specialties || []),
    ].join(' '))
    let score = Number(pt.rating || 0)
    if (/\b(tang co|muscle)\b/.test(normalized) && /\b(tang co|muscle|strength|hypertrophy)\b/.test(text)) score += 8
    if (/\b(nguoi moi|moi tap|beginner|newbie)\b/.test(normalized) && /\b(nguoi moi|beginner|basic|foundation)\b/.test(text)) score += 8
    if (/\b(ngan sach|budget|gia re|low budget|student|sinh vien)\b/.test(normalized)) score += 2
    return { pt, score }
  }).sort((a, b) => b.score - a.score)

  const recommended = scored.slice(0, 3).map((item) => item.pt)
  return {
    type: 'pt_list',
    answer: lang === 'en'
      ? 'Based on GymPro PT data, these trainers are the closest match. I will not replace this with a membership plan because you asked for PT advice.'
      : 'Dựa trên dữ liệu PT của GymPro, đây là các huấn luyện viên phù hợp nhất. Mình không đề xuất gói tập thay cho PT vì bạn đang hỏi PT cụ thể.',
    cards: recommended,
    suggestions: getDomainSuggestions('pt_advice', lang),
    mode: 'gym',
  }
}

const getPlanName = (plan, language = 'vi') => {
  const lang = normalizeLanguage(language)
  return lang === 'en' ? (plan?.nameEn || plan?.nameVi || '') : (plan?.nameVi || plan?.nameEn || '')
}

const planSearchBlob = (plan) => normalizeForIntent([
  plan?.nameVi,
  plan?.nameEn,
  plan?.descriptionVi,
  plan?.descriptionEn,
  ...(Array.isArray(plan?.featuresVi) ? plan.featuresVi : []),
  ...(Array.isArray(plan?.featuresEn) ? plan.featuresEn : []),
].filter(Boolean).join(' '))

const isMonthlyBudgetAdvice = (normalized = '') => (
  /\b(per month|monthly|month|thang|moi thang|hang thang)\b/.test(normalized)
)

const isVipPlan = (plan) => /\b(vip|platinum|unlimited|all access|full)\b/.test(planSearchBlob(plan))

const isPtPlan = (plan) => /\b(pt|personal trainer|trainer|huan luyen vien|huan luyen ca nhan)\b/.test(planSearchBlob(plan))

const planMonthlyPrice = (plan) => {
  const price = Number(plan?.price || 0)
  const days = Number(plan?.durationDays || 0)
  return days > 0 ? Math.round(price / Math.max(days / 30, 1)) : price
}

const findPtMembershipPlan = (plans = []) => (
  (Array.isArray(plans) ? plans : []).find(isPtPlan) || null
)

const buildPtPlanBudgetAdvicePayload = ({ query, toolData, language }) => {
  const lang = normalizeLanguage(language)
  const plans = toolData.activePlans || toolData.plans || []
  const budget = normalizeVietnameseMoney(query) || toolData.semanticMemory?.budget || null
  const ptPlan = findPtMembershipPlan(plans)
  if (!budget || !ptPlan) return null

  const ptPlanName = getPlanName(ptPlan, lang) || (lang === 'en' ? 'the PT plan' : 'gói PT')
  const ptMonthlyPrice = planMonthlyPrice(ptPlan)
  const overRatio = ptMonthlyPrice > 0 ? Math.round((ptMonthlyPrice / budget) * 10) / 10 : null
  const nonPtPlans = plans.filter((plan) => !isPtPlan(plan))
  const alternative = selectPlanForAdvice(nonPtPlans, query) || nonPtPlans[0] || null
  const alternativeName = getPlanName(alternative, lang)
  const shouldBuyPt = ptMonthlyPrice <= budget

  const conclusion = shouldBuyPt
    ? (lang === 'en'
      ? `With a monthly budget of ${budget.toLocaleString('en-US')} VND, ${ptPlanName} can be considered if you specifically need coaching.`
      : `Với ngân sách ${budget.toLocaleString('vi-VN')}đ/tháng, bạn có thể cân nhắc ${ptPlanName} nếu thật sự cần PT kèm sát.`)
    : (lang === 'en'
      ? `With a monthly budget of ${budget.toLocaleString('en-US')} VND, you should not buy ${ptPlanName} yet.`
      : `Với ngân sách ${budget.toLocaleString('vi-VN')}đ/tháng, bạn chưa nên mua ${ptPlanName}.`)

  const reasons = shouldBuyPt
    ? (lang === 'en'
      ? [
          `The estimated monthly cost is about ${ptMonthlyPrice.toLocaleString('en-US')} VND, within your budget.`,
          'PT is most useful when you need technique correction, accountability, or a personalized plan.',
          'If you only need gym access, a non-PT plan may still be more cost-effective.',
        ]
      : [
          `Chi phí ước tính khoảng ${ptMonthlyPrice.toLocaleString('vi-VN')}đ/tháng, nằm trong ngân sách của bạn.`,
          'PT hữu ích nhất khi bạn cần sửa kỹ thuật, kèm sát hoặc giáo án cá nhân hóa.',
          'Nếu chỉ cần quyền vào phòng tập, gói không PT vẫn có thể tiết kiệm hơn.',
        ])
    : (lang === 'en'
      ? [
          overRatio ? `It is about ${overRatio} times higher than your monthly budget.` : 'It is above your monthly budget.',
          alternativeName ? `Start with ${alternativeName} first if you mainly need gym access or basic progress tracking.` : 'Start with a non-PT plan first if you mainly need gym access.',
          'When your budget is higher or you need technique correction, reconsider PT.',
        ]
      : [
          overRatio ? `Vượt ngân sách khoảng ${overRatio} lần.` : 'Vượt ngân sách theo tháng bạn đã nêu.',
          alternativeName ? `Nếu mới tập, bạn có thể bắt đầu bằng ${alternativeName} để làm quen và theo dõi tiến độ.` : 'Nếu mới tập, bạn có thể bắt đầu bằng gói không PT để làm quen và theo dõi tiến độ.',
          'Khi có ngân sách cao hơn hoặc cần sửa kỹ thuật, hãy cân nhắc PT.',
        ])

  const answer = formatReadableAnswer({
    conclusion,
    reasons,
    alternativeTitle: lang === 'en' ? 'Next step' : 'Gợi ý tiếp theo',
    alternatives: lang === 'en'
      ? ['I can suggest a non-PT training option for your goal.']
      : ['Nếu bạn muốn, tôi có thể gợi ý phương án tập không cần PT theo mục tiêu của bạn.'],
    lang,
  })

  return {
    type: 'text_advice',
    answer,
    conclusion,
    reason: reasons,
    recommendedPlan: null,
    plans: [],
    cards: [],
    planPayload: null,
    suggestions: lang === 'en'
      ? ['Suggest a non-PT plan', 'How should I train without PT?', 'When should I upgrade to PT?']
      : ['Gợi ý gói không PT', 'Tập không cần PT thế nào?', 'Khi nào nên nâng cấp lên PT?'],
    mode: 'gym',
    data: toolData,
    provider: 'rule_guard',
    model: 'local',
  }
}

const extractAdviceFrequency = (normalized = '') => {
  const match = normalized.match(/\b(\d{1,2})\s*(?:buoi|lan|ngay|sessions?)\s*(?:\/|per)?\s*(?:tuan|week)\b/)
    || normalized.match(/\btap\s+(\d{1,2})\s*(?:buoi|lan|ngay)\b/)
  return match ? parseInt(match[1], 10) : null
}

const inferAdviceGoal = (normalized = '') => {
  if (/\btang\s*(co|can)\b/.test(normalized)) return 'muscle_gain'
  if (/\bgiam\s*(mo|can)\b/.test(normalized)) return 'fat_loss'
  return null
}

const scorePlanAdviceFit = ({ plan, query, budget, maxPrice }) => {
  const normalized = normalizeForIntent(query)
  const monthlyBudget = Boolean(budget) && isMonthlyBudgetAdvice(normalized)
  const student = /\b(student|sinh vien)\b/.test(normalized)
  const explicitVip = /\b(vip|platinum|cao cap|premium service|premium benefits|all access|full access)\b/.test(normalized)
  const wantsLongTerm = /\b(lau dai|dai nhat|long term|longest|nhieu ngay|thoi han|commit|on dinh)\b/.test(normalized)
  const wantsBasic = /\b(co ban|basic|phong tap co ban|chi can phong tap|khong can pt|tiet kiem|affordable)\b/.test(normalized)
  const price = Number(plan?.price || 0)
  const days = Number(plan?.durationDays || 0)
  const perDay = days > 0 ? price / days : Number.POSITIVE_INFINITY
  const monthlyCost = days > 0 ? price / Math.max(days / 30, 1) : Number.POSITIVE_INFINITY
  const text = planSearchBlob(plan)
  const featureCount = Math.max(
    Array.isArray(plan?.featuresVi) ? plan.featuresVi.length : 0,
    Array.isArray(plan?.featuresEn) ? plan.featuresEn.length : 0,
  )
  const frequency = extractAdviceFrequency(normalized)
  const goal = inferAdviceGoal(normalized)
  let score = 0

  // 1. budgetFit (highest priority)
  if (budget) {
    const comparableCost = monthlyBudget ? monthlyCost : price
    if (comparableCost <= budget) score += 50
    else score -= Math.min(50, ((comparableCost - budget) / Math.max(budget, 1)) * 50)
    if (monthlyBudget && price > budget) score -= student ? 25 : 10
    if (monthlyBudget && price <= budget) score += 15
  }

  // 2. workoutFrequency
  if (frequency !== null) {
    if (frequency <= 3) {
      if (isVipPlan(plan)) score -= 25
      else if (days > 90) score -= 15
    }
    if (frequency >= 5 && !isVipPlan(plan) && days > 90) score += 10
  }

  // 3. goalFit
  if (goal === 'muscle_gain' && !isVipPlan(plan)) score += 8

  // 4. audienceFit
  if (student) {
    score += 15
    if (isVipPlan(plan) && !explicitVip) score -= 40
    if (days > 120 && !wantsLongTerm) score -= 22
    if (days > 0 && days <= 60) score += 12
    if (/\b(premium|standard|student|sinh vien|pro|nang cao)\b/.test(text) && !isVipPlan(plan)) score += 12
  }

  // 5. commitmentFit
  if (wantsBasic && /\b(basic|co ban|starter|moi|beginner)\b/.test(text)) score += 12
  if (wantsLongTerm) score += Math.min(days / 30, 6)
  if (explicitVip && isVipPlan(plan)) score += 30

  // 6. pricePerDay & benefits (lowest priority)
  score += Math.min(featureCount, 6)
  score -= (price / Math.max(maxPrice, 1)) * 0.5
  score -= Math.max(0, perDay - 5000) / 50000

  return score
}

const selectPlanForAdvice = (plans = [], query = '') => {
  const budget = normalizeVietnameseMoney(query)
  const normalized = normalizeForIntent(query)
  const wantsLongTerm = /\b(lau dai|dai nhat|long term|longest|nhieu ngay|thoi han)\b/.test(normalized)
  const wantsBasic = /\b(co ban|basic|phong tap co ban|chi can phong tap|khong can pt|tiet kiem)\b/.test(normalized)
  const candidates = (Array.isArray(plans) ? plans : [])
    .filter((plan) => Number(plan?.price) > 0 && Number(plan?.durationDays) > 0)
    .filter((plan) => !budget || Number(plan.price) <= budget)
  const pool = candidates.length > 0 ? candidates : (Array.isArray(plans) ? plans : [])
  const recommendationQuery = ADVISORY_QUERY_REGEX.test(normalized)
  const personaOrBudget = Boolean(budget) || /\b(student|sinh vien|budget|ngan sach)\b/.test(normalized)
  if (recommendationQuery && personaOrBudget && pool.length > 0) {
    const maxPrice = Math.max(...pool.map((plan) => Number(plan?.price || 0)), 1)
    return [...pool].sort((a, b) => (
      scorePlanAdviceFit({ plan: b, query, budget, maxPrice }) - scorePlanAdviceFit({ plan: a, query, budget, maxPrice })
    ))[0] || null
  }
  return [...pool].sort((a, b) => {
    const aPerDay = Number(a.price || 0) / Math.max(1, Number(a.durationDays || 1))
    const bPerDay = Number(b.price || 0) / Math.max(1, Number(b.durationDays || 1))
    if (wantsLongTerm && Number(b.durationDays || 0) !== Number(a.durationDays || 0)) return Number(b.durationDays || 0) - Number(a.durationDays || 0)
    if (Math.abs(aPerDay - bPerDay) > 1) return aPerDay - bPerDay
    if (wantsBasic && Number(a.price || 0) !== Number(b.price || 0)) return Number(a.price || 0) - Number(b.price || 0)
    return Number(a.price || 0) - Number(b.price || 0)
  })[0] || null
}

const buildMembershipAdvicePayload = ({ query, toolData, language }) => {
  const lang = normalizeLanguage(language)
  const plans = toolData.activePlans || toolData.plans || []
  const recommendedPlan = selectPlanForAdvice(plans, query) || buildPlanRecommendationPayload(plans, query, lang)?.recommendedPlan || null
  const alternatives = (plans || []).filter((plan) => recommendedPlan && !idsEqual(plan._id, recommendedPlan._id)).slice(0, 2)
  const planName = getPlanName(recommendedPlan, lang)
  const budget = normalizeVietnameseMoney(query)
  const frequency = normalizeWeeklyFrequency(query)
  const normalized = normalizeForIntent(query)
  const asksWhyNotVip = /\b(tai sao|vi sao|why)\b/.test(normalized) && /\b(khong nen mua vip|khong mua vip|not buy vip|vip)\b/.test(normalized)
  const wantsLongTerm = /\b(lau dai|dai nhat|long term|longest|thoi han)\b/.test(normalized)
  const wantsBasic = /\b(co ban|basic|chi can phong tap|phong tap co ban)\b/.test(normalized)
  const noPt = /\b(khong can pt|khong can huan luyen vien|no pt)\b/.test(normalized)
  const student = /\b(student|sinh vien)\b/.test(normalized)
  const monthlyBudget = Boolean(budget) && isMonthlyBudgetAdvice(normalized)
  const vipPlan = (plans || []).find((plan) => normalizeForIntent(`${plan.nameVi || ''} ${plan.nameEn || ''}`).includes('vip'))
  const conclusion = lang === 'en'
    ? (asksWhyNotVip
      ? `You should not buy VIP right now${planName ? `; ${planName} fits better.` : '.'}`
      : (planName ? `Choose ${planName}.` : 'Choose the most cost-effective plan within your budget.'))
    : (asksWhyNotVip
      ? `Bạn không nên mua VIP lúc này${planName ? `; ${planName} phù hợp hơn.` : '.'}`
      : (planName ? `Bạn nên chọn ${planName}.` : 'Bạn nên chọn gói tiết kiệm nhất trong ngân sách.'))
  const reasons = []
  if (budget) reasons.push(lang === 'en'
    ? `Your ${monthlyBudget ? 'monthly ' : ''}budget is ${budget.toLocaleString('en-US')} VND, so the plan should fit that limit without relying only on price per day.`
    : `Ngân sách ${monthlyBudget ? 'theo tháng ' : ''}của bạn là ${budget.toLocaleString('vi-VN')}đ, nên ưu tiên gói phù hợp mức này thay vì chỉ nhìn giá theo ngày.`)
  if (student) reasons.push(lang === 'en'
    ? 'For a student, accessibility and upfront commitment matter alongside benefits and cost.'
    : 'Với sinh viên, độ dễ tiếp cận và chi phí trả trước quan trọng ngang với quyền lợi và tổng chi phí.')
  if (student && monthlyBudget && recommendedPlan && !isVipPlan(recommendedPlan) && vipPlan) reasons.push(lang === 'en'
    ? 'VIP may look cheaper per day, but it requires a longer upfront commitment, so it is not the first fit here.'
    : 'VIP có thể rẻ hơn theo ngày, nhưng cần cam kết/trả trước dài hơn nên chưa phải lựa chọn đầu tiên ở trường hợp này.')
  if (wantsLongTerm && recommendedPlan) reasons.push(lang === 'en'
    ? `This option gives a good duration/price balance for long-term training.`
    : `Gói này có thời hạn/giá ngày phù hợp hơn cho nhu cầu tập lâu dài.`)
  if (wantsBasic) reasons.push(lang === 'en'
    ? 'You only need basic gym access, so premium benefits are not the priority.'
    : 'Bạn chỉ cần phòng tập cơ bản nên chưa cần quyền lợi cao cấp.')
  if (frequency) reasons.push(lang === 'en'
    ? `${frequency} sessions/week does not require an expensive premium plan at the start.`
    : `Tập ${frequency} buổi/tuần chưa cần gói quá cao ở giai đoạn này.`)
  if (noPt) reasons.push(lang === 'en'
    ? 'You do not need PT, so avoid paying extra for PT-oriented benefits.'
    : 'Bạn không cần PT nên không nên trả thêm cho quyền lợi thiên về PT.')
  if (asksWhyNotVip && vipPlan && budget && Number(vipPlan.price || 0) > budget) {
    reasons.push(lang === 'en'
      ? `VIP is above your stated budget.`
      : `VIP cao hơn ngân sách bạn đã nêu.`)
  }
  if (reasons.length === 0) {
    reasons.push(lang === 'en'
      ? 'The recommendation is based on active GymPro plan data and your stated needs.'
      : 'Đề xuất dựa trên dữ liệu gói đang hoạt động của GymPro và nhu cầu bạn đã nêu.')
  }
  const answer = formatReadableAnswer({
    conclusion,
    reasons: reasons.slice(0, 4),
    alternativeTitle: lang === 'en' ? 'Alternative options' : 'Lựa chọn thay thế',
    alternatives: alternatives.slice(0, 2).map((plan) => lang === 'en'
      ? `${getPlanName(plan, lang)} if you want another price/duration option.`
      : `${getPlanName(plan, lang)} nếu bạn muốn phương án giá/thời hạn khác.`),
    lang,
  })
  return {
    type: recommendedPlan ? 'plan_recommend' : 'text_advice',
    answer,
    conclusion,
    reason: reasons.slice(0, 4),
    recommendedPlan,
    plans: [],
    cards: recommendedPlan ? [recommendedPlan, ...alternatives.slice(0, 2)] : [],
    planPayload: recommendedPlan ? {
      type: 'plan_recommend',
      recommendedPlan,
      conclusion,
      reason: reasons.slice(0, 4),
      alternatives: alternatives.slice(0, 2),
    } : null,
    suggestions: getDomainSuggestions('membership_advice', lang),
    mode: 'gym',
    data: toolData,
    provider: 'rule_based',
    model: 'local',
  }
}

const buildCheapestLongTermAnswer = ({ query, plans, language }) => {
  const lang = normalizeLanguage(language)
  const normalized = normalizeForIntent(query)
  const monthMatch = normalized.match(/(\d+)\s*(thang|nam|month|year)/)
  const months = monthMatch
    ? (monthMatch[2] === 'nam' || monthMatch[2] === 'year' ? parseInt(monthMatch[1], 10) * 12 : parseInt(monthMatch[1], 10))
    : 6

  const activePlans = (Array.isArray(plans) ? plans : []).filter(p => Number(p.price) > 0 && Number(p.durationDays) > 0)

  const scored = activePlans.map(plan => {
    const price = Number(plan.price)
    const days = Number(plan.durationDays)
    const cycles = Math.ceil((months * 30) / days)
    const totalCost = cycles * price
    const planName = getPlanName(plan, lang)
    return { plan, totalCost, cycles, planName, price, days }
  }).sort((a, b) => {
    if (a.totalCost !== b.totalCost) return a.totalCost - b.totalCost
    return a.price - b.price
  })

  if (scored.length === 0) {
    return {
      type: 'text_advice',
      answer: lang === 'en'
        ? 'There are no active plans to compare for a long-term commitment.'
        : 'Hiện chưa có gói tập nào để so sánh cho nhu cầu dài hạn.',
      recommendedPlan: null,
      plans: [],
      cards: [],
      planPayload: null,
      suggestions: lang === 'en'
        ? ['View all plans', 'Which plan is best for me?']
        : ['Xem tất cả gói', 'Gói nào phù hợp nhất với tôi?'],
      mode: 'gym',
      provider: 'rule_based',
      model: 'local',
      metadata: { intent: 'cheapest_long_term_plan', answeredBy: 'rule', route: 'DIRECT_CHEAPEST_LONG_TERM' },
    }
  }

  const best = scored[0]
  const alternatives = scored.slice(1, 3)
  const periodText = lang === 'en'
    ? `${months} month${months > 1 ? 's' : ''}`
    : `${months} tháng`

  const lines = scored.slice(0, 4).map((s, i) => {
    const costFormatted = s.totalCost.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')
    const perMonth = Math.round(s.totalCost / months).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')
    const priceText = lang === 'en'
      ? `${s.planName}: ~${costFormatted}₫ total (~${perMonth}₫/tháng) for ${s.cycles} cycle(s)`
      : `${s.planName}: ~${costFormatted}₫ tổng (~${perMonth}₫/tháng) trong ${s.cycles} kỳ`
    return i === 0 ? `⭐ **${priceText}**` : `   ${priceText}`
  })

  const answer = lang === 'en'
    ? `For ${periodText}, here are the most cost-effective options:\n${lines.join('\n')}`
    : `Với ${periodText}, đây là các phương án tiết kiệm nhất:\n${lines.join('\n')}`

  const reason = lang === 'en'
    ? [`${best.planName} costs ~${best.totalCost.toLocaleString('en-US')}₫ total over ${periodText}, cheapest option.`]
    : [`${best.planName} có tổng chi phí ~${best.totalCost.toLocaleString('vi-VN')}₫ trong ${periodText}, là phương án rẻ nhất.`]

  return {
    type: 'plan_recommend',
    answer,
    conclusion: lang === 'en'
      ? `Choose ${best.planName} for the cheapest long-term plan.`
      : `Chọn ${best.planName} để tiết kiệm nhất khi tập ${periodText}.`,
    reason,
    recommendedPlan: best.plan,
    plans: [],
    cards: [best.plan, ...alternatives.map(a => a.plan)],
    planPayload: {
      type: 'plan_recommend',
      recommendedPlan: best.plan,
      conclusion: lang === 'en'
        ? `Choose ${best.planName} for the cheapest long-term plan.`
        : `Chọn ${best.planName} để tiết kiệm nhất khi tập ${periodText}.`,
      reason,
      alternatives: alternatives.map(a => a.plan),
    },
    suggestions: lang === 'en'
      ? ['Register for this plan', 'Compare with another plan', 'Is this right for my goal?']
      : ['Đăng ký gói này', 'So sánh với gói khác', 'Gói này có hợp mục tiêu không?'],
    mode: 'gym',
    provider: 'rule_based',
    model: 'local',
    metadata: { intent: 'cheapest_long_term_plan', answeredBy: 'rule', route: 'DIRECT_CHEAPEST_LONG_TERM' },
  }
}

const summarizeToolDataForLog = (toolData = {}) => ({
  activePlans: Array.isArray(toolData.activePlans || toolData.plans) ? (toolData.activePlans || toolData.plans).length : 0,
  currentMembership: Boolean(toolData.currentMembership?.found || toolData.membership?.found),
  checkins: toolData.checkinStats ? {
    thisMonth: toolData.checkinStats.thisMonth,
    last30Days: toolData.checkinStats.last30Days,
    streak: toolData.streak,
  } : null,
  availablePTs: Array.isArray(toolData.ptAvailability?.availablePTs || toolData.availablePTs) ? (toolData.ptAvailability?.availablePTs || toolData.availablePTs).length : 0,
  upcomingBookings: Array.isArray(toolData.upcomingBookings) ? toolData.upcomingBookings.length : 0,
  policies: Array.isArray(toolData.policies) ? toolData.policies.length : 0,
  faqs: Array.isArray(toolData.faqs) ? toolData.faqs.length : 0,
  products: Array.isArray(toolData.products) ? toolData.products.length : 0,
})

const shouldUseAiReasoning = (query = '') => {
  const normalized = normalizeForIntent(query)
  return /\b(nen|nên|co nen|có nên|phu hop|phù hợp|dang tien|đáng tiền|tu van|tư vấn|tiet kiem|tiết kiệm|sinh vien|ngan sach|budget|giam|giảm|tang|tăng|muc tieu|mục tiêu|khong can pt|không cần pt|toi la|tôi là|tap .*buoi\/tuan|buoi\/tuan)\b/.test(normalized)
    || Boolean(normalizeVietnameseMoney(query))
    || Boolean(normalizeWeeklyFrequency(query))
}

const detectDbDirectIntent = (query = '') => {
  if (hasPtAdviceIntent(query)) return 'pt_advice'
  if (shouldUseAiReasoning(query)) return null
  const normalized = normalizeForIntent(query)
  if (hasPrivacyPolicyIntent(query)) return 'policy_privacy'
  if (hasRefundPolicyIntent(query)) return 'policy_refund'
  if (hasPaymentPolicyIntent(query)) return 'policy_payment'
  if (hasPtAvailabilityIntent(query)) return 'pt_availability'
  if (hasCheckinGoalIntent(query)) return 'checkin_goal'
  if (/\b(thang nay|this month|bao nhieu buoi|di tap bao nhieu|checkin|check in|diem danh)\b/.test(normalized)) return 'checkin_summary'
  if (/\b(con han|het han|bao lau|days left|membership status|goi con han)\b/.test(normalized)) return 'membership_info'
  if (hasBookingInfoIntent(query) || /\b(lich sap toi|lich cua toi|upcoming booking|my schedule)\b/.test(normalized)) return 'booking_info'
  if (asksPlanBenefitQuestion(query) || /\b(gia goi|gia cua goi|chi tiet goi|gói vip|goi vip|gói cơ bản|goi co ban|vip)\b/.test(normalized)) return 'membership_info'
  if (/\b(xem cac goi|danh sach goi|cac goi tap|goi tap|plans|membership plans)\b/.test(normalized)) return 'plan_list'
  if (/\b(faq|cau hoi thuong gap|chinh sach|quy dinh)\b/.test(normalized)) return 'faq_answer'
  return null
}

const buildPlanInfoDirectAnswer = ({ query, plans, language }) => {
  const lang = normalizeLanguage(language)
  const normalized = normalizeForIntent(query)
  const isGeneralBenefitQuery = /\b(co .* khong)\b/.test(normalized) && !/\b(goi|vip|premium|basic|co ban|nang cao|plan|membership)\b/.test(normalized)
  if (isGeneralBenefitQuery) {
    return {
      type: 'text_advice',
      answer: lang === 'en'
        ? 'Please specify which plan you want to check: VIP, Premium, or Basic?'
        : 'Bạn muốn kiểm tra quyền lợi của gói nào: VIP, Premium hay Cơ Bản?',
      recommendedPlan: null,
      plans: [],
      cards: [],
      planPayload: null,
      suggestions: getDomainSuggestions('membership_info', lang),
    }
  }
  const mentionedPlan = findPlanMentionedInQuery(plans, query)
  if (mentionedPlan) {
    const planName = getPlanName(mentionedPlan, lang)
    if (asksPlanBenefitQuestion(query)) {
      const normalized = normalizeForIntent(query)
      const features = lang === 'en' ? (mentionedPlan.featuresEn || mentionedPlan.featuresVi || []) : (mentionedPlan.featuresVi || mentionedPlan.featuresEn || [])
      const featureText = normalizeForIntent(features.join(' '))
      const askedBenefit = extractAskedPlanBenefit(query, lang)
      const asksPool = /\b(ho boi|hồ bơi|pool|xong hoi|xông hơi|sauna)\b/.test(normalized)
      if (asksPool) {
        const hasPoolBenefit = /\b(ho boi|pool|xong hoi|sauna)\b/.test(featureText)
        return {
          type: 'text_advice',
          answer: hasPoolBenefit
            ? (lang === 'en'
              ? `Yes. GymPro data records a pool/sauna-related benefit for ${planName}.`
              : `Có. Dữ liệu GymPro ghi nhận quyền lợi hồ bơi/xông hơi trong ${planName}.`)
            : (lang === 'en'
              ? `GymPro data does not currently record a pool benefit for ${planName}.`
              : `Hiện dữ liệu GymPro chưa ghi nhận hồ bơi trong quyền lợi ${planName}.`),
          recommendedPlan: null,
          plans: [],
          cards: [],
          suggestions: getDomainSuggestions('membership_info', lang),
        }
      }
      const hasAskedBenefit = askedBenefit !== (lang === 'en' ? 'that benefit' : 'quyền lợi đó')
        && featureText.includes(normalizeForIntent(askedBenefit))
      return {
        type: 'text_advice',
        answer: hasAskedBenefit
          ? (lang === 'en'
            ? `Yes. GymPro data records ${askedBenefit} in ${planName}.`
            : `Có. Dữ liệu GymPro ghi nhận ${askedBenefit} trong quyền lợi ${planName}.`)
          : askedBenefit
            ? (lang === 'en'
              ? `GymPro data does not currently record ${askedBenefit} in ${planName}.`
              : `Hiện dữ liệu GymPro chưa ghi nhận ${askedBenefit} trong quyền lợi ${planName}.`)
            : features.length
          ? (lang === 'en'
            ? `${planName} currently records these benefits: ${features.slice(0, 6).join(', ')}.`
            : `${planName} hiện ghi nhận các quyền lợi: ${features.slice(0, 6).join(', ')}.`)
          : (lang === 'en'
            ? `GymPro data does not currently record detailed benefits for ${planName}.`
            : `Hiện dữ liệu GymPro chưa ghi nhận quyền lợi chi tiết cho ${planName}.`),
        recommendedPlan: null,
        plans: [],
        cards: [],
        suggestions: getDomainSuggestions('membership_info', lang),
      }
    }
    return {
      type: 'plan_detail',
      answer: '',
      recommendedPlan: null,
      plans: [],
      cards: [mentionedPlan],
      planPayload: { type: 'plan_detail', plan: mentionedPlan },
      suggestions: getDomainSuggestions('membership_info', lang),
    }
  }
  if (asksPlanBenefitQuestion(query)) {
    return {
      type: 'text_advice',
      answer: lang === 'en'
        ? 'Please specify which plan to check: VIP, Premium, or Basic?'
        : 'Bạn muốn kiểm tra quyền lợi của gói nào: VIP, Premium hay Cơ Bản?',
      recommendedPlan: null,
      plans: [],
      cards: [],
      planPayload: null,
      suggestions: getDomainSuggestions('membership_info', lang),
    }
  }
  return {
    type: 'plan_list',
    answer: lang === 'en' ? 'Here are the active GymPro membership plans.' : 'Đây là các gói tập đang hoạt động của GymPro.',
    recommendedPlan: null,
    plans,
    cards: plans,
    planPayload: { type: 'plan_list', plans },
    suggestions: getDomainSuggestions('membership_info', lang),
  }
}

const runDbDirectFastPath = async ({ intent, query, user, baseToolData, language, cacheContext }) => {
  const lang = normalizeLanguage(language)
  const memberId = toObjectIdOrNull(user?._id)
  let toolData = baseToolData || {}
  if (intent === 'plan_list' || intent === 'membership_info') {
    const plans = await getContextCached(cacheContext, 'activePlans', 5 * 60, () => getActivePlans(12), '12')
    toolData = mergeToolData(toolData, { activePlans: plans })
    if (intent === 'plan_list' || asksPlanBenefitQuestion(query) || /vip|goi|gói|plan/i.test(query)) {
      const payload = buildPlanInfoDirectAnswer({ query, plans, language: lang })
      return { ...payload, data: toolData, mode: 'gym', provider: 'db_direct', model: 'local', metadata: { route: 'DB_DIRECT', intent } }
    }
    if (memberId) {
      const membership = await getContextCached(cacheContext, 'currentMembership', 60, () => getLatestMembership(memberId).then(serializeMembership))
      const localizedMembership = localizeMembership(membership, lang)
      toolData = mergeToolData(toolData, { currentMembership: membership })
      return {
        type: 'text_advice',
        answer: localizedMembership.found
          ? (lang === 'en' ? `Your current membership is ${localizedMembership.planName}, status ${localizedMembership.status}, with ${localizedMembership.remainingDays} day(s) left.` : `Gói hiện tại của bạn là ${localizedMembership.planName}, trạng thái ${localizedMembership.status}, còn ${localizedMembership.remainingDays} ngày.`)
          : (lang === 'en' ? 'GymPro does not currently record an active membership for you.' : 'Hiện GymPro chưa ghi nhận gói tập còn hiệu lực của bạn.'),
        data: toolData,
        cards: [],
        suggestions: getDomainSuggestions('membership_info', lang),
        mode: 'gym',
        provider: 'db_direct',
        model: 'local',
        metadata: { route: 'DB_DIRECT', intent },
      }
    }
  }
  if (intent === 'checkin_summary' || intent === 'checkin_goal') {
    const checkin = memberId
      ? await getContextCached(cacheContext, 'checkinStats', 60, () => getCheckinContext(memberId))
      : { checkinStats: { thisMonth: 0, last30Days: 0 }, latestCheckins: [], streak: 0 }
    toolData = mergeToolData(toolData, { checkin })
    const payload = intent === 'checkin_goal'
      ? buildCheckinGoalAnswer({ query, toolData, language: lang })
      : {
          type: 'checkin_summary',
          answer: lang === 'en'
            ? `This month you have checked in ${toolData.checkinStats?.thisMonth ?? toolData.checkinStats?.last30Days ?? 0} time(s).`
            : `Tháng này bạn đã check-in ${toolData.checkinStats?.thisMonth ?? toolData.checkinStats?.last30Days ?? 0} buổi.`,
          data: toolData,
          cards: [toolData.checkinStats].filter(Boolean),
          suggestions: getDomainSuggestions('checkin_summary', lang),
          mode: 'gym',
          provider: 'db_direct',
          model: 'local',
        }
    return { ...payload, provider: 'db_direct', model: 'local', metadata: { route: 'DB_DIRECT', intent } }
  }
  if (intent === 'booking_info') {
    const booking = await getContextCached(cacheContext, 'upcomingBookings', 30, () => getBookingContext(user, query, cacheContext))
    toolData = mergeToolData(toolData, { booking })
    return {
      type: 'booking_list',
      answer: lang === 'en' ? `You have ${(toolData.upcomingBookings || []).length} upcoming booking(s).` : `Bạn đang có ${(toolData.upcomingBookings || []).length} lịch sắp tới.`,
      data: toolData,
      cards: toolData.upcomingBookings || [],
      suggestions: getDomainSuggestions('booking_action', lang),
      mode: 'gym',
      provider: 'db_direct',
      model: 'local',
      metadata: { route: 'DB_DIRECT', intent },
    }
  }
  if (intent === 'pt_availability') {
    const ptAvailability = await getContextCached(cacheContext, 'ptAvailability', 20, () => getPTAvailability(query, 8, cacheContext), normalizeTimeRange(query).label)
    toolData = mergeToolData(toolData, { ptAvailability })
    return { ...buildPtAvailabilityAnswer({ toolData, language: lang }), provider: 'db_direct', model: 'local', metadata: { route: 'DB_DIRECT', intent } }
  }
  if (intent === 'pt_advice' || intent === 'pt_info') {
    const pt = await getContextCached(cacheContext, 'ptList', 5 * 60, () => getPTList(8), '8')
    toolData = mergeToolData(toolData, { pt })
    return { ...buildPtAdviceAnswer({ query, toolData, language: lang }), data: toolData, provider: 'db_direct', model: 'local', metadata: { route: 'DB_DIRECT', intent } }
  }
  if (intent === 'policy_refund' || intent === 'policy_privacy' || intent === 'policy_payment' || intent === 'faq_answer') {
    const [policies, faqs] = await Promise.all([
      getContextCached(cacheContext, 'policies', 10 * 60, () => getPolicies(30), '30'),
      getContextCached(cacheContext, 'faqs', 10 * 60, () => getFaqs(30), '30'),
    ])
    toolData = mergeToolData(toolData, { policies, faqs })
    const policyFallback = buildPolicyFallbackAnswer({ query, toolData, language: lang })
    return {
      type: 'policy_answer',
      answer: policyFallback.answer,
      data: toolData,
      cards: policyFallback.cards,
      suggestions: getDomainSuggestions(intent, lang),
      mode: 'gym',
      provider: 'db_direct',
      model: 'local',
      metadata: { route: 'DB_DIRECT', intent },
    }
  }
  return null
}

const preloadReasoningContext = async ({ user, query, cacheContext }) => {
  const memberId = toObjectIdOrNull(user?._id)
  if (!memberId) return {}
  const normalized = normalizeForIntent(query)
  const basePromises = [
    getContextCached(cacheContext, 'activePlans', 5 * 60, () => getActivePlans(12), '12'),
    getContextCached(cacheContext, 'currentMembership', 60, () => getLatestMembership(memberId).then(serializeMembership)),
    getContextCached(cacheContext, 'checkinStats', 60, () => getCheckinContext(memberId)),
    getContextCached(cacheContext, 'upcomingBookings', 30, () => getBookingContext(user, query, cacheContext)),
  ]
  const [activePlans, currentMembership, checkin, booking] = await Promise.all(basePromises)
  const extra = {}
  if (hasPtAdviceIntent(query)) {
    extra.pt = await getContextCached(cacheContext, 'ptList', 5 * 60, () => getPTList(8), '8')
  }
  if (hasPtAvailabilityIntent(query) || hasBookingActionIntent(query)) {
    extra.ptAvailability = await getContextCached(cacheContext, 'ptAvailability', 20, () => getPTAvailability(query, 8, cacheContext), normalizeTimeRange(query).label)
  }
  if (hasShopIntent(query)) {
    extra.products = await getContextCached(cacheContext, 'products', 5 * 60, () => getProducts(8), '8')
  }
  if (hasRefundPolicyIntent(query) || hasPrivacyPolicyIntent(query) || hasPaymentPolicyIntent(query) || /\b(chinh sach|faq|quy dinh|policy|terms)\b/.test(normalized)) {
    const [policies, faqs] = await Promise.all([
      getContextCached(cacheContext, 'policies', 10 * 60, () => getPolicies(30), '30'),
      getContextCached(cacheContext, 'faqs', 10 * 60, () => getFaqs(30), '30'),
    ])
    extra.policies = policies
    extra.faqs = faqs
  }
  if (hasRole(user, ADMIN_ROLES) && /\b(doanh thu|bao cao|dashboard|thong ke|report|revenue)\b/.test(normalized)) {
    extra.admin = await getDashboardStats()
  }
  if (hasSeriousMedicalSignal(query) || /\b(bmi|suc khoe|health|can nang|weight|body fat|mo co the)\b/.test(normalized)) {
    extra.health = await getHealthContext(memberId)
  }
  if (hasHealthOrWorkoutContext(query) || /\b(workout|bai tap|lo trinh|lộ trình|tap gi|tập gì)\b/.test(normalized)) {
    extra.workout = await getWorkoutContext(memberId)
  }
  return mergeToolData({ activePlans, currentMembership, checkin, booking }, extra)
}

// 2. Classifier system prompts & runners
const buildClassifierSystemPrompt = () => {
  return `Bạn là AI Intent Classifier toàn hệ thống cho GymPro.
Nhiệm vụ:
- Hiểu ý định thật sự của user.
- Không phân loại bằng từ khóa đơn lẻ.
- Dựa trên toàn bộ câu, lịch sử hội thoại, role/permissions và context summary backend cung cấp.
- Chỉ trả JSON hợp lệ.
- Không giải thích ngoài JSON.

Quy tắc:
- Nếu user hỏi "PT nào", "huấn luyện viên nào", "which trainer/PT" phù hợp/gợi ý/recommend cho mục tiêu, người mới, tăng cơ, ngân sách thấp => pt_advice, tools ["pts"]. KHÔNG trả plan_recommend và KHÔNG đề xuất gói tập thay cho PT.
- Nếu user nói ngân sách, mới tập, sinh viên, muốn khỏe hơn, tăng cơ, giảm cân, tập mấy buổi/tuần, không cần PT, muốn tập lâu dài, phòng tập cơ bản mà KHÔNG hỏi PT cụ thể => membership_advice hoặc plan_comparison, KHÔNG phải shop/schedule.
- Nếu câu quá ngắn/không rõ như "VIP?", "PT?", "Gói?", "Checkin?" => intent unclear_question, action unclear, shouldAskClarify=true, shouldRenderCard=false.
- Chỉ schedule_info khi user hỏi rõ về lịch đã đặt/sắp tới như: "lịch của tôi", "hôm nay có lịch không", "tuần này có lịch không".
- Chỉ booking_action khi user muốn đặt/hủy/đổi lịch.
- "Tối nay PT nào còn lịch trống?" => pt_availability, tools ["pts", "ptAvailability"].
- "Tôi có lịch PT nào tối nay không?" => booking_info, tools ["bookings"].
- "Nếu tôi muốn đạt 12 buổi/tháng thì còn thiếu bao nhiêu buổi nữa?" => checkin_goal, tools ["checkins"].
- "Tôi đau lưng", "BMI của tôi", "khó thở", "chóng mặt" => health_advice hoặc health_info; nếu nghiêm trọng cần safety.
- "Tôi muốn mua whey", "sản phẩm tăng cơ", "shop", "đồ tập", "mua hàng" => shop_advice/shop_info. Không map câu tư vấn gói có chữ "mua VIP" sang shop.
- "hoàn tiền/refund/mai đổi ý/không tập nữa có lấy lại tiền không" => policy_refund. "bảo mật/privacy" => policy_privacy. "thanh toán/payment" => policy_payment. FAQ khác => faq_answer.
- "Doanh thu tháng này", "member sắp hết hạn" => admin_report chỉ khi role admin.
- "Đổi giao diện sang màu xanh" => theme_action nếu user có quyền theme.
- Nếu user hỏi có nên chọn/nâng cấp/đáng tiền/phù hợp không => needsAIReasoning=true.
- Nếu user hỏi dữ liệu rõ như xem danh sách, lịch của tôi, số lần checkin, đơn hàng, thông báo, chính sách => needsAIReasoning=false, needsDatabase=true.
- Nếu câu hỏi tiếp nối như "Vậy tôi nên chọn gói nào?" thì dùng recentConversation để giữ bối cảnh trước đó.
- Nếu user hỏi quyền lợi không có trong activePlans/currentMembership thì intent vẫn là membership_info và AI phải nói chưa ghi nhận dữ liệu đó, không tự chuyển sang membership_advice.

JSON Output structure:
{
  "subject": "plan | trainer | booking | workout | checkin | policy | shop | health | account | general",
  "action": "info | advice | compare | personal_data | availability | create | update | cancel | policy_lookup | unclear",
  "intent": "membership_info | membership_advice | plan_comparison | checkin_summary | checkin_goal | pt_info | pt_advice | pt_availability | booking_info | booking_action | policy_refund | policy_privacy | policy_payment | policy_terms | faq_answer | shop_advice | shop_info | health_advice | workout_advice | general_chat | unclear_question | unknown",
  "confidence": 0.0,
  "shouldAskClarify": false,
  "shouldRenderCard": false,
  "language": "vi | en",
  "needsAIReasoning": true,
  "needsDatabase": true,
  "tools": ["plans", "membership", "checkins", "pts", "ptAvailability", "bookings", "workout", "health", "products", "cart", "orders", "notifications", "faqs", "policies", "feedback", "reports", "members"],
  "reason": "ngắn gọn lý do phân loại",
  "entities": {
    "budget": number | null,
    "goal": string | null,
    "frequencyPerWeek": number | null,
    "mentionedPlanNames": string[],
    "mentionedPTNames": string[],
    "mentionedProductNames": string[],
    "timeRange": string | null,
    "action": string | null,
    "needsPT": boolean | null
  }
}`
}

const buildClassifierContextPrompt = ({ query, recentConversation, semanticMemory, toolData, language }) => {
  return `User Message: "${query}"
Language: "${language}"
Recent Conversation history (last 5 messages only, semantic context only):
${recentConversation ? JSON.stringify(compactRecentConversation(recentConversation, 5)).slice(0, 1600) : 'None'}

Semantic Conversation Memory:
${JSON.stringify(semanticMemory || {}, null, 2).slice(0, 1600)}

Important:
- Use semantic memory only to understand follow-up meaning.
- Do not copy or infer answer language from previous messages. Language is only the current User Message language above.
- If current message is supplemental information and last subject/intent was plan advice, classify it as continuing plan advice with the new entities.

Backend Context available before classification:
${JSON.stringify({
  userMessage: query,
  role: toolData?.role || 'member',
  userId: toolData?.userId || '',
  permissions: toolData?.permissions || {},
  normalized: toolData?.normalized || {},
  language,
}, null, 2).slice(0, 6000)}

Return exactly one valid JSON object:`
}

const runAiClassifier = async ({ query, recentConversation, semanticMemory, toolData, language }) => {
  const systemPrompt = buildClassifierSystemPrompt()
  const context = buildClassifierContextPrompt({ query, recentConversation, semanticMemory, toolData, language })
  
  try {
    const result = await runAIWithFallback({
      systemPrompt,
      context,
      userQuestion: query,
      language,
    }, {
      temperature: 0.1,
      maxTokens: 900,
    })
    
    const parsed = parseAiJsonPayload(result.text, '')
    return {
      subject: parsed.subject || 'general',
      action: parsed.action || 'unclear',
      intent: parsed.intent || 'unknown',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      shouldAskClarify: Boolean(parsed.shouldAskClarify),
      shouldRenderCard: Boolean(parsed.shouldRenderCard),
      language: parsed.language === 'en' ? 'en' : normalizeLanguage(language),
      needsAIReasoning: typeof parsed.needsAIReasoning === 'boolean' ? parsed.needsAIReasoning : true,
      needsDatabase: typeof parsed.needsDatabase === 'boolean' ? parsed.needsDatabase : true,
      tools: sanitizeClassifierTools(parsed.tools),
      reason: parsed.reason || '',
      entities: {
        budget: typeof parsed.entities?.budget === 'number' ? parsed.entities.budget : null,
        budgetPeriod: parsed.entities?.budgetPeriod || 'unknown',
        goal: parsed.entities?.goal || null,
        frequencyPerWeek: typeof parsed.entities?.frequencyPerWeek === 'number' ? parsed.entities.frequencyPerWeek : null,
        mentionedPlanNames: Array.isArray(parsed.entities?.mentionedPlanNames) ? parsed.entities.mentionedPlanNames : [],
        mentionedPTNames: Array.isArray(parsed.entities?.mentionedPTNames) ? parsed.entities.mentionedPTNames : [],
        mentionedProductNames: Array.isArray(parsed.entities?.mentionedProductNames) ? parsed.entities.mentionedProductNames : [],
        timeRange: parsed.entities?.timeRange || null,
        action: parsed.entities?.action || null,
        needsPT: typeof parsed.entities?.needsPT === 'boolean' ? parsed.entities.needsPT : null,
      }
    }
  } catch (error) {
    console.error('Classifier run error:', error)
    return null
  }
}

const normalizeClassifierResult = (classifierResult, query, user = null, language = 'vi', semanticMemory = {}) => {
  const lang = normalizeLanguage(language)
  const normalized = {
    subject: classifierResult?.subject || 'general',
    action: classifierResult?.action || 'unclear',
    intent: classifierResult?.intent || 'unknown',
    confidence: typeof classifierResult?.confidence === 'number' ? classifierResult.confidence : 0.5,
    shouldAskClarify: Boolean(classifierResult?.shouldAskClarify),
    shouldRenderCard: Boolean(classifierResult?.shouldRenderCard),
    language: classifierResult?.language === 'en' ? 'en' : lang,
    needsAIReasoning: typeof classifierResult?.needsAIReasoning === 'boolean' ? classifierResult.needsAIReasoning : true,
    needsDatabase: typeof classifierResult?.needsDatabase === 'boolean' ? classifierResult.needsDatabase : true,
    tools: sanitizeClassifierTools(classifierResult?.tools),
    reason: classifierResult?.reason || '',
    entities: {
      budget: typeof classifierResult?.entities?.budget === 'number' ? classifierResult.entities.budget : null,
      budgetPeriod: classifierResult?.entities?.budgetPeriod || 'unknown',
      goal: classifierResult?.entities?.goal || null,
      frequencyPerWeek: typeof classifierResult?.entities?.frequencyPerWeek === 'number' ? classifierResult.entities.frequencyPerWeek : null,
      mentionedPlanNames: Array.isArray(classifierResult?.entities?.mentionedPlanNames) ? classifierResult.entities.mentionedPlanNames : [],
      mentionedPTNames: Array.isArray(classifierResult?.entities?.mentionedPTNames) ? classifierResult.entities.mentionedPTNames : [],
      mentionedProductNames: Array.isArray(classifierResult?.entities?.mentionedProductNames) ? classifierResult.entities.mentionedProductNames : [],
      timeRange: classifierResult?.entities?.timeRange || normalizeTimeRange(query).label,
      action: classifierResult?.entities?.action || null,
      needsPT: typeof classifierResult?.entities?.needsPT === 'boolean' ? classifierResult.entities.needsPT : null,
    },
  }

  const allowedIntents = new Set([
    'membership_info',
    'membership_advice',
    'plan_comparison',
    'cheapest_long_term_plan',
    'checkin_info',
    'checkin_help',
    'checkin_summary',
    'checkin_goal',
    'pt_advice',
    'pt_info',
    'pt_availability',
    'booking_info',
    'booking_action',
    'health_advice',
    'health_info',
    'workout_advice',
    'workout_info',
    'shop_advice',
    'shop_info',
    'notification_info',
    'policy_faq',
    'policy_refund',
    'policy_privacy',
    'policy_payment',
    'policy_terms',
    'faq_answer',
    'feedback_action',
    'admin_report',
    'theme_action',
    'general_chat',
    'unclear_question',
    'unknown',
  ])
  if (!allowedIntents.has(normalized.intent)) normalized.intent = 'unknown'

  const analysis = buildQuestionAnalysis(query, lang)
  if (analysis.intent !== 'unknown' && analysis.confidence >= normalized.confidence) {
    normalized.subject = analysis.subject
    normalized.action = analysis.action
    normalized.intent = analysis.intent
    normalized.confidence = Math.max(normalized.confidence, analysis.confidence)
    normalized.shouldAskClarify = analysis.shouldAskClarify
    normalized.shouldRenderCard = analysis.shouldRenderCard
    normalized.language = analysis.language
    normalized.needsAIReasoning = analysis.needsAIReasoning
    normalized.needsDatabase = analysis.needsDatabase
    normalized.tools = sanitizeClassifierTools(analysis.tools)
    normalized.reason = `${normalized.reason} | ${analysis.reason}`.trim()
    normalized.entities = {
      ...normalized.entities,
      budget: analysis.entities.budget ?? normalized.entities.budget,
      goal: analysis.entities.goal ?? normalized.entities.goal,
      frequencyPerWeek: analysis.entities.frequencyPerWeek ?? normalized.entities.frequencyPerWeek,
      timeRange: analysis.entities.timeRange || normalized.entities.timeRange,
      action: analysis.action,
      needsPT: analysis.entities.needsPT,
    }
  }

  const explicitSchedule = hasExplicitScheduleIntent(query)
  const bookingAction = hasBookingActionIntent(query)
  const ptAdvice = hasPtAdviceIntent(query)
  const shortUnclear = isShortUnclearQuestion(query)
  if (shortUnclear) {
    normalized.action = 'unclear'
    normalized.intent = 'unclear_question'
    normalized.shouldAskClarify = true
    normalized.shouldRenderCard = false
    normalized.needsDatabase = false
    normalized.needsAIReasoning = false
    normalized.tools = []
    normalized.reason = `${normalized.reason} | guard: short ambiguous message stays unclear`.trim()
  } else if (hasCheapestLongTermIntent(query)) {
    normalized.subject = 'plan'
    normalized.action = 'compare'
    normalized.intent = 'cheapest_long_term_plan'
    normalized.shouldAskClarify = false
    normalized.shouldRenderCard = false
    normalized.needsDatabase = true
    normalized.needsAIReasoning = false
    normalized.tools = ['plans']
    normalized.reason = `${normalized.reason} | guard: cheapest long-term plan query`.trim()
  } else if (asksPlanBenefitQuestion(query)) {
    normalized.subject = 'plan'
    normalized.action = 'info'
    normalized.intent = 'membership_info'
    normalized.shouldAskClarify = false
    normalized.shouldRenderCard = false
    normalized.needsDatabase = true
    normalized.needsAIReasoning = false
    normalized.tools = ['plans']
    normalized.reason = `${normalized.reason} | guard: plan benefit lookup is DB-only`.trim()
  } else if (hasRefundPolicyIntent(query)) {
    normalized.subject = 'policy'
    normalized.action = 'policy_lookup'
    normalized.intent = 'policy_refund'
    normalized.needsDatabase = true
    normalized.needsAIReasoning = false
    normalized.reason = `${normalized.reason} | guard: refund policy query`.trim()
  } else if (hasPrivacyPolicyIntent(query)) {
    normalized.subject = 'policy'
    normalized.action = 'policy_lookup'
    normalized.intent = 'policy_privacy'
    normalized.needsDatabase = true
    normalized.needsAIReasoning = false
    normalized.reason = `${normalized.reason} | guard: privacy policy query`.trim()
  } else if (hasPaymentPolicyIntent(query)) {
    normalized.subject = 'policy'
    normalized.action = 'policy_lookup'
    normalized.intent = 'policy_payment'
    normalized.needsDatabase = true
    normalized.needsAIReasoning = false
    normalized.reason = `${normalized.reason} | guard: payment policy query`.trim()
  } else if (ptAdvice) {
    normalized.subject = 'trainer'
    normalized.action = 'advice'
    normalized.intent = 'pt_advice'
    normalized.shouldRenderCard = false
    normalized.needsDatabase = true
    normalized.needsAIReasoning = false
    normalized.reason = `${normalized.reason} | guard: PT advice query`.trim()
  } else if (hasPtAvailabilityIntent(query)) {
    normalized.subject = 'trainer'
    normalized.action = 'availability'
    normalized.intent = 'pt_availability'
    normalized.shouldRenderCard = true
    normalized.needsDatabase = true
    normalized.needsAIReasoning = false
    normalized.reason = `${normalized.reason} | guard: PT availability query`.trim()
  } else if (hasBookingInfoIntent(query)) {
    normalized.subject = 'booking'
    normalized.action = 'personal_data'
    normalized.intent = 'booking_info'
    normalized.shouldRenderCard = true
    normalized.needsDatabase = true
    normalized.needsAIReasoning = false
    normalized.reason = `${normalized.reason} | guard: user booking info query`.trim()
  } else if (hasCheckinGoalIntent(query)) {
    normalized.subject = 'checkin'
    normalized.action = 'info'
    normalized.intent = 'checkin_goal'
    normalized.shouldRenderCard = true
    normalized.needsDatabase = true
    normalized.needsAIReasoning = false
    normalized.reason = `${normalized.reason} | guard: checkin goal query`.trim()
  } else if (hasMembershipAdviceIntent(query) && !hasShopIntent(query) && hasWorkoutFrequencyIntent(query)) {
    normalized.subject = 'plan'
    normalized.action = 'advice'
    normalized.intent = normalized.intent === 'membership_info' ? 'membership_info' : 'membership_advice'
    normalized.shouldRenderCard = false
    normalized.needsDatabase = true
    normalized.needsAIReasoning = true
    normalized.tools = ['plans', 'membership']
    normalized.reason = `${normalized.reason} | guard: membership advice with frequency combined`.trim()
    normalized.entities.frequencyPerWeek = normalized.entities.frequencyPerWeek || normalizeWeeklyFrequency(query)
  } else if (hasWorkoutFrequencyIntent(query)) {
    normalized.subject = 'workout'
    normalized.action = 'info'
    normalized.intent = 'workout_info'
    normalized.shouldRenderCard = false
    normalized.needsDatabase = true
    normalized.needsAIReasoning = true
    normalized.reason = `${normalized.reason} | guard: workout frequency query`.trim()
    normalized.entities.frequencyPerWeek = normalized.entities.frequencyPerWeek || normalizeWeeklyFrequency(query)
  } else if (hasMembershipAdviceIntent(query) && !hasShopIntent(query)) {
    normalized.subject = 'plan'
    normalized.action = 'advice'
    normalized.intent = normalized.intent === 'membership_info' ? 'membership_info' : 'membership_advice'
    normalized.needsDatabase = true
    normalized.needsAIReasoning = true
    normalized.reason = `${normalized.reason} | guard: membership advice query`.trim()
  }

  if (semanticMemory?.isSupplemental && hasWorkoutFrequencyIntent(query) && isPlanAdviceMemory(semanticMemory)) {
    normalized.subject = 'plan'
    normalized.action = 'advice'
    normalized.intent = 'membership_advice'
    normalized.shouldAskClarify = false
    normalized.shouldRenderCard = false
    normalized.needsDatabase = true
    normalized.needsAIReasoning = true
    normalized.tools = ['plans', 'membership']
    normalized.reason = `${normalized.reason} | memory: workout frequency supplements previous plan advice`.trim()
    normalized.entities.frequencyPerWeek = normalized.entities.frequencyPerWeek || normalizeWeeklyFrequency(query)
  }

  if (semanticMemory?.pendingClarification) {
    const pc = semanticMemory.pendingClarification
    normalized.subject = pc.subject
    normalized.action = pc.action
    normalized.intent = pc.intent
    normalized.shouldAskClarify = false
    normalized.shouldRenderCard = pc.shouldRenderCard
    normalized.needsDatabase = true
    normalized.needsAIReasoning = pc.needsAIReasoning
    normalized.tools = pc.tools
    normalized.reason = `${normalized.reason} | ${pc.reason}`.trim()
  }

  if (normalized.intent === 'schedule_info' && !explicitSchedule) {
    normalized.intent = hasHealthOrWorkoutContext(query) ? 'workout_advice' : 'membership_advice'
    normalized.needsAIReasoning = true
    normalized.reason = `${normalized.reason} | schedule guard: user did not ask for booked schedule`.trim()
  }
  if (normalized.intent === 'booking_action' && !bookingAction) {
    normalized.intent = explicitSchedule ? 'booking_info' : 'membership_advice'
    normalized.needsAIReasoning = true
    normalized.reason = `${normalized.reason} | booking guard: no booking action requested`.trim()
  }

  if (normalized.intent === 'admin_report' && !hasRole(user, ADMIN_ROLES)) {
    normalized.intent = 'general_chat'
    normalized.needsDatabase = false
    normalized.reason = `${normalized.reason} | role guard: admin_report denied for ${getRole(user)}`.trim()
  }

  const toolSet = new Set(normalized.tools.map(normalizeToolName))
  if (asksPlanBenefitQuestion(query)) {
    toolSet.clear()
    toolSet.add('plans')
  } else if (normalized.intent === 'cheapest_long_term_plan') {
    toolSet.clear()
    toolSet.add('plans')
  } else if (normalized.intent.startsWith('membership_') || normalized.intent === 'plan_comparison') {
    toolSet.add('plans')
    if (normalized.intent !== 'plan_comparison') toolSet.add('membership')
  }
  if (normalized.intent.startsWith('checkin_')) toolSet.add('checkins')
  if (normalized.intent.startsWith('pt_')) toolSet.add('pt')
  if (normalized.intent === 'booking_info' || normalized.intent === 'booking_action') toolSet.add('bookings')
  if (normalized.intent === 'booking_action' || normalized.intent === 'pt_availability') toolSet.add('ptAvailability')
  if (normalized.intent.startsWith('workout_')) toolSet.add('workout')
  if (normalized.intent.startsWith('health_')) toolSet.add('health')
  if (normalized.intent.startsWith('shop_')) toolSet.add('products')
  if (normalized.intent === 'shop_info') toolSet.add('orders')
  if (normalized.intent === 'notification_info') toolSet.add('notifications')
  if (normalized.intent === 'policy_faq' || normalized.intent.startsWith('policy_') || normalized.intent === 'faq_answer') {
    toolSet.add('faqs')
    toolSet.add('policies')
  }
  if (normalized.intent === 'feedback_action') toolSet.add('feedback')
  if (normalized.intent === 'admin_report') {
    toolSet.add('reports')
    toolSet.add('members')
  }
  normalized.tools = [...toolSet]

  return normalized
}

const buildDefaultClassifier = (query, language = 'vi') => {
  const analysis = buildQuestionAnalysis(query, language)
  if (analysis.intent !== 'unknown') {
    return {
      subject: analysis.subject,
      action: analysis.action,
      intent: analysis.intent,
      confidence: analysis.confidence,
      shouldAskClarify: analysis.shouldAskClarify,
      shouldRenderCard: analysis.shouldRenderCard,
      language: analysis.language,
      needsAIReasoning: analysis.needsAIReasoning,
      needsDatabase: analysis.needsDatabase,
      tools: analysis.tools,
      reason: analysis.reason,
      entities: {
        budget: analysis.entities.budget,
        budgetPeriod: 'unknown',
        goal: analysis.entities.goal,
        frequencyPerWeek: analysis.entities.frequencyPerWeek,
        mentionedPlanNames: analysis.entities.mentionedPlanNames,
        mentionedPTNames: analysis.entities.mentionedTrainerNames,
        mentionedProductNames: [],
        timeRange: analysis.entities.timeRange,
        action: analysis.action,
        needsPT: analysis.entities.needsPT,
      }
    }
  }
  const normalized = normalizeForIntent(query)
  const budget = normalizeVietnameseMoney(query)
  const frequencyPerWeek = normalizeWeeklyFrequency(query)
  const timeRange = normalizeTimeRange(query).label
  const isBudgetOrGoal = Boolean(budget)
    || Boolean(frequencyPerWeek)
    || /\b(giam can|giam mo|tang co|tang can|khoe hon|suc khoe|sinh vien|moi tap|tiet kiem|goi|gia)\b/.test(normalized)
  const isCheckinGoal = hasCheckinGoalIntent(query)
  const isCheckin = /\b(checkin|check in|diem danh|di tap bao nhieu|bao nhieu buoi)\b/.test(normalized)
  const isPtAdvice = hasPtAdviceIntent(query)
  const isPtAvailability = hasPtAvailabilityIntent(query)
  const isBookingInfo = hasBookingInfoIntent(query)
  const isBooking = /\b(dat lich|booking|huy lich|doi lich)\b/.test(normalized)
  const isHealth = /\b(bmi|dau lung|dau nguc|kho tho|chong mat|chan thuong|huyet ap)\b/.test(normalized)
  const isWorkout = /\b(bai tap|workout|tap gi|lich tap tu tap|giam .*kg|moi tap)\b/.test(normalized)
  const isShop = hasShopIntent(query)
  const isRefund = hasRefundPolicyIntent(query)
  const isPrivacy = hasPrivacyPolicyIntent(query)
  const isPayment = hasPaymentPolicyIntent(query)
  const isPolicy = /\b(chinh sach|quy dinh|faq|terms|dieu khoan)\b/.test(normalized)
  const isAdmin = /\b(doanh thu|bao cao|dashboard|member sap het han|thong ke)\b/.test(normalized)
  const isTheme = /\b(doi giao dien|doi mau|theme|mau xanh|mau do|dark mode)\b/.test(normalized)
  const intent = isTheme ? 'theme_action'
    : isAdmin ? 'admin_report'
      : isRefund ? 'policy_refund'
        : isPrivacy ? 'policy_privacy'
          : isPayment ? 'policy_payment'
            : isPolicy ? 'faq_answer'
              : isPtAdvice ? 'pt_advice'
                : isPtAvailability ? 'pt_availability'
                  : isBookingInfo ? 'booking_info'
                    : isBooking ? 'booking_action'
                      : isCheckinGoal ? 'checkin_goal'
                        : isCheckin ? 'checkin_summary'
                          : isShop ? 'shop_advice'
                            : isHealth ? 'health_info'
                              : isWorkout ? 'workout_advice'
                                : isBudgetOrGoal || hasMembershipAdviceIntent(query) ? 'membership_advice'
                                  : 'unknown'
  return {
    intent,
    confidence: 0.2,
    needsAIReasoning: true,
    needsDatabase: true,
    tools: [],
    reason: 'classifier error fallback',
    entities: {
      budget,
      budgetPeriod: 'unknown',
      goal: null,
      frequencyPerWeek,
      mentionedPlanNames: [],
      mentionedPTNames: [],
      mentionedProductNames: [],
      timeRange,
      action: null,
      needsPT: null
    }
  }
}

const buildInitialToolData = async ({ user, query, language }) => {
  const role = getRole(user)
  return {
    userMessage: query,
    recentConversation: [],
    language,
    userId: String(user?._id || ''),
    role,
    permissions: getPermissionsForRole(role),
    profile: {
      name: getUserDisplayName(user),
      email: user?.email || '',
      phone: user?.phone || '',
      themePreference: user?.themePreference || 'system',
      accentColor: user?.accentColor || '',
    },
    normalized: {
      budget: normalizeVietnameseMoney(query),
      frequencyPerWeek: normalizeWeeklyFrequency(query),
      timeRange: normalizeTimeRange(query).label,
    },
  }
}

// 3. Tool Planner data fetcher
const fetchToolData = async ({ user, query, toolNames, cacheContext }) => {
  const memberId = toObjectIdOrNull(user?._id)
  if (!memberId) return {}

  const promises = {}
  const tools = new Set((toolNames || []).map(normalizeToolName))

  if (tools.has('plans')) {
    promises.activePlans = getContextCached(cacheContext, 'activePlans', 5 * 60, () => getActivePlans(12), '12')
  }
  if (tools.has('membership')) {
    promises.currentMembership = getContextCached(cacheContext, 'currentMembership', 60, () => getLatestMembership(memberId).then(serializeMembership))
    promises.membershipHistory = getMembershipHistory(memberId)
  }
  if (tools.has('checkins')) {
    promises.checkin = getContextCached(cacheContext, 'checkinStats', 60, () => getCheckinContext(memberId))
  }
  if (tools.has('pt')) {
    promises.pt = getContextCached(cacheContext, 'ptList', 5 * 60, () => getPTList(8), '8')
  }
  if (tools.has('ptAvailability')) {
    promises.ptAvailability = getContextCached(cacheContext, 'ptAvailability', 20, () => getPTAvailability(query, 8, cacheContext), normalizeTimeRange(query).label)
  }
  if (tools.has('bookings') || tools.has('schedule')) {
    promises.booking = getContextCached(cacheContext, 'upcomingBookings', 30, () => getBookingContext(user, query, cacheContext))
  }
  if (tools.has('health')) {
    promises.health = getHealthContext(memberId)
  }
  if (tools.has('workout')) {
    promises.workout = getWorkoutContext(memberId)
  }
  if (tools.has('products')) {
    promises.products = getContextCached(cacheContext, 'products', 5 * 60, () => getProducts(8), '8')
  }
  if (tools.has('orders')) {
    promises.orders = getOrderHistory(user, 8)
  }
  if (tools.has('notifications')) {
    promises.notifications = getNotifications(memberId)
  }
  if (tools.has('faqs')) {
    promises.faqs = getContextCached(cacheContext, 'faqs', 10 * 60, () => getFaqs(30), '30')
  }
  if (tools.has('policies')) {
    promises.policies = getContextCached(cacheContext, 'policies', 10 * 60, () => getPolicies(30), '30')
  }
  if (tools.has('feedback')) {
    promises.feedbackHistory = getFeedbackHistory(user, 6)
  }
  if (tools.has('reports') && hasRole(user, ADMIN_ROLES)) {
    promises.admin = getDashboardStats()
  }
  if (tools.has('members') && hasRole(user, ADMIN_ROLES)) {
    promises.memberStats = Promise.all([
      User.countDocuments({ role: 'member' }),
      User.countDocuments({ role: 'member', isActive: true, status: { $ne: 'locked' } }),
      Membership.countDocuments({ status: 'active' }),
    ]).then(([totalMembers, activeMembers, activeMemberships]) => ({ totalMembers, activeMembers, activeMemberships }))
  }

  const keys = Object.keys(promises)
  const results = await Promise.all(Object.values(promises))
  const toolData = {}
  keys.forEach((key, index) => {
    toolData[key] = results[index]
  })

  return toolData
}

const mergeToolData = (baseData = {}, extraData = {}) => {
  const merged = {
    ...(baseData || {}),
    ...(extraData || {}),
  }
  if (Array.isArray(merged.activePlans) && !Array.isArray(merged.plans)) merged.plans = merged.activePlans
  if (Array.isArray(merged.plans) && !Array.isArray(merged.activePlans)) merged.activePlans = merged.plans
  if (merged.currentMembership && !merged.membership) merged.membership = merged.currentMembership
  if (merged.membership && !merged.currentMembership) merged.currentMembership = merged.membership
  if (merged.currentMembership?.remainingDays !== undefined && merged.daysLeft === undefined) merged.daysLeft = merged.currentMembership.remainingDays
  if (merged.checkin) {
    merged.checkinStats = merged.checkin.checkinStats
    merged.latestCheckins = merged.checkin.latestCheckins
    merged.streak = merged.checkin.streak
    merged.todayCheckinStatus = merged.checkin.todayCheckinStatus
  }
  if (merged.checkins?.stats && !merged.checkinStats) merged.checkinStats = merged.checkins.stats
  if (merged.pt) {
    merged.availablePTs = merged.pt
    merged.ptSpecialties = [...new Set(merged.pt.flatMap((pt) => pt.specialties || []))]
    merged.ptRatings = merged.pt.map((pt) => ({ name: pt.name, rating: pt.rating }))
  }
  if (merged.booking) {
    merged.upcomingBookings = merged.booking.upcomingBookings
    merged.bookingHistory = merged.booking.bookingHistory
    if (merged.booking.availableSlots) merged.availableSlots = merged.booking.availableSlots
  }
  if (merged.schedule && !merged.upcomingSchedule) merged.upcomingSchedule = merged.schedule
  if (merged.upcomingSchedule && !merged.schedule) merged.schedule = merged.upcomingSchedule
  if (merged.health && !merged.healthSummary) merged.healthSummary = merged.health
  if (merged.healthSummary && !merged.health) merged.health = merged.healthSummary
  if (merged.workout) {
    merged.currentWorkoutPlan = merged.workout.currentWorkoutPlan
    merged.workoutProgress = merged.workout.workoutProgress
    merged.completedSessions = merged.workout.completedSessions
    merged.trainingGoal = merged.workout.trainingGoal
  }
  if (merged.workoutProgress && !merged.workout) merged.workout = merged.workoutProgress
  if (merged.admin) {
    merged.dashboardStats = merged.admin.dashboardStats
    merged.expiringMembers = merged.admin.expiringMembers
    merged.revenueSummary = merged.admin.revenueSummary
    merged.churnRisk = merged.admin.churnRisk
  }
  if (!merged.cartSummary) merged.cartSummary = { available: false, reason: 'Cart is stored client-side in this project' }
  return merged
}

const compactRecentConversation = (messages = [], limit = 8) => (
  Array.isArray(messages)
    ? messages.slice(-limit).map((message) => ({
        role: message.role,
        content: String(message.content || '').slice(0, 500),
        createdAt: message.createdAt,
        intent: message.intent,
        action: message.action,
        subject: message.subject,
      }))
    : []
)

const localizePlan = (plan = {}, language = 'vi') => {
  const lang = normalizeLanguage(language)
  const benefitsVi = Array.isArray(plan.benefitsVi) ? plan.benefitsVi : Array.isArray(plan.featuresVi) ? plan.featuresVi : []
  const benefitsEn = Array.isArray(plan.benefitsEn) ? plan.benefitsEn : Array.isArray(plan.featuresEn) ? plan.featuresEn : []
  return {
    id: String(plan._id || plan.id || ''),
    name: lang === 'en' ? (plan.nameEn || plan.nameVi || '') : (plan.nameVi || plan.nameEn || ''),
    price: plan.price,
    durationDays: plan.durationDays,
    description: lang === 'en' ? (plan.descriptionEn || plan.descriptionVi || '') : (plan.descriptionVi || plan.descriptionEn || ''),
    benefits: (lang === 'en' ? (benefitsEn.length ? benefitsEn : benefitsVi) : (benefitsVi.length ? benefitsVi : benefitsEn)).slice(0, 6),
    color: plan.color,
    isActive: plan.isActive ?? true,
  }
}

const localizePolicy = (policy = {}, language = 'vi') => {
  const lang = normalizeLanguage(language)
  return {
    id: String(policy.id || policy._id || ''),
    title: lang === 'en' ? (policy.titleEn || policy.titleVi || '') : (policy.titleVi || policy.titleEn || ''),
    category: lang === 'en' ? (policy.categoryEn || policy.categoryVi || '') : (policy.categoryVi || policy.categoryEn || ''),
    content: String(lang === 'en' ? (policy.contentEn || policy.contentVi || '') : (policy.contentVi || policy.contentEn || '')).slice(0, 500),
  }
}

const localizeFaq = (faq = {}, language = 'vi') => {
  const lang = normalizeLanguage(language)
  return {
    id: String(faq.id || faq._id || ''),
    question: lang === 'en' ? (faq.questionEn || faq.questionVi || '') : (faq.questionVi || faq.questionEn || ''),
    answer: String(lang === 'en' ? (faq.answerEn || faq.answerVi || '') : (faq.answerVi || faq.answerEn || '')).slice(0, 500),
    category: lang === 'en' ? (faq.categoryEn || faq.categoryVi || '') : (faq.categoryVi || faq.categoryEn || ''),
  }
}

const localizeProduct = (product = {}, language = 'vi') => {
  const lang = normalizeLanguage(language)
  return {
    id: String(product.id || product._id || ''),
    name: lang === 'en' ? (product.nameEn || product.name || product.nameVi || '') : (product.nameVi || product.name || product.nameEn || ''),
    price: product.price,
    category: lang === 'en' ? (product.categoryEn || product.category || product.categoryVi || '') : (product.categoryVi || product.category || product.categoryEn || ''),
    stock: product.stock,
    rating: product.rating,
  }
}

const localizeMembership = (membership = {}, language = 'vi') => {
  const lang = normalizeLanguage(language)
  if (!membership?.found) return { found: false }
  return {
    found: true,
    planName: lang === 'en' ? (membership.planNameEn || membership.planNameVi || membership.planName || '') : (membership.planNameVi || membership.planName || membership.planNameEn || ''),
    daysLeft: membership.remainingDays,
    remainingDays: membership.remainingDays,
    status: membership.status,
    price: membership.planPrice,
    durationDays: membership.planDurationDays,
  }
}

const compactToolDataForAi = (toolData = {}, language = 'vi') => {
  const lang = normalizeLanguage(language)
  console.log('[LOCALIZATION]', lang)
  const plans = toolData.activePlans || toolData.plans || []
  return {
    role: toolData.role,
    permissions: toolData.permissions,
    plans: plans.map((plan) => localizePlan(plan, lang)),
    membership: localizeMembership(toolData.currentMembership || toolData.membership, lang),
    checkin: toolData.checkinStats
      ? {
          monthCount: toolData.checkinStats.thisMonth ?? toolData.checkinStats.last30Days ?? 0,
          last30Days: toolData.checkinStats.last30Days ?? 0,
          lastCheckin: toolData.latestCheckins?.[0]?.createdAt || null,
          streak: toolData.streak ?? 0,
          todayCheckinStatus: toolData.todayCheckinStatus,
        }
      : null,
    bookings: (toolData.upcomingBookings || []).slice(0, 5).map((booking) => ({
      date: booking.date,
      slot: booking.slot,
      status: booking.status,
      ptName: booking.ptName,
    })),
    ptAvailability: toolData.ptAvailability
      ? {
          timeRange: toolData.ptAvailability.timeRange,
          availablePTs: (toolData.ptAvailability.availablePTs || []).slice(0, 6).map((pt) => ({
            id: pt.id,
            name: pt.name,
            specialties: pt.specialties,
            rating: pt.rating,
          })),
          availableSlots: (toolData.ptAvailability.availableSlots || []).slice(0, 6).map((slot) => ({
            ptName: slot.ptName,
            slot: slot.slot,
            rangeStart: slot.rangeStart,
            rangeEnd: slot.rangeEnd,
          })),
        }
      : null,
    policies: (toolData.policies || []).slice(0, 8).map((policy) => localizePolicy(policy, lang)),
    faqs: (toolData.faqs || []).slice(0, 8).map((faq) => localizeFaq(faq, lang)),
    products: (toolData.products || []).slice(0, 8).map((product) => localizeProduct(product, lang)),
    admin: toolData.dashboardStats ? {
      dashboardStats: toolData.dashboardStats,
      revenueSummary: toolData.revenueSummary,
      expiringMembers: toolData.expiringMembers,
    } : null,
  }
}

// 4. Answer Generator Prompts
const buildAnswerGeneratorSystemPrompt = (language = 'vi') => {
  const lang = normalizeLanguage(language)
  const languageInstruction = lang === 'en'
    ? `You are GymPro Assistant.
Always answer in the user's message language. If unclear, use the app language.
For this request, answer entirely in English.
Use only the localized English fields already present in toolData/context.
Do not manually translate database data and do not infer missing translations.`
    : `Bạn là GymPro Assistant.
Luôn trả lời theo ngôn ngữ trong tin nhắn của user. Nếu không rõ, dùng ngôn ngữ hiện tại của app.
Với request này, trả lời hoàn toàn bằng tiếng Việt.
Chỉ dùng các field tiếng Việt đã được localize sẵn trong toolData/context.
Không tự dịch dữ liệu database và không suy đoán bản dịch bị thiếu.`
  return `${languageInstruction}

Bạn là GymPro Operations Assistant - trợ lý thông minh cho toàn bộ hệ thống phòng gym.
Bạn hỗ trợ theo role của user: Auth/Profile, Membership/Plans, Member info, Check-in QR, PT, Booking, Workout, Health, Reports/Dashboard, Products/Shop, Notifications, Feedback/Policies/FAQ, Theme/System settings.

Nguyên tắc bắt buộc:
1. Dựa trên classifierResult và toolData. toolData là nguồn dữ liệu thật duy nhất. Không bịa giá, quyền lợi, lịch, doanh thu, sản phẩm, chính sách, PT.
1a. toolData/context đã được localize theo language="${lang}". Không dùng AI để dịch từ field ngôn ngữ khác.
2. Role-aware: member chỉ xem dữ liệu của chính mình; staff hỗ trợ check-in/member cơ bản; PT xem lịch dạy/học viên liên quan; admin mới xem báo cáo/doanh thu/member hệ thống.
3. Nếu user cần tư vấn/so sánh/tối ưu/có nên không/phù hợp không/đáng tiền không: dùng reasoning, kết luận trước, giải thích ngắn gọn, tối đa 1-2 lựa chọn thay thế.
4. Nếu user hỏi dữ liệu trực tiếp: trả lời từ DB ngắn gọn, không biến thành tư vấn lan man.
5. Nếu thiếu dữ liệu quan trọng: hỏi đúng 1 câu quan trọng nhất.
   Nhưng nếu user đã cung cấp ít nhất 2 tín hiệu trong: mục tiêu, ngân sách/ưu tiên tiết kiệm, tần suất tập, có cần PT không, kinh nghiệm tập, thời gian muốn tập => KHÔNG hỏi thêm ngay; phải tư vấn luôn với dữ liệu hiện có. Chỉ hỏi thêm khi query rất mơ hồ như "tư vấn tôi", "nên chọn gì", "tôi muốn tập".
6. Không liệt kê toàn bộ danh sách nếu user không yêu cầu.
7. Nếu quyền lợi/chính sách/sản phẩm không có trong DB: nói rõ GymPro chưa ghi nhận dữ liệu đó, không tự suy đoán.
8. Safety/medical: với đau ngực, khó thở, chóng mặt, chấn thương nặng, bệnh nền hoặc triệu chứng nghiêm trọng, không chẩn đoán; khuyên gặp bác sĩ/chuyên gia và chỉ đưa lời khuyên tập luyện an toàn chung.
9. Suggestions phải là 3-4 câu hỏi tiếp theo, không phải card, không gợi ý sai domain. Ví dụ hỏi tư vấn gói thì không gợi ý đặt lịch/PT trừ khi user có nhu cầu.
10. Format dễ đọc: không trả một đoạn văn dài. Với câu tư vấn, answer phải có "Kết luận:" trước, sau đó dòng trống, "Lý do:" và bullet "- ...". Nếu có lựa chọn khác, chỉ thêm 1-2 bullet ở mục riêng. Với check-in/báo cáo, đưa số liệu chính trước rồi bullet gợi ý cải thiện. Mỗi bullet ngắn, không quá 1 câu.
11. Nếu type là plan_recommend, luôn trả thêm "conclusion" và "reason" là mảng 2-4 chuỗi ngắn. Không nhét toàn bộ answer vào reason.
12. Tôn trọng classifierResult.intent:
   - membership_advice/plan_comparison chỉ dùng activePlans/membership, không trả shop.
   - pt_advice chỉ dùng trainer/PT data, không trả plan_recommend và không đề xuất gói tập thay cho PT.
   - checkin_goal phải tính currentCheckins, target và missing nếu toolData có checkinStats.
   - pt_availability là hỏi PT nào còn trống, không trả upcomingBookings của user.
   - booking_info mới là lịch đã đặt của user.
   - policy_refund chỉ trả chính sách hoàn tiền/refund; không trả bảo mật/privacy.
13. Render gate: chỉ trả type/card khi response.type cuối cùng là plan_list, plan_detail, plan_recommend, plan_compare, trainer_list, booking_list, checkin_summary hoặc product_list. Nếu type là text_advice, policy_answer hoặc unclear_question thì chỉ trả text, không card. Không render card chỉ vì trong câu có từ "PT", "gói", "VIP", "lịch", "tập" hoặc "shop".

Output format:
Trả về duy nhất 1 JSON object hợp lệ, không bọc trong markdown hay bất cứ lời giải thích nào khác ngoài JSON:
{
  "intent": "intent cuối cùng sau khi đọc userMessage/context",
  "type": "text_advice | unclear_question | plan_list | plan_detail | plan_recommend | plan_compare | checkin_summary | pt_list | trainer_list | pt_detail | booking_list | booking_suggestion | workout_advice | workout_progress | health_summary | product_list | product_recommend | notification_list | policy_answer | admin_dashboard | report_summary | action_result",
  "answer": "câu trả lời tự nhiên, có xuống dòng và bullet khi có nhiều ý",
  "conclusion": "kết luận ngắn nếu là tư vấn, hoặc null",
  "reason": ["2-4 lý do ngắn nếu là plan_recommend/tư vấn, ngược lại []"],
  "recommendedPlanId": "Mongo id từ toolData.activePlans nếu type plan_recommend, hoặc null",
  "alternativePlanIds": ["tối đa 2 Mongo id gói thay thế"],
  "cardIds": ["ids item cần render card, nếu có"],
  "toolsNeeded": ["chỉ liệt kê tool còn thiếu nếu chưa đủ dữ liệu, thường là []"],
  "action": { "action": "change_theme | open_page | none", "themeName": string | null, "color": string | null, "path": string | null, "message": string | null },
  "suggestions": ["3-4 câu hỏi tiếp theo"]
}`
}

const buildAnswerGeneratorContextPrompt = ({ query, recentConversation, semanticMemory, classifierResult, toolData, language }) => {
  return `User Message: "${query}"
Language: "${language}"
Recent Conversation history (last messages only):
${JSON.stringify(compactRecentConversation(recentConversation, 5), null, 2).slice(0, 2400)}

Semantic Conversation Memory:
${JSON.stringify(semanticMemory || {}, null, 2).slice(0, 1800)}

Memory rule:
- Use semantic memory to connect follow-up details to the previous intent/subject.
- Do not use previous message language for the response. Respond in the current User Message language only.

Lightweight Intent Draft:
${JSON.stringify(classifierResult, null, 2)}

Compact Tool Data from Database:
${JSON.stringify(compactToolDataForAi(toolData, language), null, 2).slice(0, 9000)}

Return exactly one valid JSON object, no explanation:`
}

const buildRuleBasedFallbackAnswer = ({ query, classifierResult, toolData, language }) => {
  const lang = normalizeLanguage(language)
  const plans = toolData.activePlans || toolData.plans || []
  
  if (classifierResult.intent === 'cheapest_long_term_plan') {
    return {
      ...buildCheapestLongTermAnswer({ query, plans, language: lang }),
      data: {
        availablePlans: plans,
        activePlans: plans,
        ...toolData
      },
      metadata: {
        intent: classifierResult.intent,
        answeredBy: 'rule_fallback',
        route: 'AI_REASONING',
        usedFallback: true,
        classifier: classifierResult
      }
    }
  }

  if (classifierResult.intent === 'membership_advice' || classifierResult.intent === 'membership_info') {
    if (asksPlanBenefitQuestion(query)) {
      const mentionedPlan = findPlanMentionedInQuery(plans, query)
      const planName = getPlanName(mentionedPlan, lang) || (lang === 'en' ? 'this plan' : 'gói này')
      return {
        type: 'text_advice',
        answer: lang === 'en'
          ? `GymPro data does not currently record that benefit for ${planName}.`
          : `Hiện dữ liệu GymPro chưa ghi nhận quyền lợi đó trong ${planName}.`,
        recommendedPlan: null,
        plans: [],
        suggestions: lang === 'en'
          ? ['What benefits are recorded for this plan?', 'Which plan fits my budget?', 'Should I train without a PT?']
          : ['Gói này đang có quyền lợi nào?', 'Gói nào hợp ngân sách của tôi?', 'Không cần PT thì nên chọn sao?'],
        mode: 'gym',
        data: {
          availablePlans: plans,
          activePlans: plans,
          ...toolData
        },
        provider: 'rule_based',
        model: 'local',
        metadata: {
          intent: classifierResult.intent,
          answeredBy: 'rule_fallback',
          route: 'AI_REASONING',
          usedFallback: true,
          classifier: classifierResult
        }
      }
    }

    return {
      ...buildMembershipAdvicePayload({ query, toolData: { ...toolData, activePlans: plans, plans }, language: lang }),
      metadata: {
        intent: classifierResult.intent,
        answeredBy: 'rule_fallback',
        route: 'AI_REASONING',
        usedFallback: true,
        classifier: classifierResult
      }
    }
  }

  const fallbackType = normalizeResponseType(null, classifierResult.intent)
  const policyFallback = fallbackType === 'policy_answer'
    ? buildPolicyFallbackAnswer({ query, toolData, language: lang })
    : null

  if (classifierResult.intent === 'checkin_goal') {
    return {
      ...buildCheckinGoalAnswer({ query, toolData, language: lang }),
      metadata: {
        intent: classifierResult.intent,
        answeredBy: 'rule_fallback',
        route: 'DIRECT_CHECKIN_GOAL',
        usedFallback: true,
        classifier: classifierResult
      }
    }
  }

  if (classifierResult.intent === 'pt_availability') {
    return {
      ...buildPtAvailabilityAnswer({ toolData, language: lang }),
      metadata: {
        intent: classifierResult.intent,
        answeredBy: 'rule_fallback',
        route: 'DIRECT_PT_AVAILABILITY',
        usedFallback: true,
        classifier: classifierResult
      }
    }
  }

  const directAnswers = {
    checkin_summary: lang === 'en'
      ? formatReadableAnswer({
          conclusion: `This month you have ${toolData.checkinStats?.last30Days ?? 0} check-ins recorded.`,
          reasons: [
            `Current streak: ${toolData.checkinStats?.streak ?? toolData.streak ?? 0} day(s).`,
            'Keep a steady weekly rhythm instead of compressing all sessions into a few days.',
            'Review your workout progress if attendance drops for more than one week.'
          ],
          alternativeTitle: 'Improvement tips',
          lang
        })
      : formatReadableAnswer({
          conclusion: `Tháng này hệ thống ghi nhận bạn đã check-in ${toolData.checkinStats?.last30Days ?? 0} buổi.`,
          reasons: [
            `Chuỗi hiện tại: ${toolData.checkinStats?.streak ?? toolData.streak ?? 0} ngày.`,
            'Duy trì lịch đều theo tuần thay vì dồn quá nhiều buổi vào vài ngày.',
            'Nếu số buổi giảm hơn 1 tuần, nên xem lại lộ trình tập hoặc mục tiêu hiện tại.'
          ],
          alternativeTitle: 'Gợi ý cải thiện',
          lang
        }),
    booking_list: lang === 'en'
      ? `You have ${(toolData.upcomingBookings || []).length} upcoming bookings.`
      : `Bạn đang có ${(toolData.upcomingBookings || []).length} lịch sắp tới.`,
    booking_suggestion: lang === 'en'
      ? `I found ${(toolData.ptAvailability?.availablePTs || toolData.availablePTs || []).length} PT options for that time range.`
      : `Mình tìm thấy ${(toolData.ptAvailability?.availablePTs || toolData.availablePTs || []).length} PT phù hợp trong khung thời gian đó.`,
    health_summary: lang === 'en'
      ? (toolData.healthSummary?.latestHealthLog ? 'Here is your latest health summary from GymPro data.' : 'GymPro does not have enough health data yet. What are your height and weight?')
      : (toolData.healthSummary?.latestHealthLog ? 'Đây là tóm tắt sức khỏe mới nhất theo dữ liệu GymPro.' : 'GymPro chưa có đủ dữ liệu sức khỏe. Bạn cho mình chiều cao và cân nặng hiện tại nhé?'),
    workout_advice: lang === 'en'
      ? 'Based on your goal, start with a sustainable training plan and progress gradually.'
      : 'Với mục tiêu của bạn, nên bắt đầu bằng lịch tập bền vững và tăng dần cường độ.',
    workout_progress: lang === 'en'
      ? `GymPro has ${(toolData.workoutProgress || []).length} recent workout records.`
      : `GymPro đang có ${(toolData.workoutProgress || []).length} ghi nhận tập luyện gần đây của bạn.`,
    product_list: lang === 'en'
      ? `I found ${(toolData.products || []).length} active products in GymPro shop.`
      : `Mình tìm thấy ${(toolData.products || []).length} sản phẩm đang bán trong shop GymPro.`,
    product_recommend: lang === 'en'
      ? 'Based on GymPro shop data, choose products that match your goal and budget.'
      : 'Dựa trên dữ liệu shop GymPro, bạn nên chọn sản phẩm khớp mục tiêu và ngân sách.',
    policy_answer: policyFallback?.answer || (lang === 'en'
      ? 'GymPro data does not currently record a matching policy.'
      : 'Hiện dữ liệu GymPro chưa ghi nhận chính sách phù hợp.'),
    notification_list: lang === 'en'
      ? `You have ${(toolData.notifications || []).length} recent notifications.`
      : `Bạn có ${(toolData.notifications || []).length} thông báo gần đây.`,
    report_summary: hasRole({ role: toolData.role }, ADMIN_ROLES)
      ? (lang === 'en' ? 'Here is the current admin report summary.' : 'Đây là tóm tắt báo cáo quản trị hiện tại.')
      : (lang === 'en' ? 'You do not have permission to view admin reports.' : 'Bạn không có quyền xem báo cáo quản trị.'),
    action_result: lang === 'en'
      ? 'I can help with this action if your account has permission.'
      : 'Mình có thể hỗ trợ thao tác này nếu tài khoản của bạn có quyền phù hợp.',
  }

  if (fallbackType !== 'text_advice' && directAnswers[fallbackType]) {
    const cards = policyFallback?.cards || pickCardsForType({ type: fallbackType, toolData, recommendedPlan: null, alternativePlans: [] })
    return {
      type: fallbackType,
      answer: directAnswers[fallbackType],
      data: toolData,
      cards,
      action: classifierResult.intent === 'theme_action' ? buildThemeActionFallback(query, lang) : null,
      recommendedPlan: null,
      plans: fallbackType === 'plan_list' ? plans : [],
      suggestions: getDomainSuggestions(classifierResult.intent, lang),
      mode: 'gym',
      provider: 'rule_based',
      model: 'local',
      metadata: {
        intent: classifierResult.intent,
        answeredBy: 'rule_fallback',
        route: 'AI_REASONING',
        usedFallback: true,
        classifier: classifierResult
      }
    }
  }
  
  const defaultAnswer = lang === 'en'
    ? 'I do not have enough information to answer that. Please feel free to ask about GymPro memberships, plans, workouts, or schedules!'
    : 'Tôi hiện chưa có đủ thông tin để trả lời câu hỏi này. Bạn hãy hỏi về gói tập, PT, lịch tập hoặc sức khỏe nhé!'
    
  return {
    type: 'text_advice',
    answer: defaultAnswer,
    recommendedPlan: null,
    plans: [],
    suggestions: lang === 'en'
      ? ['What goal should I prioritize?', 'Which plan suits my budget?']
      : ['Tôi nên ưu tiên mục tiêu nào?', 'Gói nào hợp ngân sách của tôi?'],
    mode: 'gym',
    data: {
      availablePlans: plans,
      activePlans: plans,
      ...toolData
    },
    provider: 'rule_based',
    model: 'local',
    metadata: {
      intent: classifierResult.intent,
      answeredBy: 'rule_fallback',
      route: 'AI_REASONING',
      usedFallback: true,
      classifier: classifierResult
    }
  }
}

// 5. Main runGymAiAction entry point
export const runGymAiAction = async ({ query, user, conversationContext, language = 'vi', userMessage = '' }) => {
  const appLanguage = normalizeLanguage(language)
  const lang = detectAnswerLanguage(userMessage || query, appLanguage)
  const normalizedQuery = query.trim()
  const initialBudget = normalizeVietnameseMoney(normalizedQuery)
  const initialFrequency = normalizeWeeklyFrequency(normalizedQuery)
  const cacheContext = createCacheContext({ user, conversationContext })
  const semanticMemory = buildSemanticConversationMemory(conversationContext, normalizedQuery)
  const reasoningQuery = buildReasoningQueryWithMemory(normalizedQuery, semanticMemory)
  console.log('[LANGUAGE]', lang)
  console.log('[LANG DETECT]', userMessage || query, lang)
  console.log('[LANGUAGE_SOURCE]', lang === appLanguage ? 'app_or_detected_same' : 'user_message')
  console.log('[LOCALIZATION]', lang)
  console.log('[SEMANTIC_MEMORY]', {
    lastIntent: semanticMemory.lastIntent,
    lastSubject: semanticMemory.lastSubject,
    isSupplemental: semanticMemory.isSupplemental,
    supplementalSignals: semanticMemory.supplementalSignals,
  })
  
  console.log('--- NEW AI INTENT FLOW ---')
  console.log('Query:', normalizedQuery)
  
  let classifierResult = null
  let classifierSource = 'fallback_rule'
  let provider = 'none'
  let model = 'none'
  let toolData = {}

  try {
    toolData = await buildInitialToolData({ user, query: normalizedQuery, language: lang })
    toolData.recentConversation = conversationContext?.recentMessages || []
    toolData.semanticMemory = semanticMemory
    toolData.language = lang
  } catch (err) {
    console.error('Initial context build error:', err)
    toolData = {
      userMessage: normalizedQuery,
      activePlans: [],
      plans: [],
      currentMembership: { found: false },
      membership: { found: false },
      checkinStats: null,
      semanticMemory,
      language: lang,
    }
  }

  if (hasAnyProviderConfigured()) {
    try {
      classifierResult = await runAiClassifier({
        query: normalizedQuery,
        recentConversation: conversationContext?.recentMessages || [],
        semanticMemory,
        toolData,
        language: lang,
      })
      if (classifierResult) classifierSource = 'ai'
    } catch (err) {
      console.error('AI classifier error, falling back to local classifier:', err)
    }
  }

  classifierResult = classifierResult || buildDefaultClassifier(normalizedQuery, lang)
  classifierResult = normalizeClassifierResult(classifierResult, normalizedQuery, user, lang, semanticMemory)
  
  if (initialBudget && !classifierResult.entities.budget) {
    classifierResult.entities.budget = initialBudget
  }
  if (semanticMemory.budget && !classifierResult.entities.budget) {
    classifierResult.entities.budget = semanticMemory.budget
    classifierResult.entities.budgetPeriod = semanticMemory.budgetPeriod || classifierResult.entities.budgetPeriod
  }
  if (initialFrequency && !classifierResult.entities.frequencyPerWeek) {
    classifierResult.entities.frequencyPerWeek = initialFrequency
  }
  
  console.log('[CLASSIFIER]', classifierResult.intent, classifierResult.confidence, classifierResult.tools, classifierResult.entities)
  console.log('[INTENT]', classifierResult.intent)
  console.log('[ROUTE]', 'AI_REASONING')
  
  const toolsUsed = classifierResult.tools || []
  console.log('[TOOLS]', toolsUsed)

  if (classifierResult.shouldAskClarify || classifierResult.intent === 'unclear_question') {
    let clarifyPayload = buildClarificationAnswer({ analysis: classifierResult, query: normalizedQuery, language: lang })
    clarifyPayload = applyRenderGate(clarifyPayload, classifierResult)
    clarifyPayload.answer = normalizeFinalAnswerText(cleanAiOutput(clarifyPayload.answer, { fallbackAnswer: getParseFailureAnswer(lang) }))
    clarifyPayload.metadata = { ...(clarifyPayload.metadata || {}), answerLanguage: lang, questionAnalysis: classifierResult, classifierSource, semanticMemory }
    console.log('[AI_AUDIT]', {
      userMessage: normalizedQuery,
      classifierSource,
      subject: classifierResult.subject,
      action: classifierResult.action,
      intent: classifierResult.intent,
      tools: classifierResult.tools,
      shouldRenderCard: classifierResult.shouldRenderCard,
      responseType: clarifyPayload.type,
      provider: clarifyPayload.provider || 'rule_based',
      model: clarifyPayload.model || 'local',
      language: lang,
      semanticMemory: {
        lastIntent: semanticMemory.lastIntent,
        lastSubject: semanticMemory.lastSubject,
        isSupplemental: semanticMemory.isSupplemental,
      },
      hasPlanPayload: Boolean(clarifyPayload.planPayload),
      finalAnswerPreview: String(clarifyPayload.answer || '').slice(0, 160),
    })
    return clarifyPayload
  }
  
  try {
    toolData = mergeToolData(toolData, await fetchToolData({
      user,
      query: normalizedQuery,
      toolNames: classifierResult.needsDatabase === false ? [] : toolsUsed,
      cacheContext,
    }))
  } catch (err) {
    console.error('Tool-scoped context fetch error:', err)
  }
  console.log('[TOOL_DATA]', summarizeToolDataForLog(toolData))
  
  // Ensure we have active plans for membership-related intents
  if ((!Array.isArray(toolData.activePlans) || toolData.activePlans.length === 0) && (classifierResult.intent === 'membership_advice' || classifierResult.intent === 'membership_info' || classifierResult.intent === 'plan_comparison' || toolsUsed.includes('plans'))) {
    try {
      toolData.activePlans = await getContextCached(cacheContext, 'activePlans', 5 * 60, () => getActivePlans(12), '12')
      toolData.plans = toolData.activePlans
    } catch (e) {}
  }
  
  let payload = null
  if (classifierResult.intent === 'membership_info' && (classifierResult.action === 'info' || classifierResult.shouldRenderCard || asksPlanBenefitQuestion(normalizedQuery))) {
    const plans = toolData.activePlans || toolData.plans || []
    payload = {
      ...buildPlanInfoDirectAnswer({ query: normalizedQuery, plans, language: lang }),
      data: toolData,
      mode: 'gym',
      provider: 'db_direct',
      model: 'local',
      metadata: {
        intent: classifierResult.intent,
        answeredBy: 'db_direct',
        route: 'DIRECT_PLAN_INFO',
        classifier: classifierResult,
      },
    }
  } else if (classifierResult.intent === 'cheapest_long_term_plan') {
    const plans = toolData.activePlans || toolData.plans || []
    payload = buildCheapestLongTermAnswer({ query: normalizedQuery, plans, language: lang })
  } else if (classifierResult.intent === 'checkin_goal') {
    payload = buildCheckinGoalAnswer({ query: normalizedQuery, toolData, language: lang })
  } else if (classifierResult.intent === 'pt_advice' || classifierResult.intent === 'pt_info') {
    payload = buildPtAdviceAnswer({ query: normalizedQuery, toolData, language: lang })
  } else if (classifierResult.intent === 'pt_availability') {
    payload = buildPtAvailabilityAnswer({ toolData, language: lang })
  } else if (classifierResult.intent === 'policy_refund' || classifierResult.intent === 'policy_privacy' || classifierResult.intent === 'policy_payment') {
    const policyFallback = buildPolicyFallbackAnswer({ query: normalizedQuery, toolData, language: lang })
    payload = {
      type: 'policy_answer',
      answer: policyFallback.answer,
      data: toolData,
      cards: policyFallback.cards,
      suggestions: getDomainSuggestions(classifierResult.intent, lang),
      mode: 'gym',
      provider: 'rule_based',
      model: 'local',
    }
  } else if (
    classifierResult.intent === 'membership_advice'
    && hasPlanPtAdviceQuestion(normalizedQuery)
    && (normalizeVietnameseMoney(reasoningQuery) || semanticMemory.budget)
    && findPtMembershipPlan(toolData.activePlans || toolData.plans || [])
  ) {
    payload = buildPtPlanBudgetAdvicePayload({ query: reasoningQuery, toolData, language: lang })
  } else if (classifierResult.intent === 'workout_info' && hasWorkoutFrequencyIntent(normalizedQuery)) {
    payload = buildWorkoutFrequencyAnswer({ query: normalizedQuery, toolData, language: lang })
  } else if (hasAnyProviderConfigured()) {
    try {
      const systemPrompt = buildAnswerGeneratorSystemPrompt(lang)
      const contextPrompt = buildAnswerGeneratorContextPrompt({
        query: normalizedQuery,
        recentConversation: conversationContext?.recentMessages || [],
        semanticMemory,
        classifierResult,
        toolData,
        language: lang,
      })
      
      const result = await runAIWithFallback({
        systemPrompt,
        context: contextPrompt,
        userQuestion: normalizedQuery,
        language: lang,
      }, {
        thinkingBudget: 512,
        temperature: 0.25,
        maxTokens: 1000,
        timeoutMs: 10_000,
      })
      
      const aiAnswerPayload = parseAiJsonPayload(result.text, getParseFailureAnswer(lang))
      const plansList = toolData.activePlans || toolData.plans || []
      const recommendedPlan = plansList.find(p => idsEqual(p._id, aiAnswerPayload.recommendedPlanId)) || null
      const alternativePlans = Array.isArray(aiAnswerPayload.alternativePlanIds)
        ? aiAnswerPayload.alternativePlanIds.map(id => plansList.find(p => idsEqual(p._id, id))).filter(Boolean)
        : []
      const desiredType = normalizeResponseType(aiAnswerPayload.type, classifierResult.intent)
      const cardType = ['plan_detail', 'plan_list'].includes(desiredType)
      const showRecommendationCard = aiAnswerPayload.type === 'plan_recommend'
        && recommendedPlan
        && (classifierResult.intent === 'membership_advice' || classifierResult.intent === 'membership_info' || classifierResult.intent === 'plan_comparison')
        && !asksPlanBenefitQuestion(normalizedQuery)
      const responseType = showRecommendationCard ? 'plan_recommend' : desiredType
      const answerReason = splitReadableItems(aiAnswerPayload.reason || aiAnswerPayload.reasons)
      const recommendationConclusion = String(aiAnswerPayload.conclusion || '').trim()
        || (recommendedPlan
          ? (lang === 'en'
            ? `Choose ${recommendedPlan.nameEn || recommendedPlan.nameVi}.`
            : `Bạn nên chọn ${recommendedPlan.nameVi || recommendedPlan.nameEn}.`)
          : '')
      const formattedRecommendationAnswer = showRecommendationCard
        ? formatReadableAnswer({
            conclusion: recommendationConclusion,
            reasons: answerReason.length > 0 ? answerReason : aiAnswerPayload.answer,
            alternativeTitle: lang === 'en' ? 'Alternative options' : 'Lựa chọn thay thế',
            alternatives: alternativePlans.slice(0, 2).map(plan => lang === 'en'
              ? `${plan.nameEn || plan.nameVi} if it fits your budget better.`
              : `${plan.nameVi || plan.nameEn} nếu bạn muốn phương án phù hợp ngân sách hơn.`),
            lang
          })
        : ''
      const finalAnswer = formattedRecommendationAnswer || aiAnswerPayload.answer || ''
      const finalReason = answerReason.length > 0
        ? answerReason
        : (showRecommendationCard ? splitReadableItems(aiAnswerPayload.answer).slice(0, 4) : [])
      const comparePlans = [recommendedPlan, ...alternativePlans].filter(Boolean).slice(0, 2)
      const renderedPlans = responseType === 'plan_list'
          ? plansList
          : []
      const cardPayload = showRecommendationCard
        ? {
            type: 'plan_recommend',
            recommendedPlan,
            alternatives: alternativePlans.slice(0, 2),
            conclusion: recommendationConclusion,
            reason: finalReason,
          }
        : responseType === 'plan_detail' && recommendedPlan
          ? { type: 'plan_detail', plan: recommendedPlan }
        : responseType === 'plan_list'
            ? { type: 'plan_list', plans: plansList }
            : null
      const cards = pickCardsForType({ type: responseType, toolData, recommendedPlan, alternativePlans })
        
      payload = {
        type: responseType,
        answer: finalAnswer,
        conclusion: showRecommendationCard ? recommendationConclusion : (aiAnswerPayload.conclusion || null),
        action: aiAnswerPayload.action && typeof aiAnswerPayload.action === 'object' ? aiAnswerPayload.action : null,
        recommendedPlan: showRecommendationCard ? recommendedPlan : null,
        plans: responseType === 'plan_list' ? renderedPlans : [],
        cards,
        suggestions: aiAnswerPayload.suggestions || [],
        mode: 'gym',
        data: {
          availablePlans: plansList,
          activePlans: plansList,
          ...toolData
        },
        planPayload: cardPayload,
        ...(showRecommendationCard ? {
          recommendedPlan,
          alternatives: alternativePlans,
          conclusion: recommendationConclusion,
          reason: finalReason
        } : {}),
        provider: result.provider,
        model: result.model,
        metadata: {
          intent: classifierResult.intent,
          answeredBy: 'ai',
          route: 'AI_REASONING',
          provider: result.provider,
          model: result.model,
          usedFallback: false,
          classifier: classifierResult
        }
      }
      provider = result.provider
      model = result.model
    } catch (err) {
      console.error('Answer Generator error, falling back to local reasoning:', err)
    }
  }
  
  if (!payload) {
    payload = buildRuleBasedFallbackAnswer({
      query: classifierResult.intent === 'membership_advice' ? reasoningQuery : normalizedQuery,
      classifierResult,
      toolData,
      language: lang,
    })
  }

  if (
    (classifierResult.intent === 'membership_advice' || classifierResult.intent === 'plan_comparison' || classifierResult.intent === 'workout_advice' || classifierResult.intent === 'health_advice')
    && countAdviceSignals(normalizedQuery, classifierResult) >= 2
    && !isVagueAdviceQuery(normalizedQuery)
    && answerLooksLikePrematureClarification(payload?.answer || '')
  ) {
    payload = {
      ...buildEnoughInfoAdviceFallback({ query: normalizedQuery, toolData, language: lang }),
      metadata: {
        ...(payload?.metadata || {}),
        intent: classifierResult.intent,
        answeredBy: 'rule_guard',
        classifier: classifierResult,
        replacedPrematureClarification: true,
      },
    }
  }

  if (
    (classifierResult.intent === 'membership_advice' || classifierResult.intent === 'plan_comparison')
    && (
      payload?.type === 'product_recommend'
      || payload?.type === 'product_list'
      || (normalizeVietnameseMoney(normalizedQuery) && Array.isArray(toolData.activePlans) && toolData.activePlans.length > 0 && !payload?.recommendedPlan)
      || /\b(shop gympro|du lieu shop|dữ liệu shop|san pham|sản phẩm)\b/i.test(payload?.answer || '')
      || (!asksPlanBenefitQuestion(normalizedQuery) && /\b(chua ghi nhan quyen loi|chưa ghi nhận quyền lợi)\b/i.test(normalizeForIntent(payload?.answer || '')))
    )
  ) {
    payload = {
      ...buildMembershipAdvicePayload({ query: reasoningQuery, toolData, language: lang }),
      metadata: {
        ...(payload?.metadata || {}),
        intent: classifierResult.intent,
        replacedWrongMembershipDomain: true,
      },
    }
  }

  if (classifierResult.intent === 'checkin_goal' && !/\b(con thieu|thiếu|still need|need)\b/i.test(payload?.answer || '')) {
    payload = {
      ...buildCheckinGoalAnswer({ query: normalizedQuery, toolData, language: lang }),
      metadata: {
        ...(payload?.metadata || {}),
        intent: classifierResult.intent,
        replacedMissingCheckinGoalMath: true,
      },
    }
  }

  if (classifierResult.intent === 'pt_availability' && (payload?.type === 'booking_list' || /\b(lich sap toi|lịch sắp tới|upcoming booking|ban dang co|bạn đang có)\b/i.test(payload?.answer || ''))) {
    payload = {
      ...buildPtAvailabilityAnswer({ toolData, language: lang }),
      metadata: {
        ...(payload?.metadata || {}),
        intent: classifierResult.intent,
        replacedBookingInfoForPtAvailability: true,
      },
    }
  }

  if ((classifierResult.intent === 'policy_faq' || classifierResult.intent?.startsWith('policy_') || classifierResult.intent === 'faq_answer') && answerLooksLikeGenericPolicyStub(payload?.answer || '')) {
    const policyFallback = buildPolicyFallbackAnswer({ query: normalizedQuery, toolData, language: lang })
    payload = {
      ...payload,
      type: 'policy_answer',
      answer: policyFallback.answer,
      cards: policyFallback.cards,
      metadata: {
        ...(payload?.metadata || {}),
        intent: classifierResult.intent,
        replacedGenericPolicyStub: true,
      },
    }
  }

  if (classifierResult.intent === 'policy_refund' && /\b(bao mat|bảo mật|privacy|du lieu ca nhan|dữ liệu cá nhân)\b/i.test(payload?.answer || '')) {
    const policyFallback = buildPolicyFallbackAnswer({ query: normalizedQuery, toolData, language: lang })
    payload = {
      ...payload,
      type: 'policy_answer',
      answer: policyFallback.answer,
      cards: policyFallback.cards,
      suggestions: getDomainSuggestions('policy_refund', lang),
      metadata: {
        ...(payload?.metadata || {}),
        intent: classifierResult.intent,
        replacedPrivacyForRefund: true,
      },
    }
  }

  payload = applyMedicalSafetyGuard(payload, normalizedQuery, lang)

  const parseFailureAnswer = getParseFailureAnswer(lang)
  payload = {
    ...(payload || {}),
    answer: normalizeFinalAnswerText(cleanAiOutput(payload?.answer || '', { fallbackAnswer: parseFailureAnswer })),
  }
  if (/^\s*\{[\s\S]*\}\s*$/.test(payload.answer || '')) {
    payload.answer = parseFailureAnswer
  }

  if (!Array.isArray(payload?.suggestions) || payload.suggestions.length === 0) {
    payload = {
      ...payload,
      suggestions: getDomainSuggestions(classifierResult.intent, lang),
    }
  }

  if (!String(payload?.answer || '').trim()) {
    payload = {
      ...(payload || {}),
      type: payload?.type || 'text_advice',
      answer: lang === 'en'
        ? 'I do not have enough data to answer accurately. Could you clarify a little more?'
        : 'Mình chưa có đủ dữ liệu để trả lời chính xác. Bạn có thể nói rõ hơn một chút không?',
      suggestions: payload?.suggestions?.length ? payload.suggestions : getDomainSuggestions(classifierResult.intent, lang),
    }
  }
  payload = applyRenderGate(payload, classifierResult)
  payload.metadata = { ...(payload.metadata || {}), answerLanguage: lang, questionAnalysis: classifierResult, classifierSource, semanticMemory }
  
  console.log('[TYPE]', payload.type)
  console.log('[CLEAN_OUTPUT]', String(payload.answer || '').slice(0, 120))
  console.log('[FINAL_TYPE]', payload.type)
  console.log('[FINAL_ANSWER]', String(payload.answer || '').slice(0, 120))
  console.log('[FINAL ANSWER]', String(payload.answer || '').slice(0, 100))
  console.log('[AI_PROVIDER]', payload.provider || provider, payload.model || model)
  console.log('[AI_AUDIT]', {
    userMessage: normalizedQuery,
    classifierSource,
    subject: classifierResult.subject,
    action: classifierResult.action,
    intent: classifierResult.intent,
    tools: classifierResult.tools,
    shouldRenderCard: classifierResult.shouldRenderCard,
    responseType: payload.type,
    provider: payload.provider || provider,
    model: payload.model || model,
    language: lang,
    semanticMemory: {
      lastIntent: semanticMemory.lastIntent,
      lastSubject: semanticMemory.lastSubject,
      isSupplemental: semanticMemory.isSupplemental,
    },
    hasPlanPayload: Boolean(payload.planPayload),
    finalAnswerPreview: String(payload.answer || '').slice(0, 160),
  })
  
  return payload
}

export const __aiClassifierTestHooks = {
  buildDefaultClassifier,
  normalizeClassifierResult,
  buildSemanticConversationMemory,
  buildPlanInfoDirectAnswer,
  buildPtPlanBudgetAdvicePayload,
  buildCheapestLongTermAnswer,
  hasCheapestLongTermIntent,
  resolveClarificationFollowUp,
}
