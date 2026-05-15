import mongoose from 'mongoose'
import Booking from '../../models/Booking.js'
import Membership from '../../models/Membership.js'
import Plan from '../../models/Plan.js'
import Product from '../../models/Product.js'
import User from '../../models/User.js'
import { createMembership as createMembershipService } from '../../services/membershipService.js'

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
]

export const getAvailablePlans = async () => {
  const plans = await Plan.find({ isActive: true })
    .select('name price durationDays description color')
    .sort({ price: 1 })
    .lean()

  return {
    count: plans.length,
    plans: plans.map((p) => ({
      id: p._id,
      name: p.name,
      price: p.price,
      duration: `${p.durationDays} ngày`,
      description: p.description,
      color: p.color || '#000',
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
  const queryRegex = buildSearchRegex(keyword)
  const filter = {
    role: 'pt',
    isActive: true,
    ...(keyword
      ? {
        $or: [
          { name: queryRegex },
          { bio: queryRegex },
          { specialties: queryRegex },
        ],
      }
      : {}),
  }

  const pts = await User.find(filter)
    .select('name avatar specialties rating experienceYears bio')
    .sort({ rating: -1, experienceYears: -1 })
    .limit(8)
    .lean()

  return {
    count: pts.length,
    pts: pts.map((pt) => ({
      id: pt._id,
      name: pt.name,
      avatar: pt.avatar || '',
      specialties: pt.specialties || [],
      rating: pt.rating || 0,
      experienceYears: pt.experienceYears || 0,
      bio: pt.bio || '',
    })),
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

export const gymTools = {
  getAvailablePlans,
  getMembershipInfo,
  createMembership,
  getUpcomingBookings,
  getAvailablePTs,
  getRecommendedProducts,
  createBookingRequest,
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
