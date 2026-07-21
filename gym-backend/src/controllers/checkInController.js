import mongoose from 'mongoose'
import CheckIn from '../models/CheckIn.js'
import MembershipCycle from '../models/MembershipCycle.js'
import User from '../models/User.js'
import Plan from '../models/Plan.js'
import SystemSettings from '../models/SystemSettings.js'
import { activateCycle } from '../services/membershipCycleService.js'
import { recordUserActivity } from '../services/userActivityService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { generateCheckinQR, verifyCheckinQR } from '../services/qrService.js'
import { calculateStreak } from '../services/streakService.js'
import AppError from '../utils/appError.js'
import sendError from '../utils/sendError.js'

const getUserDisplayName = (user, fallback = '') =>
  String(user?.fullName || user?.displayName || user?.name || fallback || '').trim()

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

const getVietnamHour = () => (new Date().getUTCHours() + 7) % 24

const checkGymOpen = () => {
  const openHour = Number(process.env.GYM_OPEN_HOUR) ?? 0
  const closeHour = Number(process.env.GYM_CLOSE_HOUR) ?? 24
  if (openHour === 0 && closeHour === 24) return
  const currentHour = getVietnamHour()
  if (currentHour < openHour || currentHour >= closeHour) {
    throw new AppError(`Phòng gym đã đóng cửa. Giờ hoạt động: ${openHour}:00 - ${closeHour}:00`, 403)
  }
}

const checkGymClosedToday = async () => {
  const today = getVietnamDateString()
  const settingsDoc = await SystemSettings.findOne({ singletonKey: 'global' }).select('settings').lean().catch(() => null)
  const closedDates = settingsDoc?.settings?.closedDates || []
  if (closedDates.includes(today)) {
    throw new AppError('Phòng gym đóng cửa hôm nay. Vui lòng quay lại vào ngày mai.', 403)
  }
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

const getActiveMembership = (memberId) => MembershipCycle.findOne({
  memberId,
  status: { $in: ['active', 'pending_initial_activation'] },
  $or: [
    { status: 'pending_initial_activation' },
    { status: 'active', expiresAt: { $gte: new Date() } },
  ],
})
  .populate('currentPlanId', 'nameVi nameEn durationDays price color')
  .sort({ createdAt: -1 })

const resolveMemberFromCheckinPayload = async ({ token, memberId }) => {
  if (token) {
    const { memberId: qrMemberId } = await verifyCheckinQR(token)
    return User.findById(qrMemberId)
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
  const cycle = membershipByMemberId[String(member._id)] || null
  const plan = cycle?.currentPlanId
  const dailyQR = checkin.dailyQRCodeId || {}

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
    checkinSource: checkin.checkinSource || 'staff_qr',
    sessionType: checkin.sessionType || null,
    sessionTitle: checkin.sessionTitle || null,
    sessionTime: checkin.sessionTime || null,
    classCode: checkin.classCode || null,
    scheduleId: checkin.scheduleId || null,
    dailyQRDate: dailyQR.date || null,
    dailyQRCreatedAt: dailyQR.createdAt || null,
    checkInMethod: checkin.checkInMethod || 'QR_SELF',
    manualReason: checkin.manualReason || '',
    performedBy: checkin.performedBy || null,
    performedByName: checkin.performedByName || checkin.staffMemberName || '',
  }
}

export const generateQRToken = async (req, res) => {
  try {
    const memberId = req.user._id

    checkGymOpen()
    await checkGymClosedToday()

    const activeMembership = await MembershipCycle.findOne({
      memberId,
      status: 'active',
      expiresAt: { $gte: new Date() },
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

    const { token, expiredAt, ttl } = generateCheckinQR(memberId)

    res.json({
      token,
      expiredAt,
      ttl,
      memberId: memberId.toString(),
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const searchMemberForCheckin = async (req, res) => {
  try {
    const { q } = req.query
    if (!q || !String(q).trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập từ khóa tìm kiếm.' })
    }
    const keyword = String(q).trim()

    const query = {
      role: 'member',
      $or: [
        { memberCode: { $regex: `^${keyword}$`, $options: 'i' } },
        { phone: keyword },
        { email: { $regex: `^${keyword}$`, $options: 'i' } },
        { fullName: { $regex: keyword, $options: 'i' } },
      ],
    }

    const member = await User.findOne(query).lean()
    if (!member) {
      return res.json({ member: null })
    }

    const cycles = await MembershipCycle.find({ memberId: member._id })
      .populate('currentPlanId', 'nameVi nameEn color')
      .sort({ createdAt: -1 })
      .lean()

    const activeCycle = cycles.find(c => c.status === 'active' && c.expiresAt >= new Date())
    const pendingCycle = cycles.find(c => c.status === 'pending_initial_activation')
    const latestExpired = cycles.find(c => c.status === 'expired' || c.expiresAt < new Date())
    const latestCycle = activeCycle || pendingCycle || latestExpired || null

    let membershipStatus = null
    let membershipInfo = null
    if (activeCycle) {
      membershipStatus = 'active'
      membershipInfo = {
        planName: activeCycle.currentPlanId?.nameVi || activeCycle.currentPlanId?.nameEn || '',
        planColor: activeCycle.currentPlanId?.color || '',
        startDate: activeCycle.startDate,
        endDate: activeCycle.expiresAt,
        price: activeCycle.price,
        status: 'active',
      }
    } else if (pendingCycle) {
      membershipStatus = 'pending_initial_activation'
      membershipInfo = {
        planName: pendingCycle.currentPlanId?.nameVi || pendingCycle.currentPlanId?.nameEn || '',
        planColor: pendingCycle.currentPlanId?.color || '',
        startDate: pendingCycle.startDate,
        endDate: pendingCycle.expiresAt,
        price: pendingCycle.price,
        status: 'pending_initial_activation',
      }
    } else if (latestCycle) {
      membershipStatus = 'expired'
      membershipInfo = {
        planName: latestCycle.currentPlanId?.nameVi || latestCycle.currentPlanId?.nameEn || '',
        planColor: latestCycle.currentPlanId?.color || '',
        startDate: latestCycle.startDate,
        endDate: latestCycle.expiresAt,
        price: latestCycle.price,
        status: 'expired',
      }
    }

    const todayStart = new Date(`${getVietnamDateString()}T00:00:00${VIETNAM_UTC_OFFSET}`)
    const todayEnd = new Date(`${getVietnamDateString()}T23:59:59.999${VIETNAM_UTC_OFFSET}`)
    const checkedInToday = await CheckIn.exists({
      memberId: member._id,
      checkinTime: { $gte: todayStart, $lte: todayEnd },
      status: 'success',
    })

    res.json({
      member: {
        _id: member._id,
        memberCode: member.memberCode || '',
        fullName: getUserDisplayName(member, ''),
        email: member.email || '',
        phone: member.phone || '',
        avatar: member.avatar || '',
        membership: membershipInfo,
        membershipStatus,
        checkedInToday: !!checkedInToday,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const staffVerifyCheckin = async (req, res) => {
  let mongoSession = null
  try {
    checkGymOpen()
    await checkGymClosedToday()

    const { token, memberId, manualReason } = req.body
    const staffId = req.user._id
    const checkInMethod = req.user.role === 'reception' ? 'RECEPTION' : 'STAFF'

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

    // FIX: Wrapped activation + checkin creation + activity recording in a transaction
    // MOVED duplicate check INSIDE transaction to prevent TOCTOU race condition
    mongoSession = await mongoose.startSession()
    mongoSession.startTransaction()

    // Check duplicate INSIDE transaction so concurrent requests are serialized
    const today = getVietnamDateString()
    const todayStart = new Date(`${today}T00:00:00${VIETNAM_UTC_OFFSET}`)
    const todayEnd = new Date(`${today}T23:59:59.999${VIETNAM_UTC_OFFSET}`)
    const recentCheckin = await CheckIn.findOne({
      memberId: member._id,
      checkinTime: { $gte: todayStart, $lte: todayEnd },
      status: 'success',
    }).session(mongoSession).lean()

    if (recentCheckin) {
      await mongoSession.abortTransaction()
      throw new AppError('Hội viên này đã check-in thành công trước đó!', 429, 'ALREADY_CHECKED_IN')
    }

    // If cycle is pending_initial_activation, activate before completing check-in
    if (activeMembership.status === 'pending_initial_activation') {
      const activated = await activateCycle(member._id, { session: mongoSession })
      if (!activated) {
        await mongoSession.abortTransaction()
        throw new AppError('Không thể kích hoạt gói tập. Vui lòng thử lại.', 500)
      }
      // Use activated cycle info for the response
      activeMembership.status = 'active'
    }

    const streakDay = (await calculateStreak(member._id)) + 1
    const [checkin] = await CheckIn.create([{
      memberId: member._id,
      staffId,
      checkinTime: new Date(),
      status: 'success',
      qrToken: token || undefined,
      streakDay,
      checkInMethod: checkInMethod || 'STAFF',
      manualReason: manualReason || undefined,
      performedBy: staffId,
      performedByName: getUserDisplayName(req.user, 'Staff'),
    }], { session: mongoSession })

    await recordUserActivity({
      userId: member._id,
      type: 'checkin',
      title: 'Điểm danh',
      description: `Check-in thành công tại quầy (staff: ${getUserDisplayName(req.user, staffId)})`,
      metadata: { checkinId: checkin._id, staffId },
      session: mongoSession,
    })

    await mongoSession.commitTransaction()

    // Notification outside transaction (fire-and-forget, non-critical)
    await createNotification({
      receiverId: member._id,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.CHECKIN_SUCCESS,
      title: 'Check-in thành công',
      content: `Bạn đã check-in thành công tại phòng gym. Streak: ${streakDay} ngày.`,
      relatedId: checkin._id,
      relatedType: 'CheckIn',
      redirectUrl: '/checkin-history',
      createdBy: 'Staff',
    }).catch(err => console.error('Notify checkin failed:', err.message))

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
        planName: activeMembership.currentPlanId?.nameVi || activeMembership.currentPlanId?.nameEn,
        staffId,
        staffName: getUserDisplayName(req.user, 'Staff'),
        status: checkin.status,
        errorNote: '',
        streakDay: checkin.streakDay,
        checkInMethod: checkInMethod || 'STAFF',
        manualReason: manualReason || undefined,
        performedByName: getUserDisplayName(req.user, 'Staff'),
      },
    })
  } catch (error) {
    if (mongoSession) {
      try { await mongoSession.abortTransaction() } catch {}
      mongoSession.endSession()
    }
    return sendError(res, error)
  } finally {
    if (mongoSession) {
      mongoSession.endSession()
    }
  }
}

/**
 * Member: Get own check-in history (no admin/staff required).
 */
export const getMyCheckinHistory = async (req, res) => {
  try {
    const { page = 1, limit = 50, mode = 'all', date, toDate } = req.query
    const memberId = req.user._id

    const filter = { memberId, status: 'success' }

    if ((mode === 'custom' || date) && date) {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      if (toDate) {
        const end = new Date(toDate)
        end.setHours(23, 59, 59, 999)
        filter.checkinTime = { $gte: start, $lte: end }
      } else {
        const end = new Date(date)
        end.setHours(23, 59, 59, 999)
        filter.checkinTime = { $gte: start, $lte: end }
      }
    }

    const pageNumber = Math.max(1, Number(page) || 1)
    const limitNumber = Math.max(1, Math.min(100, Number(limit) || 50))
    const skip = (pageNumber - 1) * limitNumber

    const [total, checkins] = await Promise.all([
      CheckIn.countDocuments(filter),
      CheckIn.find(filter)
        .sort({ checkinTime: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
    ])

    // Format with cycle plan info
    const cycles = await MembershipCycle.find({ memberId, status: 'active' })
      .populate('currentPlanId', 'nameVi nameEn')
      .sort({ expiresAt: -1 })
      .lean()
    const membershipByMemberId = {}
    if (cycles.length > 0) {
      membershipByMemberId[String(memberId)] = cycles[0]
    }
    const memberMap = {}
    for (const c of cycles) {
      memberMap[String(c.memberId)] = c
    }

    res.json({
      checkins: checkins.map((c) => formatHistoryItem(c, memberMap)),
      pagination: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) },
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
      sessionType,
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

    if (sessionType === 'scheduled' || sessionType === 'free_workout') {
      filter.sessionType = sessionType
    }

    const pageNumber = Math.max(1, Number(page) || 1)
    const limitNumber = Math.max(1, Math.min(100, Number(limit) || 20))
    const skip = (pageNumber - 1) * limitNumber

    const [total, checkins] = await Promise.all([
      CheckIn.countDocuments(filter),
      CheckIn.find(filter)
        .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
        .populate('staffId', 'name fullName email')
        .populate('dailyQRCodeId', 'date createdAt token')
        .sort({ checkinTime: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
    ])

    const memberIds = checkins.map((checkin) => checkin.memberId?._id).filter(Boolean)
    const cycles = await MembershipCycle.find({
      memberId: { $in: memberIds },
      status: 'active',
    })
      .populate('currentPlanId', 'nameVi nameEn durationDays price color')
      .sort({ expiresAt: -1 })
      .lean()

    const membershipByMemberId = {}
    for (const cycle of cycles) {
      const key = String(cycle.memberId)
      if (!membershipByMemberId[key]) membershipByMemberId[key] = cycle
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
