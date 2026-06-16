import jwt from 'jsonwebtoken'
import CheckIn from '../models/CheckIn.js'
import Membership from '../models/Membership.js'
import User from '../models/User.js'
import Plan from '../models/Plan.js'
import { recordUserActivity } from '../services/userActivityService.js'
import AppError from '../utils/appError.js'

const QR_TOKEN_TTL = Number(process.env.QR_TOKEN_TTL) || 30
const DUPLICATE_WINDOW_MS = 60 * 60 * 1000

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

export const verifyQRToken = async (req, res) => {
  try {
    const { token } = req.body
    if (!token) throw new AppError('Token là bắt buộc', 400)

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      throw new AppError('Mã QR không hợp lệ hoặc đã hết hạn', 401)
    }

    if (decoded.purpose !== 'checkin' || !decoded.memberId) {
      throw new AppError('Mã QR không hợp lệ', 401)
    }

    const existingCheckin = await CheckIn.findOne({ qrToken: token }).lean()
    if (existingCheckin) {
      throw new AppError('Mã QR này đã được sử dụng', 409)
    }

    const member = await User.findById(decoded.memberId).lean()
    if (!member || member.role !== 'member') {
      throw new AppError('Hội viên không tồn tại', 404)
    }

    if (!member.isActive || member.status === 'locked') {
      throw new AppError('Tài khoản hội viên đã bị khóa', 403)
    }

    const activeMembership = await Membership.findOne({
      memberId: member._id,
      status: 'active',
      endDate: { $gte: new Date() },
    })
      .populate('planId', 'nameVi nameEn durationDays price color')
      .sort({ endDate: -1 })
      .lean()

    if (!activeMembership) {
      throw new AppError('Gói tập đã hết hạn. Vui lòng gia hạn để tiếp tục.', 403)
    }

    const oneHourAgo = new Date(Date.now() - DUPLICATE_WINDOW_MS)
    const recentCheckin = await CheckIn.findOne({
      memberId: member._id,
      checkinTime: { $gte: oneHourAgo },
      status: 'success',
    }).lean()

    if (recentCheckin) {
      throw new AppError('Hội viên này đã check-in thành công trước đó!', 429, 'ALREADY_CHECKED_IN')
    }

    res.json({
      member: {
        _id: member._id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        avatar: member.avatar,
      },
      membership: {
        planName: activeMembership.planId?.nameVi || activeMembership.planId?.nameEn,
        planColor: activeMembership.planId?.color,
        startDate: activeMembership.startDate,
        endDate: activeMembership.endDate,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const confirmCheckin = async (req, res) => {
  try {
    const { token } = req.body
    const staffId = req.user._id

    if (!token) throw new AppError('Token là bắt buộc', 400)

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
      throw new AppError('Check-in này đã được thực hiện trước đó', 409)
    }

    const member = await User.findById(decoded.memberId)
    if (!member || member.role !== 'member') {
      throw new AppError('Hội viên không tồn tại', 404)
    }

    const streaKDay = await calculateStreak(member._id)

    const checkin = await CheckIn.create({
      memberId: member._id,
      staffId,
      checkinTime: new Date(),
      status: 'success',
      qrToken: token,
      streakDay: streaKDay,
    })

    await recordUserActivity({
      userId: member._id,
      type: 'checkin',
      title: 'Điểm danh',
      description: `Check-in thành công tại quầy (staff: ${req.user.name || staffId})`,
      metadata: { checkinId: checkin._id, staffId },
    })

    res.json({
      message: 'Check-in thành công',
      checkin: {
        _id: checkin._id,
        checkinTime: checkin.checkinTime,
        streakDay: checkin.streakDay,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const uploadSelfie = async (req, res) => {
  try {
    const { checkinId } = req.body

    const checkin = await CheckIn.findById(checkinId)
    if (!checkin) {
      throw new AppError('Không tìm thấy check-in', 404)
    }

    const selfieFile = req.files?.selfie?.[0]
    if (selfieFile?.path) {
      checkin.selfieUrl = selfieFile.path
      await checkin.save()
    }

    res.json({ message: 'Đã lưu ảnh selfie', selfieUrl: checkin.selfieUrl })
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
      .populate('memberId', 'name email phone avatar')
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
