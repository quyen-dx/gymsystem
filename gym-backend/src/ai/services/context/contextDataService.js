import mongoose from 'mongoose'
import Booking from '../../../models/Booking.js'
import Faq from '../../../models/Faq.js'
import Feedback from '../../../models/Feedback.js'
import LandingContent from '../../../models/LandingContent.js'
import Membership from '../../../models/Membership.js'
import Order from '../../../models/Order.js'
import Plan from '../../../models/Plan.js'
import Policy from '../../../models/Policy.js'
import Product from '../../../models/Product.js'
import PT from '../../../models/PT.js'
import PTSchedule from '../../../models/PTSchedule.js'
import SystemSettings from '../../../models/SystemSettings.js'
import Transaction from '../../../models/Transaction.js'
import User from '../../../models/User.js'
import UserActivity from '../../../models/UserActivity.js'
import { contextCache } from '../../../services/conversationContextCache.js'
import { perfStart, perfEnd } from '../perfLogger.js'

const defaultGetUserDisplayName = (user, fallback = '') =>
  String(user?.fullName || user?.displayName || user?.name || fallback || '').trim()

let runtimeDeps = {
  getUserDisplayName: defaultGetUserDisplayName,
  getRole: (user) => user?.role || 'member',
  normalizeTimeRange: () => ({ label: 'unknown', start: null, end: null, raw: '' }),
  hasBookingActionIntent: () => false,
  memberIntents: new Set(),
}

export const configureContextDataService = (deps = {}) => {
  runtimeDeps = {
    ...runtimeDeps,
    ...deps,
    memberIntents: deps.memberIntents || runtimeDeps.memberIntents,
  }
}

export const toObjectIdOrNull = (value) => mongoose.Types.ObjectId.isValid(value)
  ? new mongoose.Types.ObjectId(value)
  : null

const ttlCache = new Map()
export const getCached = async (key, ttlSeconds, loader) => {
  const now = Date.now()
  const cached = ttlCache.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
  perfStart(`db:${key}`)
  const value = await loader()
  perfEnd(`db:${key}`)
  ttlCache.set(key, { value, expiresAt: now + ttlSeconds * 1000 })
  return value
}

export const invalidateAppCache = (key) => {
  if (!key) {
    ttlCache.clear()
    console.log('[APP_CACHE] invalidate: all')
    return
  }
  const deleted = ttlCache.delete(key)
  for (const cacheKey of ttlCache.keys()) {
    if (cacheKey.startsWith(key + ':')) {
      ttlCache.delete(cacheKey)
    }
  }
  console.log('[APP_CACHE] invalidate:', key, deleted || false)
}

export const invalidateAiPTCache = () => {
  // Invalidate all PT-related caches: when admin/PT updates profile, lock/unlock, or change specialties/schedule
  invalidateAppCache('ptList')
  invalidateAppCache('ptAvailability')
  invalidateAppCache('activePTs')
  console.log('[AI_CACHE] invalidate: PT data (ptList, ptAvailability, activePTs)')
}

const AI_DOMAIN_CACHE_KEYS = {
  plans: ['activePlans', 'plans'],
  pts: ['ptList', 'ptAvailability', 'activePTs'],
  products: ['products'],
  faqs: ['faqs'],
  policies: ['policies'],
  settings: ['systemSettings'],
  landing: ['landingCms'],
}

export const invalidateAiDomainCache = (domain) => {
  const normalized = String(domain || '').trim()
  const keys = AI_DOMAIN_CACHE_KEYS[normalized] || [normalized]
  keys.filter(Boolean).forEach((key) => invalidateAppCache(key))
  console.log('[AI_CACHE] invalidate domain:', normalized || 'all', keys)
}

export const getCollectionName = (module) => ({
  activePlans: 'plans',
  currentMembership: 'memberships',
  plans: 'plans',
  membership: 'memberships',
  membershipHistory: 'memberships',
  checkins: 'checkins',
  pt: 'users',
  ptAvailability: 'bookings',
  bookings: 'bookings',
  products: 'products',
  orders: 'orders',
  notifications: 'notifications',
  faqs: 'faqs',
  policies: 'policies',
  feedback: 'feedback',
  reports: 'reports',
  members: 'users',
  systemSettings: 'system_settings',
  landingCms: 'landingcontents',
}[module] || module)

export const getDocumentCount = (value) => {
  if (Array.isArray(value)) return value.length
  if (value?.count !== undefined) return Number(value.count) || 0
  if (value?.found === false) return 0
  if (value && typeof value === 'object') {
    if (value.totalPTs !== undefined) return Number(value.totalPTs) || 0
    if (Array.isArray(value.availablePTs)) return value.availablePTs.length
    if (Array.isArray(value.upcomingBookings)) return value.upcomingBookings.length
    if (Array.isArray(value.bookingHistory)) return value.bookingHistory.length
    return Object.keys(value).length > 0 ? 1 : 0
  }
  return value ? 1 : 0
}

export const getUpdatedAt = (value) => {
  const values = Array.isArray(value) ? value : [value]
  const timestamps = values
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      return [item.updatedAt, item.createdAt, item.endDate].filter(Boolean)
    })
    .map((item) => new Date(item).getTime())
    .filter(Number.isFinite)
  if (timestamps.length === 0) return null
  return new Date(Math.max(...timestamps)).toISOString()
}

export const logAiDataSource = ({ module, source = 'database', collection, value, cacheHit = false }) => { }

export const attachDataSource = (toolData, key, value, source = 'database', cacheHit = false) => {
  toolData[key] = value
  toolData._dataSources = {
    ...(toolData._dataSources || {}),
    [key]: {
      module: key,
      source,
      collection: getCollectionName(key),
      documentCount: getDocumentCount(value),
      cacheHit,
      updatedAt: getUpdatedAt(value),
    },
  }
  logAiDataSource({ module: key, source, value, cacheHit })
}

export const getConversationId = (conversationContext, user) => {
  const explicitId = conversationContext?.conversationId
    || conversationContext?.sessionId
    || conversationContext?.chatSessionId
  return String(explicitId || `user:${user?._id || 'anonymous'}`)
}

export const createCacheContext = ({ user, conversationContext }) => ({
  conversationId: getConversationId(conversationContext, user),
  userId: String(user?._id || 'anonymous'),
})

export const getContextCached = (cacheContext, key, ttlSeconds, loader, variant = '') => contextCache.getOrLoad({
  conversationId: cacheContext?.conversationId,
  userId: cacheContext?.userId,
  key,
  ttlSeconds,
  loader,
  variant,
})

export const calculateRemainingDays = (endDate) => {
  const end = new Date(endDate)
  if (Number.isNaN(end.getTime())) return 0
  end.setHours(23, 59, 59, 999)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}

export const serializeMembership = (membership) => {
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
    updatedAt: membership.updatedAt,
    remainingDays,
    status: remainingDays <= 0 && membership.status === 'active' ? 'expired' : membership.status,
  }
}

export const getLatestMembership = async (memberId) => Membership.findOne({ memberId })
  .sort({ endDate: -1 })
  .populate('planId', 'nameVi nameEn durationDays price descriptionVi descriptionEn featuresVi featuresEn color')
  .lean()

export const getActivePlans = async (limit = 12) => getCached('activePlans', 300, async () => {
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
    updatedAt: plan.updatedAt,
  }))
})

export const summarizeCheckinFrequency = (checkins = []) => {
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

export const getUpcomingBookings = async (memberId, limit = 8) => {
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

export const getRecentBookings = async (memberId, limit = 12) => {
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

export const serializeUserBrief = (user) => ({
  id: String(user?._id || ''),
  name: runtimeDeps.getUserDisplayName(user),
  email: user?.email || '',
  phone: user?.phone || '',
  role: user?.role || '',
  specialties: user?.specialties || [],
  rating: user?.rating || 0,
  experienceYears: user?.experienceYears || 0,
  bio: user?.bio || '',
  avatar: user?.avatar || '',
  certificates: user?.certificates || [],
  introVideoUrl: user?.introVideoUrl || '',
  totalSessions: user?.totalSessions || 0,
  totalStudents: user?.totalStudents || 0,
  schedule: user?.schedule || '',
  scheduleRaw: user?.scheduleRaw || [],
  reviewCount: user?.reviewCount || 0,
  latestReviews: user?.latestReviews || [],
  updatedAt: user?.updatedAt,
})

const PT_DAY_LABELS = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const PT_SHIFT_LABELS = {
  morning: 'Sáng',
  afternoon: 'Chiều',
  evening: 'Tối',
}
const PT_SHIFT_TIMES = {
  morning: '06:00 - 12:00',
  afternoon: '12:00 - 18:00',
  evening: '18:00 - 22:00',
}

const formatPTSchedule = (schedules = []) => {
  if (!Array.isArray(schedules) || schedules.length === 0) return ''
  const grouped = new Map()
  for (const schedule of schedules) {
    const day = Number(schedule.dayOfWeek)
    const dayLabel = PT_DAY_LABELS[day] || `Thứ ${day}`
    const shift = String(schedule.shift || '')
    const shiftText = [PT_SHIFT_LABELS[shift], PT_SHIFT_TIMES[shift]].filter(Boolean).join(' ')
    if (!grouped.has(dayLabel)) grouped.set(dayLabel, [])
    if (shiftText && !grouped.get(dayLabel).includes(shiftText)) grouped.get(dayLabel).push(shiftText)
  }
  return [...grouped.entries()]
    .map(([day, shifts]) => `${day}: ${shifts.join(', ')}`)
    .join('\n')
}

export const getMembershipHistory = async (memberId, limit = 6) => {
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

export const getCheckinContext = async (memberId) => {
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

export const estimateCheckinStreak = (checkins = []) => {
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

export const getPTList = async (limit = 8) => getCached('ptList', 120, async () => {
  const pts = await User.find({ role: 'pt', isActive: true, status: { $ne: 'locked' } })
    .select('name fullName displayName email phone avatar specialties rating experienceYears bio updatedAt')
    .sort({ rating: -1, experienceYears: -1 })
    .limit(limit)
    .lean()
  const ptProfiles = await PT.find({ userId: { $in: pts.map((pt) => pt._id) } }).lean()
  const ptProfileMap = new Map(ptProfiles.map((pt) => [String(pt.userId), pt]))
  const ptIds = ptProfiles.map((pt) => pt._id)
  const schedules = ptIds.length > 0 ? await PTSchedule.find({ ptId: { $in: ptIds } }).sort({ dayOfWeek: 1 }).lean() : []
  const scheduleMap = new Map()
  for (const schedule of schedules) {
    const key = String(schedule.ptId)
    if (!scheduleMap.has(key)) scheduleMap.set(key, [])
    scheduleMap.get(key).push(schedule)
  }
  const reviewStats = pts.length > 0
    ? await Booking.aggregate([
      { $match: { ptId: { $in: pts.map((pt) => pt._id) }, rating: { $gte: 1 } } },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: '$ptId',
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
          latestReviews: { $push: { rating: '$rating', comment: '$reviewComment' } },
        },
      },
    ])
    : []
  const reviewMap = new Map(reviewStats.map((item) => [String(item._id), item]))
  return pts.map((user) => {
    const profile = ptProfileMap.get(String(user._id)) || {}
    const profileSchedules = scheduleMap.get(String(profile._id)) || []
    const reviews = reviewMap.get(String(user._id)) || {}
    // Name priority: user.fullName > user.name > ptProfile.name
    const displayName = user.fullName?.trim() || user.displayName?.trim() || user.name?.trim() || profile.name?.trim() || ''
    return serializeUserBrief({
      ...user,
      name: displayName,
      specialties: profile.specialties || user.specialties || [],
      rating: reviews.avgRating ? Math.round(reviews.avgRating * 10) / 10 : (profile.rating ?? user.rating),
      experienceYears: profile.experienceYears ?? user.experienceYears,
      bio: profile.bio || user.bio || '',
      certificates: profile.certificates || [],
      introVideoUrl: profile.introVideoUrl || '',
      totalSessions: profile.totalSessions || 0,
      totalStudents: profile.totalStudents || 0,
      schedule: formatPTSchedule(profileSchedules),
      scheduleRaw: profileSchedules.map((schedule) => ({ dayOfWeek: schedule.dayOfWeek, shift: schedule.shift })),
      reviewCount: reviews.reviewCount || 0,
      latestReviews: Array.isArray(reviews.latestReviews)
        ? reviews.latestReviews.filter((review) => review.comment || review.rating).slice(0, 3)
        : [],
      updatedAt: profile.updatedAt && user.updatedAt
        ? new Date(Math.max(new Date(profile.updatedAt).getTime(), new Date(user.updatedAt).getTime()))
        : profile.updatedAt || user.updatedAt,
    })
  })
})

export const getPTAvailability = async (query, limit = 8, cacheContext = null) => {
  const range = runtimeDeps.normalizeTimeRange(query)
  const pts = await getPTList(limit)
  if (!range.start || !range.end) return { timeRange: range.label, totalPTs: pts.length, availablePTs: pts, busyBookings: [] }
  const bookings = await Booking.find({
    ptId: { $in: pts.map((pt) => pt.id).filter(Boolean) },
    date: { $gte: range.start, $lte: range.end },
    status: { $ne: 'cancelled' },
  }).populate('ptId', 'name').lean()
  const busyPtIds = new Set(bookings.map((booking) => String(booking.ptId?._id || booking.ptId)))
  const availablePTs = pts.filter((pt) => !busyPtIds.has(String(pt.id)))
  return {
    timeRange: range.label,
    totalPTs: pts.length,
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

export const getBookingContext = async (user, query, cacheContext = null) => {
  const userId = toObjectIdOrNull(user?._id)
  if (!userId) return { upcomingBookings: [], bookingHistory: [] }
  const role = runtimeDeps.getRole(user)
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
    ...(runtimeDeps.hasBookingActionIntent(query) ? { availableSlots: await getPTAvailability(query, 8, cacheContext) } : {}),
  }
}

export const serializeBookingBrief = (booking) => ({
  id: String(booking._id),
  date: booking.date,
  slot: booking.slot,
  status: booking.status,
  note: booking.note || '',
  ptName: booking.ptId?.name || '',
  memberName: booking.memberId?.name || '',
  updatedAt: booking.updatedAt,
})

export const getWorkoutContext = async (memberId) => {
  const workoutProgress = await getActivitiesByKeywords(memberId, ['workout', 'bài tập', 'tap luyen', 'training', 'session', 'completed'], 12)
  const goalActivities = await getActivitiesByKeywords(memberId, ['goal', 'mục tiêu', 'muc tieu', 'progress', 'tiến độ', 'tien do'], 6)
  return {
    currentWorkoutPlan: workoutProgress[0] || null,
    workoutProgress,
    completedSessions: workoutProgress.filter((item) => /completed|hoan thanh|hoàn thành/i.test(`${item.type} ${item.title} ${item.description}`)).length,
    trainingGoal: goalActivities[0] || null,
  }
}

export const getHealthContext = async (memberId) => {
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

export const getProducts = async (limit = 8) => getCached('products', 180, async () => {
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
    updatedAt: product.updatedAt,
  }))
})

export const getOrderHistory = async (user, limit = 8) => {
  const userId = toObjectIdOrNull(user?._id)
  if (!userId) return []
  const filter = runtimeDeps.getRole(user) === 'admin' ? {} : { userId, hiddenForUser: { $ne: true } }
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

export const getFaqs = async (limit = 8) => getCached('faqs', 600, async () => {
  const faqs = await Faq.find({ isPublished: true }).sort({ order: 1, createdAt: -1 }).limit(limit).lean()
  return faqs.map((faq) => ({
    id: String(faq._id),
    questionVi: faq.questionVi,
    questionEn: faq.questionEn,
    answerVi: faq.answerVi,
    answerEn: faq.answerEn,
    categoryVi: faq.categoryVi,
    categoryEn: faq.categoryEn,
    updatedAt: faq.updatedAt,
  }))
})

export const getPolicies = async (limit = 8) => getCached('policies', 600, async () => {
  const policies = await Policy.find({ isPublished: true }).sort({ createdAt: -1 }).limit(limit).lean()
  return policies.map((policy) => ({
    id: String(policy._id),
    titleVi: policy.titleVi,
    titleEn: policy.titleEn,
    categoryVi: policy.categoryVi,
    categoryEn: policy.categoryEn,
    contentVi: String(policy.contentVi || '').slice(0, 1200),
    contentEn: String(policy.contentEn || '').slice(0, 1200),
    updatedAt: policy.updatedAt,
  }))
})

export const getSystemSettingsContext = async () => getCached('systemSettings', 300, async () => {
  const doc = await SystemSettings.findOne({ singletonKey: 'global' }).lean()
  if (!doc) return { found: false }
  return {
    found: true,
    settings: doc.settings || {},
    updatedAt: doc.updatedAt,
  }
})

export const getLandingCmsContext = async (pageId = 'home') => getCached(`landingCms:${pageId}`, 300, async () => {
  const landing = await LandingContent.findOne({ pageId }).lean()
  if (!landing) return { found: false, pageId }
  return {
    found: true,
    pageId: landing.pageId || pageId,
    heroTitle: landing.heroTitle,
    heroSubtitle: landing.heroSubtitle,
    heroBadgeText: landing.heroBadgeText,
    ctaText: landing.ctaText,
    servicesTitle: landing.servicesTitle,
    testimonialsTitle: landing.testimonialsTitle,
    finalCtaTitle: landing.finalCtaTitle,
    aboutTitle: landing.aboutTitle,
    aboutContent: landing.aboutContent,
    stats: landing.stats || [],
    services: landing.services || [],
    testimonials: landing.testimonials || [],
    sections: landing.sections || [],
    updatedAt: landing.updatedAt,
  }
})

export const getFeedbackHistory = async (user, limit = 6) => {
  const userId = toObjectIdOrNull(user?._id)
  if (!userId) return []
  const filter = runtimeDeps.getRole(user) === 'admin' ? {} : { user: userId }
  const feedback = await Feedback.find(filter).sort({ createdAt: -1 }).limit(limit).populate('user', 'name fullName displayName').lean()
  return feedback.map((item) => ({
    id: String(item._id),
    title: item.title,
    type: item.type,
    priority: item.priority,
    status: item.status,
    adminReply: item.adminReply || '',
    userName: runtimeDeps.getUserDisplayName(item.user),
    createdAt: item.createdAt,
  }))
}

export const getNotifications = async (memberId) => getActivitiesByKeywords(memberId, ['notification', 'thông báo', 'thong bao', 'reminder', 'alert', 'nhắc lịch', 'nhac lich'], 8)

export const getDashboardStats = async () => {
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

export const getActivitiesByKeywords = async (memberId, keywords, limit = 12) => {
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

export const getMemberAssistantSnapshot = async (memberId) => {
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

export const fetchMemberContextByIntent = async ({ intent, user, reasoningMode = false }) => {
  const memberId = toObjectIdOrNull(user?._id)
  if (!memberId) return { intent, availableData: {}, missingData: ['memberId'] }

  const safeIntent = runtimeDeps.memberIntents.has(intent) ? intent : 'unknown'
  const base = {
    intent: safeIntent,
    member: {
      id: String(user?._id || ''),
      name: runtimeDeps.getUserDisplayName(user),
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
      name: runtimeDeps.getUserDisplayName(user),
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
