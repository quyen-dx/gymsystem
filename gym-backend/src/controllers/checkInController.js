import jwt from 'jsonwebtoken'
import CheckIn from '../models/CheckIn.js'
import Membership from '../models/Membership.js'
import User from '../models/User.js'
import Plan from '../models/Plan.js'
import { recordUserActivity } from '../services/userActivityService.js'

const getUserDisplayName = (user, fallback = '') =>
  String(user?.fullName || user?.displayName || user?.name || fallback || '').trim()
import AppError from '../utils/appError.js'

const QR_TOKEN_TTL = Number(process.env.QR_TOKEN_TTL) || 30
const DUPLICATE_WINDOW_MS = 60 * 60 * 1000
const VIETNAM_UTC_OFFSET = '+07:00'

const getVietnamDateString = () => {
  const now = new Date()
  const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return vietnamTime.toISOString().slice(0, 10)
}

const addDaysToDateString = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00${VIETNAM_UTC_OFFSET}`)
  date.setUTCDate(date.getUTCDate() + days)
  const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  return vietnamTime.toISOString().slice(0, 10)
}

const buildVietnamDateRange = ({ mode = 'today', date }) => {
  if (mode === 'all') return { selectedDate: '', startDate: null, endDate: null }

  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date) : getVietnamDateString()
  const today = getVietnamDateString()
  const todayStart = new Date(`${today}T00:00:00${VIETNAM_UTC_OFFSET}`)
  const todayEnd = new Date(`${today}T23:59:59.999${VIETNAM_UTC_OFFSET}`)

  if (mode === 'yesterday') {
    const yesterday = addDaysToDateString(today, -1)
    return {
      selectedDate: yesterday,
      startDate: new Date(`${yesterday}T00:00:00${VIETNAM_UTC_OFFSET}`),
      endDate: new Date(`${yesterday}T23:59:59.999${VIETNAM_UTC_OFFSET}`),
    }
  }

  if (mode === 'last7days' || mode === 'last30days') {
    const days = mode === 'last7days' ? 6 : 29
    const fromDate = addDaysToDateString(today, -days)
    return {
      selectedDate: today,
      startDate: new Date(`${fromDate}T00:00:00${VIETNAM_UTC_OFFSET}`),
      endDate: todayEnd,
    }
  }

  if (mode === 'today') {
    return {
      selectedDate: today,
      startDate: todayStart,
      endDate: todayEnd,
    }
  }

  return {
    selectedDate,
    startDate: new Date(`${selectedDate}T00:00:00${VIETNAM_UTC_OFFSET}`),
    endDate: new Date(`${selectedDate}T23:59:59.999${VIETNAM_UTC_OFFSET}`),
  }
}

const getActiveMembership = (memberId) => Membership.findOne({
  memberId,
  status: 'active',
  endDate: { $gte: new Date() },
})
  .populate('planId', 'nameVi nameEn durationDays price color')
  .sort({ endDate: -1 })

const resolveMemberFromCheckinPayload = async ({ token, memberId }) => {
  if (token) {
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      throw new AppError('Mã QR không hợp lệ hoặc đã hết hạn', 401)
    }

    if (decoded.purpose !== 'checkin' || !decoded.memberId) {
      throw new AppError('Mã QR không hợp lệ', 401)
    }

    const alreadyUsed = await CheckIn.findOne({ qrToken: token }).lean()
    if (alreadyUsed) {
      throw new AppError('Mã QR này đã được sử dụng', 409)
    }

    return User.findById(decoded.memberId)
  }

  const keyword = String(memberId || '').trim()
  if (!keyword) throw new AppError('QR token hoặc memberId là bắt buộc', 400)

  const query = Plan.db.base.Types.ObjectId.isValid(keyword)
    ? { _id: keyword }
    : {
        $or: [
          { memberCode: { $regex: `^${keyword}$`, $options: 'i' } },
          { phone: keyword },
          { email: { $regex: `^${keyword}$`, $options: 'i' } },
        ],
      }

  return User.findOne({ role: 'member', ...query })
}

const formatHistoryItem = (checkin, membershipByMemberId = {}) => {
  const member = checkin.memberId || {}
  const staff = checkin.staffId || {}
  const membership = membershipByMemberId[String(member._id)] || null
  const plan = membership?.planId

  return {
    checkinId: checkin._id,
    _id: checkin._id,
    checkinTime: checkin.checkinTime,
    memberId: member._id,
    memberCode: member.memberCode || '',
    memberName: getUserDisplayName(member, 'Thành viên'),
    email: member.email || '',
    phone: member.phone || '',
    planName: plan?.nameVi || plan?.nameEn || '',
    staffId: staff._id,
    staffName: getUserDisplayName(staff, 'Staff'),
    status: checkin.status,
    errorNote: checkin.errorNote || '',
    streakDay: checkin.streakDay || 0,
  }
}

const calculateStreak = async (memberId) => {
  const checkins = await CheckIn.find({ memberId, status: 'success' })
    .sort({ checkinTime: -1 })
    .lean()

  if (checkins.length === 0) return 0

  let streak = 1
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const lastCheckin = new Date(checkins[0].checkinTime)
  lastCheckin.setHours(0, 0, 0, 0)

  const diffFromToday = Math.floor((today - lastCheckin) / (24 * 60 * 60 * 1000))
  if (diffFromToday > 1) return 0

  for (let i = 1; i < checkins.length; i++) {
    const curr = new Date(checkins[i].checkinTime)
    curr.setHours(0, 0, 0, 0)
    const prev = new Date(checkins[i - 1].checkinTime)
    prev.setHours(0, 0, 0, 0)
    const diff = Math.floor((prev - curr) / (24 * 60 * 60 * 1000))
    if (diff === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

const sendError = (res, error) => {
  console.error(error)
  return res.status(error.statusCode || 500).json({
    ...(error.code ? { code: error.code } : {}),
    message: error.message || 'Lỗi máy chủ',
  })
}

export const generateQRToken = async (req, res) => {
  try {
    const memberId = req.user._id

    const activeMembership = await Membership.findOne({
      memberId,
      status: 'active',
      endDate: { $gte: new Date() },
    }).lean()

    if (!activeMembership) {
      throw new AppError('Gói tập của bạn đã hết hạn hoặc không còn hiệu lực', 403)
    }

    const today = getVietnamDateString()
    const todayStart = new Date(`${today}T00:00:00${VIETNAM_UTC_OFFSET}`)
    const todayEnd = new Date(`${today}T23:59:59.999${VIETNAM_UTC_OFFSET}`)

    const todayCheckin = await CheckIn.findOne({
      memberId,
      checkinTime: { $gte: todayStart, $lte: todayEnd },
      status: 'success',
    }).lean()

    if (todayCheckin) {
      const streak = await calculateStreak(memberId)
      return res.json({
        checkedInToday: true,
        streak,
        memberId: memberId.toString(),
      })
    }

    const now = new Date()
    const expiredAt = new Date(now.getTime() + QR_TOKEN_TTL * 1000)

    const token = jwt.sign(
      {
        memberId: memberId.toString(),
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(expiredAt.getTime() / 1000),
        purpose: 'checkin',
      },
      process.env.JWT_SECRET,
    )

    res.json({
      token,
      expiredAt,
      ttl: QR_TOKEN_TTL,
      memberId: memberId.toString(),
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const staffVerifyCheckin = async (req, res) => {
  try {
    const { token, memberId } = req.body
    const staffId = req.user._id

    const member = await resolveMemberFromCheckinPayload({ token, memberId })
    if (!member || member.role !== 'member') {
      throw new AppError('Hội viên không tồn tại', 404)
    }

    if (!member.isActive || member.status === 'locked') {
      throw new AppError('Tài khoản hội viên đã bị khóa', 403)
    }

    const activeMembership = await getActiveMembership(member._id).lean()
    if (!activeMembership) {
      throw new AppError('Gói tập đã hết hạn. Vui lòng gia hạn để tiếp tục.', 403)
    }

    const today = getVietnamDateString()
    const todayStart = new Date(`${today}T00:00:00${VIETNAM_UTC_OFFSET}`)
    const todayEnd = new Date(`${today}T23:59:59.999${VIETNAM_UTC_OFFSET}`)
    const recentCheckin = await CheckIn.findOne({
      memberId: member._id,
      checkinTime: { $gte: todayStart, $lte: todayEnd },
      status: 'success',
    }).lean()

    if (recentCheckin) {
      throw new AppError('Hội viên này đã check-in thành công trước đó!', 429, 'ALREADY_CHECKED_IN')
    }

    const streakDay = (await calculateStreak(member._id)) + 1
    const checkin = await CheckIn.create({
      memberId: member._id,
      staffId,
      checkinTime: new Date(),
      status: 'success',
      qrToken: token || undefined,
      streakDay,
    })

    await recordUserActivity({
      userId: member._id,
      type: 'checkin',
      title: 'Điểm danh',
      description: `Check-in thành công tại quầy (staff: ${getUserDisplayName(req.user, staffId)})`,
      metadata: { checkinId: checkin._id, staffId },
    })

    res.status(201).json({
      message: 'Check-in thành công',
      checkin: {
        checkinId: checkin._id,
        _id: checkin._id,
        checkinTime: checkin.checkinTime,
        memberId: member._id,
        memberCode: member.memberCode,
        memberName: getUserDisplayName(member, 'Thành viên'),
        email: member.email,
        phone: member.phone,
        planName: activeMembership.planId?.nameVi || activeMembership.planId?.nameEn,
        staffId,
        staffName: getUserDisplayName(req.user, 'Staff'),
        status: checkin.status,
        errorNote: '',
        streakDay: checkin.streakDay,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getStaffCheckinHistory = async (req, res) => {
  try {
    const {
      date,
      startTime,
      endTime,
      mode = 'today',
      keyword = '',
      page = 1,
      limit = 20,
    } = req.query

    console.log('[staff-checkin-history] query:', req.query)

    const selectedMode = ['today', 'yesterday', 'last7days', 'last30days', 'all', 'custom'].includes(String(mode))
      ? String(mode)
      : 'today'
    const { selectedDate, startDate, endDate } = buildVietnamDateRange({ mode: selectedMode, date })
    const normalizedKeyword = String(keyword || '').trim()
    const normalizedStartTime = /^\d{2}:\d{2}$/.test(String(startTime || '')) ? String(startTime) : ''
    const normalizedEndTime = /^\d{2}:\d{2}$/.test(String(endTime || '')) ? String(endTime) : ''
    const filter = {}
    if (startDate && endDate) filter.checkinTime = { $gte: startDate, $lte: endDate }
    if (normalizedStartTime || normalizedEndTime) {
      const localTimeExpr = {
        $dateToString: {
          format: '%H:%M',
          date: '$checkinTime',
          timezone: 'Asia/Ho_Chi_Minh',
        },
      }
      const timeConditions = []
      if (normalizedStartTime) timeConditions.push({ $gte: [localTimeExpr, normalizedStartTime] })
      if (normalizedEndTime) timeConditions.push({ $lte: [localTimeExpr, normalizedEndTime] })
      filter.$expr = timeConditions.length === 1 ? timeConditions[0] : { $and: timeConditions }
    }

    if (normalizedKeyword) {
      const memberConditions = [
        { name: { $regex: normalizedKeyword, $options: 'i' } },
        { fullName: { $regex: normalizedKeyword, $options: 'i' } },
        { memberCode: { $regex: normalizedKeyword, $options: 'i' } },
        { phone: { $regex: normalizedKeyword, $options: 'i' } },
        { email: { $regex: normalizedKeyword, $options: 'i' } },
      ]
      const members = await User.find({ role: 'member', $or: memberConditions }).select('_id').lean()
      filter.memberId = { $in: members.map((member) => member._id) }
    }

    const pageNumber = Math.max(1, Number(page) || 1)
    const limitNumber = Math.max(1, Math.min(100, Number(limit) || 20))
    const skip = (pageNumber - 1) * limitNumber

    const [total, checkins] = await Promise.all([
      CheckIn.countDocuments(filter),
      CheckIn.find(filter)
        .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
        .populate('staffId', 'name fullName email')
        .sort({ checkinTime: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
    ])

    const memberIds = checkins.map((checkin) => checkin.memberId?._id).filter(Boolean)
    const memberships = await Membership.find({
      memberId: { $in: memberIds },
      status: 'active',
    })
      .populate('planId', 'nameVi nameEn durationDays price color')
      .sort({ endDate: -1 })
      .lean()

    const membershipByMemberId = {}
    for (const membership of memberships) {
      const key = String(membership.memberId)
      if (!membershipByMemberId[key]) membershipByMemberId[key] = membership
    }

    res.json({
      checkins: checkins.map((checkin) => formatHistoryItem(checkin, membershipByMemberId)),
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
      filters: {
        mode: selectedMode,
        date: selectedDate,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        keyword: normalizedKeyword,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMemberStreak = async (req, res) => {
  try {
    const { memberId } = req.params
    const streak = await calculateStreak(memberId)
    res.json({ memberId, streak })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getTodayCheckins = async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const checkins = await CheckIn.find({
      checkinTime: { $gte: today, $lt: tomorrow },
    })
      .populate('memberId', 'name fullName email phone avatar')
      .populate('staffId', 'name')
      .sort({ checkinTime: -1 })
      .lean()

    res.json({ checkins, total: checkins.length })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getCheckinStats = async (req, res) => {
  try {
    const { period = 'day' } = req.query
    const now = new Date()

    let startDate
    let groupFormat

    switch (period) {
      case 'week':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
        groupFormat = '%Y-%m-%d'
        break
      case 'month':
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
        groupFormat = '%Y-%m-%d'
        break
      default:
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        groupFormat = '%Y-%m-%d %H:00'
    }

    const checkins = await CheckIn.find({
      checkinTime: { $gte: startDate, $lte: now },
      status: 'success',
    }).lean()

    const totalCheckins = checkins.length
    const uniqueMembers = new Set(checkins.map((c) => c.memberId.toString())).size

    res.json({
      stats: {
        totalCheckins,
        uniqueMembers,
        period,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getCheckinHeatmap = async (req, res) => {
  try {
    const checkins = await CheckIn.find({
      checkinTime: {
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      status: 'success',
    }).lean()

    const heatmap = []
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmap.push({ day, hour, count: 0, members: [] })
      }
    }

    for (const c of checkins) {
      const d = new Date(c.checkinTime)
      const day = d.getDay()
      const hour = d.getHours()
      const idx = day * 24 + hour
      if (heatmap[idx]) {
        heatmap[idx].count++
        const memberIdStr = c.memberId.toString()
        if (!heatmap[idx].members.includes(memberIdStr)) {
          heatmap[idx].members.push(memberIdStr)
        }
      }
    }

    res.json({ heatmap })
  } catch (error) {
    return sendError(res, error)
  }
}
