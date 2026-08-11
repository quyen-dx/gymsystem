import crypto from 'crypto'
import mongoose from 'mongoose'
import DailyQRCode from '../models/DailyQRCode.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import CheckIn from '../models/CheckIn.js'
import Booking from '../models/Booking.js'
import MembershipCycle from '../models/MembershipCycle.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { calculateStreak, isAfterCheckinCutoff, CHECKIN_CUTOFF_MESSAGE } from './checkInController.js'
import { resolveCheckinSession } from '../services/checkinSessionResolver.js'

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Admin/Staff: Generate a new daily QR code for today.
 */
export const generateDailyQR = async (req, res) => {
  try {
    const today = startOfDay(new Date())
    const eod = endOfDay(today)

    await DailyQRCode.updateMany(
      { date: { $gte: today, $lte: eod }, isActive: true },
      { $set: { isActive: false } },
    )

    const token = crypto.randomUUID()
    const qrCode = await DailyQRCode.create({
      token,
      date: today,
      createdBy: req.user._id,
      isActive: true,
      expiresAt: eod,
    })

    res.json({
      message: 'Đã tạo mã QR cho ngày hôm nay',
      qrCode: {
        token: qrCode.token,
        date: qrCode.date,
        expiresAt: qrCode.expiresAt,
        createdAt: qrCode.createdAt,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Admin/Staff: Get the current active daily QR for today.
 */
export const getActiveDailyQR = async (req, res) => {
  try {
    const today = startOfDay(new Date())
    const eod = endOfDay(today)

    const qrCode = await DailyQRCode.findOne({
      date: { $gte: today, $lte: eod },
      isActive: true,
    }).sort({ createdAt: -1 }).lean()

    res.json({
      qrCode: qrCode ? {
        token: qrCode.token,
        date: qrCode.date,
        expiresAt: qrCode.expiresAt,
        createdAt: qrCode.createdAt,
      } : null,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Member: Verify daily QR token and return today's available sessions.
 */
export const verifyDailyQRAndGetSessions = async (req, res) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ message: 'Thiếu mã QR.' })
    }

    const now = new Date()
    const today = startOfDay(new Date())
    const eod = endOfDay(today)

    const qrCode = await DailyQRCode.findOne({ token }).lean()

    if (!qrCode) {
      return res.status(400).json({ message: 'Mã QR không hợp lệ.' })
    }

    if (qrCode.expiresAt < now || !qrCode.isActive) {
      return res.status(400).json({
        message: 'Mã QR này đã hết hạn hoặc đã được thay thế. Vui lòng quét mã QR mới được trình chiếu tại phòng gym.',
      })
    }

    const memberId = req.user._id

    // P7: member được check-in nhiều buổi/ngày → không chặn khi đã check-in 1 buổi.
    // Vẫn trả sessions (buổi chưa diễn ra + chưa check-in) để member chọn buổi tiếp theo.

    // Find active class enrollment
    const enrollment = await ClassEnrollment.findOne({ memberId, status: 'active' })
      .populate('classId', 'code name').lean()

    const classCode = enrollment?.classId?.code || null
    const className = enrollment?.classId?.name || null

    // Get today's sessions from WorkoutSchedule
    const schedules = await WorkoutSchedule.find({
      memberId,
      status: 'active',
    }).lean()

    const sessions = []
    for (const schedule of schedules) {
      if (!schedule.sessions || !Array.isArray(schedule.sessions)) continue
      for (let i = 0; i < schedule.sessions.length; i++) {
        const s = schedule.sessions[i]
        if (!s.date) continue
        const sDate = startOfDay(new Date(s.date))
        if (sDate.getTime() !== today.getTime()) continue

        // Chỉ hiển thị buổi chưa diễn ra (không cho check-in buổi đã completed/skipped/cancelled/no_show)
        if (s.status !== 'pending') continue

        const alreadyCheckedIn = await CheckIn.exists({
          memberId,
          scheduleId: schedule._id,
          sessionDate: s.date,
          sessionIndex: i,
          status: 'success',
        })

        sessions.push({
          scheduleId: schedule._id,
          sessionIndex: i,
          date: s.date,
          time: s.time || null,
          endTime: s.endTime || null,
          title: s.title || null,
          className: s.className || className || null,
          classCode: s.classCode || classCode || null,
          muscleGroup: s.muscleGroup || null,
          location: s.location || null,
          alreadyCheckedIn: !!alreadyCheckedIn,
          checkedInAt: null,
        })
      }
    }

    // Buổi PT 1-1 / PT nhóm đã confirmed + thanh toán trong hôm nay (liên kết Booking)
    const bookings = await Booking.find({
      memberId,
      date: { $gte: today, $lte: eod },
      status: 'confirmed',
      paymentStatus: 'paid',
    }).lean()
    for (const b of bookings) {
      const [time, endTime] = String(b.slot || '').split('-')
      const alreadyCheckedIn = await CheckIn.exists({
        memberId,
        bookingId: b._id,
        status: 'success',
      })
      sessions.push({
        source: 'booking',
        bookingId: b._id,
        ptId: b.ptId,
        scheduleId: null,
        sessionIndex: null,
        date: b.date,
        time: time || null,
        endTime: endTime || null,
        title: b.trainingType === 'group' ? 'Buổi tập nhóm (PT)' : 'Buổi PT 1-1',
        className: null,
        classCode: null,
        muscleGroup: null,
        location: null,
        alreadyCheckedIn: !!alreadyCheckedIn,
        checkedInAt: null,
      })
    }

    // Also check if already checked in as free workout today
    const freeCheckedIn = await CheckIn.findOne({
      memberId,
      sessionType: 'FREE_TRAINING',
      checkinSource: 'daily_qr',
      sessionDate: { $gte: today, $lte: eod },
      status: 'success',
    }).sort({ checkinTime: -1 }).lean()

    res.json({
      valid: true,
      message: 'Mã QR hợp lệ.',
      memberId,
      qrToken: token,
      enrollment: enrollment ? {
        classId: enrollment.classId?._id,
        classCode,
        className,
      } : null,
      sessionDate: today,
      sessions,
      freeWorkoutCheckedIn: freeCheckedIn ? {
        checkedInAt: freeCheckedIn.checkinTime,
      } : null,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Member: Submit check-in for a selected session (or free workout).
 * Toàn bộ logic nằm trong transaction để chống race TOCTOU (check trùng bên trong transaction).
 */
export const submitDailyQRCheckin = async (req, res) => {
  const mongoSession = await mongoose.startSession()
  try {
    mongoSession.startTransaction()

    const { token, scheduleId, sessionIndex, bookingId } = req.body
    const isFreeWorkout = !scheduleId && !bookingId || scheduleId === 'free'
    const memberId = req.user._id
    const now = new Date()
    const today = startOfDay(now)
    const eod = endOfDay(today)

    // Quy tắc nghiệp vụ: check-in sau 23:00 (giờ Việt Nam) sẽ không được tính
    if (isAfterCheckinCutoff()) {
      await mongoSession.abortTransaction()
      return res.status(400).json({ message: CHECKIN_CUTOFF_MESSAGE })
    }

    // P7: bỏ chặn toàn cục 1 lần/ngày — chống trùng theo thực thể ở bên dưới
    // (1 check-in/booking, 1 check-in/schedule session, FREE_TRAINING 1 lần/ngày).

    // Validate QR token
    const qrCode = await DailyQRCode.findOne({ token }).lean()
    if (!qrCode) {
      await mongoSession.abortTransaction()
      return res.status(400).json({ message: 'Mã QR không hợp lệ.' })
    }
    if (qrCode.expiresAt < now || !qrCode.isActive) {
      await mongoSession.abortTransaction()
      return res.status(400).json({
        message: 'Mã QR này đã hết hạn hoặc đã được thay thế. Vui lòng quét mã QR mới được trình chiếu tại phòng gym.',
      })
    }

    // Kiểm tra gói tập đang hoạt động (cycle active, kích hoạt ngay sau thanh toán)
    const activeCycle = await MembershipCycle.findOne({
      memberId,
      status: 'active',
      expiresAt: { $gte: now },
    }).populate('currentPlanId', 'nameVi nameEn price').session(mongoSession).lean()
    if (!activeCycle) {
      // Ghi nhận lượt check-in thất bại (phục vụ báo cáo lễ tân) — commit để lưu vết này
      await CheckIn.create([{
        memberId,
        staffId: null,
        checkinTime: now,
        status: 'failed',
        errorNote: 'Gói tập đã hết hạn',
        checkInMethod: 'QR_SELF',
        checkinSource: 'daily_qr',
        dailyQRCodeId: qrCode._id,
      }], { session: mongoSession })
      await mongoSession.commitTransaction()
      return res.status(403).json({ message: 'Gói tập đã hết hạn hoặc không còn hiệu lực. Vui lòng gia hạn.' })
    }

    const activePlan = activeCycle.currentPlanId || {}
    const planSnapshot = {
      planId: activePlan._id || activeCycle.currentPlanId || null,
      planName: activePlan.nameVi || activePlan.nameEn || '',
      planPrice: Number(activePlan.price || 0),
    }

    // Streak hiện tại + 1 (P2: luồng daily QR trước đây không lưu streakDay)
    const streakDay = (await calculateStreak(memberId)) + 1

    // === BACKEND QUYẾT ĐỊNH CUỐI CÙNG: SCHEDULED hay FREE_TRAINING ===
    // Client chỉ gợi ý (scheduleId/sessionIndex/bookingId); nếu gợi ý không hợp lệ
    // hoặc không có lịch hợp lệ tại thời điểm check-in → FREE_TRAINING.
    const resolved = await resolveCheckinSession({
      memberId,
      now,
      clientScheduleId: isFreeWorkout ? undefined : scheduleId,
      clientSessionIndex: isFreeWorkout ? undefined : Number(sessionIndex),
      clientBookingId: bookingId,
    })

    // Chống duplicate theo đúng thực thể được nhận diện (nếu có)
    const duplicateFilter = resolved?.bookingId
      ? { memberId, bookingId: resolved.bookingId, status: 'success' }
      : resolved?.scheduleId
        ? { memberId, scheduleId: resolved.scheduleId, sessionDate: resolved.sessionDate, sessionIndex: resolved.sessionIndex, status: 'success' }
        : { memberId, sessionType: 'FREE_TRAINING', checkinSource: 'daily_qr', sessionDate: { $gte: today, $lte: eod }, status: 'success' }
    const existingCheckin = await CheckIn.findOne(duplicateFilter).session(mongoSession).lean()
    if (existingCheckin) {
      const checkinTime = new Date(existingCheckin.checkinTime).toLocaleTimeString('vi-VN', {
        hour: '2-digit', minute: '2-digit',
      })
      await mongoSession.abortTransaction()
      return res.status(400).json({
        message: resolved
          ? `Bạn đã check-in buổi này rồi lúc ${checkinTime}.`
          : `Bạn đã check-in "Tập tự do" hôm nay lúc ${checkinTime}.`,
        alreadyCheckedIn: true,
      })
    }

    // Tạo ĐÚNG 1 bản ghi check-in cho 1 lần check-in.
    // SCHEDULED: liên kết đầy đủ (WorkoutSchedule / Booking / PT / Class nếu có).
    // FREE_TRAINING: KHÔNG liên kết gì, KHÔNG tạo Booking/WorkoutSchedule, KHÔNG tính là hoàn thành buổi PT.
    const checkin = await CheckIn.create([{
      memberId,
      staffId: null,
      checkinTime: now,
      status: 'success',
      ...planSnapshot,
      streakDay,
      dailyQRCodeId: qrCode._id,
      checkinSource: 'daily_qr',
      sessionType: resolved ? 'SCHEDULED' : 'FREE_TRAINING',
      sessionDate: resolved ? resolved.sessionDate : today,
      scheduleId: resolved?.scheduleId || null,
      sessionIndex: resolved?.sessionIndex ?? undefined,
      sessionTitle: resolved?.sessionTitle || null,
      sessionTime: resolved?.sessionTime || null,
      classCode: resolved?.classCode || null,
      bookingId: resolved?.bookingId || null,
      ptId: resolved?.ptId || null,
    }], { session: mongoSession })

    await mongoSession.commitTransaction()

    res.json({
      message: resolved
        ? `Check-in thành công — buổi theo lịch: ${resolved.sessionTitle || 'Theo lịch'}${resolved.sessionTime ? ` (${resolved.sessionTime})` : ''}.`
        : 'Check-in thành công — Tập tự do (không có lịch hợp lệ tại thời điểm này).',
      checkin: {
        _id: checkin[0]._id,
        checkinTime: checkin[0].checkinTime,
        sessionType: checkin[0].sessionType,
        sessionTitle: checkin[0].sessionTitle || null,
        sessionTime: checkin[0].sessionTime || null,
        classCode: checkin[0].classCode || null,
        scheduleId: checkin[0].scheduleId || null,
        bookingId: checkin[0].bookingId || null,
        ptId: checkin[0].ptId || null,
        sessionDate: checkin[0].sessionDate || null,
        streakDay: checkin[0].streakDay,
      },
    })
  } catch (error) {
    if (mongoSession) {
      try { await mongoSession.abortTransaction() } catch {}
      mongoSession.endSession()
    }
    res.status(500).json({ message: error.message })
  } finally {
    if (mongoSession) {
      mongoSession.endSession()
    }
  }
}
