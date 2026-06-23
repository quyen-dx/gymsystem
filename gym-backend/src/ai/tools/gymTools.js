import mongoose from 'mongoose'
import Booking from '../../models/Booking.js'
import CheckIn from '../../models/CheckIn.js'
import Membership from '../../models/Membership.js'
import Plan from '../../models/Plan.js'
import Product from '../../models/Product.js'
import User from '../../models/User.js'
import PT from '../../models/PT.js'
import PTSchedule from '../../models/PTSchedule.js'
import { invalidatePersonalContextCache } from '../../services/conversationContextCache.js'
import { createMembership as createMembershipService } from '../../services/membershipService.js'
import { searchFaqs, searchPolicies } from '../services/faqPolicySearchService.js'
import { getSmartRecommendations } from '../services/smartRecommendService.js'
import { analyzeWorkoutHistory, generateWorkoutPlan } from '../services/workoutAnalyzerService.js'

const toObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`${fieldName} không hợp lệ`)
    error.statusCode = 400
    throw error
  }
  return new mongoose.Types.ObjectId(value)
}

const normalizeDateOnly = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const error = new Error('Ngày đặt lịch không hợp lệ')
    error.statusCode = 400
    throw error
  }
  date.setHours(0, 0, 0, 0)
  return date
}

const buildSearchRegex = (value = '') => {
  const terms = String(value)
    .split(/[\s,;|]+/)
    .map((term) => term.trim())
    .filter(Boolean)
  if (terms.length === 0) return /.*/i
  return new RegExp(terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
}

const calculateRemainingDays = (endDate) => {
  const now = new Date()
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}

const DAY_LABELS = { vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
const SHIFT_LABELS = { vi: { morning: 'Sáng', afternoon: 'Chiều', evening: 'Tối' }, en: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' } }

const buildScheduleLabel = (schedules, lang = 'vi') => {
  if (!schedules || schedules.length === 0) return ''
  const days = DAY_LABELS[lang]
  const shifts = SHIFT_LABELS[lang]
  const grouped = {}
  for (const s of schedules) {
    const dayLabel = days[s.dayOfWeek] || `Day${s.dayOfWeek}`
    const shiftLabel = shifts[s.shift] || s.shift
    if (!grouped[dayLabel]) grouped[dayLabel] = []
    if (!grouped[dayLabel].includes(shiftLabel)) grouped[dayLabel].push(shiftLabel)
  }
  return Object.entries(grouped)
    .map(([day, shiftList]) => `${day}: ${shiftList.join(', ')}`)
    .join(' | ')
}

export const gymToolDeclarations = [
  {
    name: 'getAvailablePlans',
    description: 'Lấy danh sách tất cả các gói tập gym (membership plans) đang được cung cấp tại phòng tập.',
    parametersJsonSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getMembershipInfo',
    description: 'Lấy thông tin gói tập hiện tại của user đang đăng nhập.',
    parametersJsonSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'createMembership',
    description: 'Đăng ký hoặc gia hạn gói tập cho user hiện tại bằng planId cụ thể.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'MongoDB id của user hiện tại' },
        planId: { type: 'string', description: 'MongoDB id của gói tập muốn đăng ký' },
      },
      required: ['userId', 'planId'],
    },
  },
  {
    name: 'getUpcomingBookings',
    description: 'Lấy danh sách lịch PT sắp tới của user đang đăng nhập.',
    parametersJsonSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getAvailablePTs',
    description: 'Tìm PT phù hợp theo chuyên môn, mục tiêu tập luyện hoặc từ khóa.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        specialization: { type: 'string', description: 'Ví dụ: tăng cơ, giảm cân, cardio.' },
      },
    },
  },
  {
    name: 'getRecommendedProducts',
    description: 'Gợi ý sản phẩm shop phù hợp với mục tiêu tập luyện.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Ví dụ: tăng cơ, giảm cân, cardio, whey.' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'createBookingRequest',
    description: 'Tạo yêu cầu đặt lịch với PT nếu slot còn trống.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        ptId: { type: 'string', description: 'MongoDB id của PT.' },
        date: { type: 'string', description: 'Ngày đặt lịch dạng YYYY-MM-DD hoặc ISO date.' },
        slot: { type: 'string', description: 'Khung giờ, ví dụ 19:00 hoặc 19:00-20:00.' },
        note: { type: 'string', description: 'Ghi chú đặt lịch.' },
      },
      required: ['ptId', 'date', 'slot'],
    },
  },
  {
    name: 'getCheckinStats',
    description: 'Lấy thống kê điểm danh (check-in) của user: tổng số lần, số lần trong tháng/tuần, lần gần nhất, chuỗi điểm danh liên tiếp.',
    parametersJsonSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getSmartRecommendations',
    description: 'Đưa ra gợi ý thông minh kết hợp gói tập, PT, và sản phẩm dựa trên mục tiêu, ngân sách, tần suất tập của user.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Mục tiêu tập luyện: muscle_gain, fat_loss, weight_gain, endurance, general_fitness' },
        budget: { type: 'string', description: 'Ngân sách, ví dụ: 500k/tháng, 2 triệu, 1 củ' },
        frequency: { type: 'string', description: 'Tần suất tập, ví dụ: 3 buổi/tuần, 5 lần/tuần' },
      },
    },
  },
  {
    name: 'analyzeWorkout',
    description: 'Phân tích lịch sử tập luyện của user: tần suất, điểm mạnh, điểm cần cải thiện, gợi ý cải thiện.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'Kỳ phân tích: 7d, 30d, 90d, all' },
      },
    },
  },
  {
    name: 'generateWorkoutPlan',
    description: 'Tạo giáo án tập luyện chi tiết theo mục tiêu, tần suất, level của user.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Mục tiêu: muscle_gain, fat_loss, weight_gain, endurance, general_fitness' },
        frequency: { type: 'string', description: 'Số buổi/tuần, vd: 3, 4, 5' },
        level: { type: 'string', description: 'Trình độ: beginner, intermediate' },
      },
    },
  },
  {
    name: 'searchFaqs',
    description: 'Tìm FAQ đã publish trong database cho câu hỏi hướng dẫn, tài khoản, đăng nhập, gói tập, đặt lịch, check-in, thanh toán hoặc hỗ trợ.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Câu hỏi của user.' },
        category: { type: 'string', description: 'Category ưu tiên, ví dụ: Tài khoản, Gói tập, Đặt lịch, Check-in, Thanh toán.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'searchPolicies',
    description: 'Tìm Policy đã publish trong database cho câu hỏi về chính sách, hoàn tiền, thanh toán, bảo mật, điều khoản, hội viên, bảo lưu hoặc quy định.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Câu hỏi của user.' },
        category: { type: 'string', description: 'Category ưu tiên, ví dụ: Hoàn tiền, Thanh toán, Bảo mật, Chính sách.' },
      },
      required: ['query'],
    },
  },
]

export const getAvailablePlans = async () => {
  const plans = await Plan.find({ isActive: true })
    .select('name nameVi nameEn price durationDays description descriptionVi descriptionEn featuresVi featuresEn color updatedAt')
    .sort({ price: 1 })
    .lean()

  return {
    count: plans.length,
    plans: plans.map((p) => ({
      id: p._id,
      _id: p._id,
      name: p.name || p.nameVi || p.nameEn,
      nameVi: p.nameVi || p.name,
      nameEn: p.nameEn || p.name,
      price: p.price,
      duration: `${p.durationDays} ngày`,
      durationDays: p.durationDays,
      description: p.description,
      descriptionVi: p.descriptionVi || p.description,
      descriptionEn: p.descriptionEn || p.description,
      featuresVi: p.featuresVi || [],
      featuresEn: p.featuresEn || [],
      color: p.color || '#000',
      updatedAt: p.updatedAt,
    })),
  }
}

export const getMembershipInfo = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const membership = await Membership.findOne({ memberId })
    .sort({ endDate: -1 })
    .populate('planId', 'name durationDays price')
    .lean()

  if (!membership) {
    return {
      found: false,
      message: 'Bạn chưa có gói tập nào trong hệ thống.',
    }
  }

  const remainingDays = calculateRemainingDays(membership.endDate)
  const status = remainingDays <= 0 && membership.status === 'active' ? 'expired' : membership.status

  return {
    found: true,
    planName: membership.planId?.name || 'Gói tập',
    startDate: membership.startDate,
    endDate: membership.endDate,
    remainingDays,
    status,
  }
}

export const createMembership = async ({ userId, planId }) => {
  return createMembershipService({ userId, planId })
}

const computeStreak = (checkins) => {
  if (checkins.length === 0) return 0
  let streak = 1
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const lastDate = new Date(checkins[0].checkinTime)
  lastDate.setHours(0, 0, 0, 0)
  if (Math.floor((today - lastDate) / (24 * 60 * 60 * 1000)) > 1) return 0
  for (let i = 1; i < checkins.length; i++) {
    const curr = new Date(checkins[i].checkinTime)
    curr.setHours(0, 0, 0, 0)
    const prev = new Date(checkins[i - 1].checkinTime)
    prev.setHours(0, 0, 0, 0)
    if (Math.floor((prev - curr) / (24 * 60 * 60 * 1000)) === 1) streak++
    else break
  }
  return streak
}

export const getCheckinStats = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const allCheckins = await CheckIn.find({ memberId, status: 'success' })
    .sort({ checkinTime: -1 })
    .lean()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let thisMonth = 0, thisWeek = 0, last30Days = 0
  let lastCheckin = null, todayCheckinTime = null
  for (const c of allCheckins) {
    const ct = new Date(c.checkinTime)
    if (ct >= startOfMonth) thisMonth++
    if (ct >= startOfWeek) thisWeek++
    if (ct >= thirtyDaysAgo) last30Days++
    if (!lastCheckin) lastCheckin = ct
    if (ct >= todayStart && !todayCheckinTime) todayCheckinTime = ct
  }

  return {
    stats: {
      total: allCheckins.length,
      thisMonth,
      thisWeek,
      last30Days,
      lastCheckin,
      todayCheckinTime,
      streak: computeStreak(allCheckins),
    },
  }
}

export const getUpcomingBookings = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const bookings = await Booking.find({
    memberId,
    date: { $gte: today },
    status: { $ne: 'cancelled' },
  })
    .sort({ date: 1, slot: 1 })
    .limit(10)
    .populate('ptId', 'name avatar specialties rating')
    .lean()

  return {
    count: bookings.length,
    bookings: bookings.map((booking) => ({
      id: booking._id,
      ptId: booking.ptId?._id,
      ptName: booking.ptId?.name || 'PT',
      specialties: booking.ptId?.specialties || [],
      date: booking.date,
      slot: booking.slot,
      note: booking.note,
      status: booking.status,
    })),
  }
}

export const getAvailablePTs = async ({ specialization = '' } = {}) => {
  const keyword = String(specialization || '').trim()
  let pts = []
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const baseFilter = { role: 'pt', isActive: true }
    // Step 1: exact name match (phrase)
    pts = await User.find({ ...baseFilter, name: new RegExp('^' + escaped + '$', 'i') })
      .select('name avatar phone email contactEmail specialties rating experienceYears bio')
      .sort({ rating: -1, experienceYears: -1 })
      .limit(8)
      .lean()
    // Step 2: partial name match (phrase contains)
    if (pts.length === 0) {
      pts = await User.find({ ...baseFilter, name: new RegExp(escaped, 'i') })
        .select('name avatar phone email contactEmail specialties rating experienceYears bio')
        .sort({ rating: -1, experienceYears: -1 })
        .limit(8)
        .lean()
    }
    // Step 3: broad search on name/bio/specialties
    if (pts.length === 0) {
      const broadRegex = new RegExp(keyword.split(/[\s,;|]+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
      pts = await User.find({ ...baseFilter, $or: [{ name: broadRegex }, { bio: broadRegex }, { specialties: broadRegex }] })
        .select('name avatar phone email contactEmail specialties rating experienceYears bio')
        .sort({ rating: -1, experienceYears: -1 })
        .limit(8)
        .lean()
    }
  } else {
    pts = await User.find({ role: 'pt', isActive: true })
      .select('name avatar phone email contactEmail specialties rating experienceYears bio')
      .sort({ rating: -1, experienceYears: -1 })
      .limit(8)
      .lean()
  }

  // Fetch PT model records + schedules for each
  const ptModels = await PT.find({ userId: { $in: pts.map((p) => p._id) } }).select('_id userId totalSessions totalStudents certificates').lean()
  const ptModelMap = {}
  for (const pm of ptModels) {
    ptModelMap[String(pm.userId)] = pm
  }
  const ptIds = ptModels.map((p) => p._id)
  const scheduleDocs = ptIds.length > 0 ? await PTSchedule.find({ ptId: { $in: ptIds } }).sort({ dayOfWeek: 1 }).lean() : []

  return {
    count: pts.length,
    pts: pts.map((pt) => {
      const pm = ptModelMap[String(pt._id)]
      const schedules = pm ? scheduleDocs.filter((s) => String(s.ptId) === String(pm._id)) : []
      return {
        id: pt._id,
        name: pt.name,
        avatar: pt.avatar || '',
        phone: pt.phone || '',
        email: pt.email || pt.contactEmail || '',
        specialties: pt.specialties || [],
        rating: pt.rating || 0,
        experienceYears: pt.experienceYears || 0,
        bio: pt.bio || '',
        totalSessions: pm?.totalSessions || 0,
        totalStudents: pm?.totalStudents || 0,
        schedule: buildScheduleLabel(schedules),
        scheduleRaw: schedules.map((s) => ({ dayOfWeek: s.dayOfWeek, shift: s.shift })),
      }
    }),
  }
}

export const getRecommendedProducts = async ({ goal = '' } = {}) => {
  const keyword = String(goal || '').trim()
  const goalMap = {
    'tăng cơ': ['whey', 'protein', 'mass', 'creatine', 'tăng cơ'],
    'giam can': ['fat burn', 'giảm cân', 'cardio', 'l-carnitine'],
    'giảm cân': ['fat burn', 'giảm cân', 'cardio', 'l-carnitine'],
    cardio: ['cardio', 'giày', 'nước', 'đai'],
  }
  const normalized = keyword.toLowerCase()
  const terms = goalMap[normalized] || [keyword]
  const queryRegex = buildSearchRegex(terms.join(' '))

  const products = await Product.find({
    isActive: true,
    stock: { $gt: 0 },
    $or: [
      { name: queryRegex },
      { category: queryRegex },
      { description: queryRegex },
    ],
  })
    .select('name price category image images stock rating reviewCount')
    .sort({ rating: -1, stock: -1, createdAt: -1 })
    .limit(8)
    .lean()

  return {
    count: products.length,
    goal: keyword,
    products: products.map((product) => ({
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.image || product.images?.[0] || '',
      stock: product.stock,
      rating: product.rating || 0,
      reviewCount: product.reviewCount || 0,
      link: `/dashboard/member/store/${product._id}`,
    })),
  }
}

export const createBookingRequest = async ({ userId, ptId, date, slot, note = '' }) => {
  const memberId = toObjectId(userId, 'userId')
  const trainerId = toObjectId(ptId, 'ptId')
  const bookingDate = normalizeDateOnly(date)
  const normalizedSlot = String(slot || '').trim()

  if (!normalizedSlot) {
    const error = new Error('Slot đặt lịch không được để trống')
    error.statusCode = 400
    throw error
  }

  const pt = await User.findOne({ _id: trainerId, role: 'pt', isActive: true }).select('name specialties').lean()
  if (!pt) {
    const error = new Error('Không tìm thấy PT phù hợp')
    error.statusCode = 404
    throw error
  }

  const existing = await Booking.findOne({
    ptId: trainerId,
    date: bookingDate,
    slot: normalizedSlot,
    status: { $ne: 'cancelled' },
  }).lean()

  if (existing) {
    return {
      created: false,
      reason: 'slot_unavailable',
      message: 'Slot này đã có người đặt. Bạn hãy chọn khung giờ khác.',
    }
  }

  const booking = await Booking.create({
    memberId,
    ptId: trainerId,
    date: bookingDate,
    slot: normalizedSlot,
    note: String(note || '').slice(0, 500),
  })
  invalidatePersonalContextCache(memberId)

  return {
    created: true,
    booking: {
      id: booking._id,
      ptId: trainerId,
      ptName: pt.name,
      date: booking.date,
      slot: booking.slot,
      note: booking.note,
      status: booking.status,
    },
  }
}

export const getSmartRecommendationsHandler = async ({ userId, goal, budget, frequency }) => {
  const query = [goal, budget, frequency].filter(Boolean).join(' ')
  return getSmartRecommendations({ userId, query })
}

export const analyzeWorkoutHandler = async ({ userId, period = '30d' }) => {
  const analysis = await analyzeWorkoutHistory({ userId, period })
  return {
    type: 'workout_analyzer',
    ...analysis,
  }
}

export const generateWorkoutPlanHandler = async ({ userId, goal = 'general_fitness', frequency = 4, level = 'beginner' }) => {
  const plan = await generateWorkoutPlan({ userId, goal, frequency: parseInt(frequency, 10) || 4, level })
  return { type: 'workout_plan', ...plan }
}

export const gymTools = {
  getAvailablePlans,
  getMembershipInfo,
  createMembership,
  getCheckinStats,
  getUpcomingBookings,
  getAvailablePTs,
  getRecommendedProducts,
  createBookingRequest,
  getSmartRecommendations: getSmartRecommendationsHandler,
  analyzeWorkout: analyzeWorkoutHandler,
  generateWorkoutPlan: generateWorkoutPlanHandler,
  searchFaqs,
  searchPolicies,
}

export const runGymTool = async (name, args, context) => {
  const tool = gymTools[name]
  if (!tool) {
    const error = new Error(`Tool ${name} không được hỗ trợ`)
    error.statusCode = 400
    throw error
  }

  // Security boundary: never trust model-supplied userId.
  return tool({ ...(args || {}), userId: context.userId })
}
