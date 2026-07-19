import crypto from 'crypto'
import DailyQRCode from '../models/DailyQRCode.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import CheckIn from '../models/CheckIn.js'
import MembershipCycle from '../models/MembershipCycle.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { activateCycle, markBenefitUsed } from '../services/membershipCycleService.js'

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
 * Parse "HH:MM" string to total minutes from midnight.
 */
function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
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

    const qrCode = await DailyQRCode.findOne({ token, isActive: true }).lean()

    if (!qrCode) {
      return res.status(400).json({ message: 'Mã QR không hợp lệ.' })
    }

    if (qrCode.expiresAt < now) {
      return res.status(400).json({
        message: 'Mã QR này đã hết hạn, vui lòng quét mã QR mới được trình chiếu tại phòng gym.',
      })
    }

    const memberId = req.user._id

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

    // Also check if already checked in as free workout today
    const freeCheckedIn = await CheckIn.findOne({
      memberId,
      sessionType: 'free_workout',
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
 */
export const submitDailyQRCheckin = async (req, res) => {
  try {
    const { token, scheduleId, sessionIndex } = req.body
    const isFreeWorkout = !scheduleId || scheduleId === 'free'
    const memberId = req.user._id
    const now = new Date()
    const today = startOfDay(now)
    const eod = endOfDay(today)

    // Validate QR token
    const qrCode = await DailyQRCode.findOne({ token, isActive: true }).lean()
    if (!qrCode) {
      return res.status(400).json({ message: 'Mã QR không hợp lệ.' })
    }
    if (qrCode.expiresAt < now) {
      return res.status(400).json({ message: 'Mã QR đã hết hạn.' })
    }

    if (!isFreeWorkout) {
      // === SCHEDULED SESSION CHECK-IN ===

      // 1. Validate scheduleId + sessionIndex
      const schedule = await WorkoutSchedule.findOne({
        _id: scheduleId,
        memberId,
        status: 'active',
      }).lean()

      if (!schedule) {
        return res.status(400).json({ message: 'Không tìm thấy lịch tập phù hợp.' })
      }

      const session = schedule.sessions?.[sessionIndex]
      if (!session || !session.date) {
        return res.status(400).json({ message: 'Buổi tập không hợp lệ.' })
      }

      const sessionDate = startOfDay(new Date(session.date))
      if (sessionDate.getTime() !== today.getTime()) {
        return res.status(400).json({ message: 'Buổi tập không thuộc ngày hôm nay.' })
      }

      // 2. Validate time window
      if (session.time && session.endTime) {
        const nowMinutes = now.getHours() * 60 + now.getMinutes()
        const startMinutes = parseTime(session.time)
        const endMinutes = parseTime(session.endTime)
        const windowStart = startMinutes - 30

        if (nowMinutes < windowStart || nowMinutes > endMinutes) {
          return res.status(400).json({
            message: `Buổi tập này diễn ra từ ${session.time} đến ${session.endTime}. Thời điểm hiện tại không nằm trong khung giờ cho phép. Vui lòng chọn "Tập tự do" thay thế.`,
            suggestFreeWorkout: true,
          })
        }
      }

      // 3. Prevent duplicate
      const existing = await CheckIn.findOne({
        memberId,
        scheduleId,
        sessionDate: session.date,
        sessionIndex,
        status: 'success',
      }).lean()

      if (existing) {
        const checkinTime = new Date(existing.checkinTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit', minute: '2-digit',
        })
        return res.status(400).json({
          message: `Bạn đã check-in buổi này rồi lúc ${checkinTime}.`,
          alreadyCheckedIn: true,
        })
      }

      // 4. Validate & activate membership before completing check-in
      try {
        const activated = await activateCycle(memberId)
        if (!activated) {
          const activeCycle = await MembershipCycle.findOne({ memberId, status: 'active' }).lean()
          if (!activeCycle) {
            return res.status(400).json({ message: 'Không có gói tập hợp lệ.' })
          }
        }
      } catch (activationErr) {
        return res.status(500).json({ message: activationErr.message })
      }

      // 5. Create check-in record
      const checkin = await CheckIn.create({
        memberId,
        staffId: null,
        checkinTime: now,
        status: 'success',
        dailyQRCodeId: qrCode._id,
        scheduleId: schedule._id,
        sessionDate: session.date,
        sessionTitle: session.title || null,
        sessionTime: session.time && session.endTime ? `${session.time}-${session.endTime}` : null,
        sessionIndex,
        classCode: session.classCode || null,
        checkinSource: 'daily_qr',
        sessionType: 'scheduled',
      })

      res.json({
        message: 'Check-in thành công.',
        checkin: {
          _id: checkin._id,
          checkinTime: checkin.checkinTime,
          sessionTitle: session.title || null,
          sessionTime: session.time && session.endTime ? `${session.time}-${session.endTime}` : null,
          classCode: session.classCode || null,
          sessionType: 'scheduled',
        },
      })
    } else {
      // === FREE WORKOUT CHECK-IN ===

      // Check if already checked in as free workout today
      const existingFree = await CheckIn.findOne({
        memberId,
        sessionType: 'free_workout',
        checkinSource: 'daily_qr',
        sessionDate: { $gte: today, $lte: eod },
        status: 'success',
      }).lean()

      if (existingFree) {
        const checkinTime = new Date(existingFree.checkinTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit', minute: '2-digit',
        })
        return res.status(400).json({
          message: `Bạn đã check-in "Tập tự do" hôm nay lúc ${checkinTime}.`,
          alreadyCheckedIn: true,
        })
      }

      // Validate & activate membership before completing free workout check-in
      try {
        const activated = await activateCycle(memberId)
        if (!activated) {
          const activeCycle = await MembershipCycle.findOne({ memberId, status: 'active' }).lean()
          if (!activeCycle) {
            return res.status(400).json({ message: 'Không có gói tập hợp lệ.' })
          }
        }
      } catch (activationErr) {
        return res.status(500).json({ message: activationErr.message })
      }

      const checkin = await CheckIn.create({
        memberId,
        staffId: null,
        checkinTime: now,
        status: 'success',
        dailyQRCodeId: qrCode._id,
        sessionDate: today,
        sessionType: 'free_workout',
        checkinSource: 'daily_qr',
      })

      res.json({
        message: 'Check-in thành công.',
        checkin: {
          _id: checkin._id,
          checkinTime: checkin.checkinTime,
          sessionType: 'free_workout',
        },
      })
    }
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
