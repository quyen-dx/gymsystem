import Booking from '../models/Booking.js'
import MembershipCycle from '../models/MembershipCycle.js'
import Waitlist from '../models/Waitlist.js'
import PT from '../models/PT.js'
import User from '../models/User.js'
import TrainingRequest from '../models/TrainingRequest.js'
import Payment from '../models/Payment.js'
import CheckIn from '../models/CheckIn.js'
import PTSessionAttendance from '../models/PTSessionAttendance.js'
import mongoose from 'mongoose'
import { applyWalletTransaction, getWalletByUser } from '../services/walletService.js'
import { finalizeWalletDeposit } from '../services/walletDepositService.js'
import { createVnpayPaymentUrl } from '../services/vnpayService.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { checkMemberFeature } from '../utils/featureCheck.js'
import { validatePTAssignment, findPTMemberConflicts, normalizeSlot, timesOverlap } from '../services/ptScheduleValidationService.js'
import { getSystemSettingsValue } from '../services/systemSettingsService.js'

const activeStatus = ['pending', 'awaiting_payment', 'confirmed']

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) return String(forwardedFor).split(',')[0].trim()
  return req.ip || req.socket?.remoteAddress || '127.0.0.1'
}

const normalizeDate = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const getBookingStartDateTime = (date, slot) => {
  const bookingDate = normalizeDate(date)
  const start = String(slot || '').split('-')[0].trim()
  const [hour = 0, minute = 0] = start.split(':').map(Number)
  bookingDate.setHours(hour || 0, minute || 0, 0, 0)
  return bookingDate
}

// Thời điểm KẾT THÚC buổi theo slot ("HH:mm-HH:mm"). Slot thiếu giờ kết thúc → mặc định 60 phút.
const getBookingEndDateTime = (date, slot) => {
  const bookingDate = normalizeDate(date)
  const end = String(slot || '').split('-')[1]?.trim()
  if (!end) {
    bookingDate.setHours(bookingDate.getHours() + 1)
    return bookingDate
  }
  const [hour = 0, minute = 0] = end.split(':').map(Number)
  bookingDate.setHours(hour || 0, minute || 0, 0, 0)
  return bookingDate
}

// Chặn đặt lịch quá sát giờ tập (lead time tối thiểu theo cấu hình) hoặc slot đã qua.
const assertBookingLeadTime = (date, slot, leadHours, res) => {
  const start = getBookingStartDateTime(date, slot)
  if (start <= new Date()) {
    res.status(400).json({ message: 'Khung giờ này đã qua. Vui lòng chọn thời gian khác.' })
    return false
  }
  if (start - new Date() < leadHours * 60 * 60 * 1000) {
    res.status(400).json({
      message: `Phải đặt lịch trước giờ tập ít nhất ${leadHours} giờ. Khung giờ này quá sát, vui lòng chọn thời gian khác.`,
    })
    return false
  }
  return true
}

const makeSlotId = (ptId, date, slot) => {
  const bookingDate = normalizeDate(date).toISOString().slice(0, 10)
  return `${ptId}_${bookingDate}_${slot}`
}

// Gói tập phải BAO PHỦ ngày buổi tập: từ lúc kích hoạt (hoặc startDate) đến expiresAt.
// KHÔNG chấp nhận ngày trước khi gói bắt đầu, và không chấp nhận ngày trong khe hở giữa 2 gói.
export const hasActiveMembershipForDate = async (memberId, date) => {
  const bookingDate = normalizeDate(date)

  const cycles = await MembershipCycle.find({
    memberId,
    status: 'active',
    transferPending: { $ne: true },
    expiresAt: { $gte: bookingDate },
  }).lean()

  return cycles.some((cycle) => {
    if (!cycle.expiresAt || cycle.expiresAt < bookingDate) return false
    const start = cycle.activatedAt || cycle.startDate || null
    // Không có thông tin ngày bắt đầu (dữ liệu cũ) → chấp nhận theo expiresAt như trước đây
    return !start || start <= bookingDate
  })
}

const requireActiveMembershipForDate = async (memberId, date, res) => {
  const allowed = await hasActiveMembershipForDate(memberId, date)
  if (allowed) return true

  res.status(403).json({
    message: 'Bạn cần có gói tập đang hoạt động để đặt lịch PT',
  })
  return false
}

export const checkConflicts = async (req, res) => {
  try {
    const { ptId, date, slot } = req.query

    if (!ptId || !date || !slot) {
      return res.status(400).json({
        message: 'Thiếu ptId, date hoặc slot',
      })
    }

    if (!(await requireActiveMembershipForDate(req.user._id, date, res))) return

    const bookingDate = normalizeDate(date)

    const memberConflict = await Booking.findOne({
      memberId: req.user._id,
      date: bookingDate,
      slot,
      status: { $in: activeStatus },
    })

    const ptConflict = await Booking.findOne({
      ptId,
      date: bookingDate,
      slot,
      status: { $in: activeStatus },
    })

    return res.json({
      hasConflict: !!memberConflict || !!ptConflict,
      memberConflict: !!memberConflict,
      ptConflict: !!ptConflict,
      message: memberConflict
        ? 'Bạn đã có lịch tập ở khung giờ này'
        : ptConflict
          ? 'PT đã có lịch ở khung giờ này'
          : 'Có thể đặt lịch',
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi kiểm tra trùng lịch',
      error: error.message,
    })
  }
}

export const createBooking = async (req, res) => {
  try {
    const {
      ptId,
      date,
      slot,
      note,
      trainingType,
    } = req.body

    const finalTrainingType =
      trainingType === 'group'
        ? 'group'
        : 'one_to_one'

    if (!ptId || !date || !slot) {
      return res.status(400).json({
        message: 'Thiếu ptId, date hoặc slot',
      })
    }

    if (!(await requireActiveMembershipForDate(req.user._id, date, res))) return

    const bookingDate = normalizeDate(date)

    // Chặn đặt lịch sát giờ: lead time tối thiểu + slot đã qua (cấu hình pt.minBookingLeadHours)
    const settings = await getSystemSettingsValue()
    if (!assertBookingLeadTime(bookingDate, slot, settings?.pt?.minBookingLeadHours || 2, res)) return

    // Validate plan feature for booking type
    if (finalTrainingType === 'one_to_one') {
      const featureCheck = await checkMemberFeature(req.user._id, 'BOOK_PT_PRIVATE')
      if (!featureCheck.allowed) {
        return res.status(403).json({ message: featureCheck.reason })
      }
    }
    if (finalTrainingType === 'group') {
      const featureCheck = await checkMemberFeature(req.user._id, 'BOOK_PT_GROUP')
      if (!featureCheck.allowed) {
        return res.status(403).json({ message: featureCheck.reason })
      }
    }

    const pt = await PT.findOne({ userId: ptId })

      if (!pt) {
        return res.status(404).json({
          message: 'Không tìm thấy PT',
        })
      }

    // Kiểm tra lịch làm việc của PT: ngày làm việc, ca phù hợp, nghỉ phép, cover thay ca, trùng lớp nhóm
    const scheduleCheck = await validatePTAssignment({ trainerId: ptId, date: bookingDate, slot })
    if (!scheduleCheck.ok) {
      return res.status(400).json({ message: scheduleCheck.message })
    }

    // Giá đặt lịch lấy từ cấu hình giá PT (nếu có) — chỉ để hiển thị, không bắt buộc thanh toán.
    const sessionPrice =
      finalTrainingType === 'one_to_one' ? pt?.oneToOnePrice || 0 : pt?.groupPrice || 0
    const priceAtBooking = sessionPrice

    const session = await mongoose.startSession()
    try {
      session.startTransaction()

      // Re-check conflicts inside transaction to prevent race condition (TOCTOU).
      // So trùng theo OVERLAP thời gian (không chỉ so chuỗi slot): chặn đè giờ bán phần.
      const slotRange = normalizeSlot(slot)
      const [memberBookings, ptBookings] = await Promise.all([
        Booking.find({
          memberId: req.user._id,
          date: bookingDate,
          status: { $in: activeStatus },
        }).session(session).lean(),
        Booking.find({
          ptId,
          date: bookingDate,
          status: { $in: activeStatus },
        }).session(session).lean(),
      ])

      const memberConflict = memberBookings.find((b) => {
        const r = normalizeSlot(b.slot)
        return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
      })

      const ptConflict = ptBookings.find((b) => {
        const r = normalizeSlot(b.slot)
        return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
      })

      if (memberConflict) {
        await session.abortTransaction()
        return res.status(400).json({
          message: 'Bạn đã có lịch tập ở khung giờ này',
        })
      }

      if (ptConflict) {
        await session.abortTransaction()
        return res.status(400).json({
          message: 'PT đã có người đặt khung giờ này',
        })
      }

      // PT đã có buổi 1-1 khác (booking/workout schedule) đè giờ hoặc trùng giờ → chặn
      const ptScheduleConflicts = await findPTMemberConflicts({
        ptId,
        date: bookingDate,
        slot,
        session,
      }).then((list) => list.filter((c) => c.source === 'schedule'))
      if (ptScheduleConflicts.length > 0) {
        await session.abortTransaction()
        return res.status(400).json({
          message: `PT đã có buổi tập khác trùng khung giờ này (${ptScheduleConflicts[0].memberName}). Vui lòng chọn khung giờ khác.`,
        })
      }

      const booking = await Booking.create([{
        memberId: req.user._id,
        ptId,
        date: bookingDate,
        slot,
        note,
        trainingType: finalTrainingType,
        priceAtBooking,
        totalAmount: priceAtBooking,
        paymentStatus: 'unpaid',
        status: 'pending',
      }], { session })

      const createdBooking = booking[0]

      await session.commitTransaction()

      await createNotification({
        receiverId: ptId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
        title: 'Có lịch đặt mới',
        content: `Hội viên đã đặt lịch tập vào ${bookingDate.toLocaleDateString('vi-VN')}, slot ${slot}.`,
        relatedId: createdBooking._id,
        relatedType: 'Booking',
        redirectUrl: '/pt/bookings',
        createdBy: 'System',
      })

      return res.status(201).json({
        message: 'Đặt lịch thành công, chờ PT xác nhận',
        booking: createdBooking,
      })
    } catch (createErr) {
      await session.abortTransaction()
      // Handle unique index violation (E11000) from the partial unique index on { ptId, date, slot }
      if (createErr.code === 11000) {
        return res.status(409).json({
          message: 'Khung giờ này đã có người đặt, vui lòng chọn giờ khác.',
        })
      }
      throw createErr
    } finally {
      session.endSession()
    }
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi đặt lịch',
      error: error.message,
    })
  }
}

export const createRecurringBooking = async (req, res) => {
  try {
    const { ptId, date, slot, note, weeks } = req.body

    if (!ptId || !date || !slot || !weeks) {
      return res.status(400).json({
        message: 'Thiếu ptId, date, slot hoặc weeks',
      })
    }

    const lastBookingDate = normalizeDate(date)
    lastBookingDate.setDate(lastBookingDate.getDate() + (Number(weeks) - 1) * 7)
    if (!(await requireActiveMembershipForDate(req.user._id, lastBookingDate, res))) return

    // FIX: standardize feature code to match createBooking
    const featureCheck = await checkMemberFeature(req.user._id, 'BOOK_PT_PRIVATE')
    if (!featureCheck.allowed) {
      return res.status(403).json({ message: featureCheck.reason })
    }

    // Snapshot giá buổi từ cấu hình giá PT (nếu có) — chỉ để hiển thị, không bắt buộc thanh toán.
    const ptProfile = await PT.findOne({ userId: ptId }).lean()
    if (!ptProfile) {
      return res.status(404).json({ message: 'Không tìm thấy PT' })
    }
    const sessionPrice = ptProfile.oneToOnePrice || 0

    const session = await mongoose.startSession()
    const createdBookings = []
    const conflicts = []

    try {
      session.startTransaction()

      for (let i = 0; i < Number(weeks); i++) {
        const bookingDate = normalizeDate(date)
        bookingDate.setDate(bookingDate.getDate() + i * 7)

        // Gói tập phải còn hiệu lực tại từng ngày trong chuỗi
        if (!(await hasActiveMembershipForDate(req.user._id, bookingDate))) {
          conflicts.push({
            date: bookingDate,
            slot,
            reason: 'Ngày này nằm ngoài thời gian hiệu lực gói tập',
          })
          continue
        }

        // Kiểm tra lịch làm việc của PT cho từng ngày trong chuỗi lặp
        const scheduleCheck = await validatePTAssignment({ trainerId: ptId, date: bookingDate, slot })
        if (!scheduleCheck.ok) {
          conflicts.push({
            date: bookingDate,
            slot,
            reason: scheduleCheck.message,
          })
          continue
        }

        const slotRange = normalizeSlot(slot)
        const [memberBookings, ptBookings] = await Promise.all([
          Booking.find({
            memberId: req.user._id,
            date: bookingDate,
            status: { $in: activeStatus },
          }).session(session).lean(),
          Booking.find({
            ptId,
            date: bookingDate,
            status: { $in: activeStatus },
          }).session(session).lean(),
        ])

        const memberConflict = memberBookings.find((b) => {
          const r = normalizeSlot(b.slot)
          return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
        })
        const ptConflict = ptBookings.find((b) => {
          const r = normalizeSlot(b.slot)
          return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
        })

        if (memberConflict || ptConflict) {
          conflicts.push({
            date: bookingDate,
            slot,
            reason: 'Trùng lịch member hoặc PT',
          })
          continue
        }

        const ptScheduleConflicts = await findPTMemberConflicts({
          ptId,
          date: bookingDate,
          slot,
          session,
        }).then((list) => list.filter((c) => c.source === 'schedule'))
        if (ptScheduleConflicts.length > 0) {
          conflicts.push({
            date: bookingDate,
            slot,
            reason: 'PT có buổi tập khác trùng khung giờ này',
          })
          continue
        }

        try {
          const [booking] = await Booking.create([{
            memberId: req.user._id,
            ptId,
            date: bookingDate,
            slot,
            note,
            trainingType: 'one_to_one',
            priceAtBooking: sessionPrice,
            totalAmount: sessionPrice,
            paymentStatus: 'unpaid',
            status: 'pending',
          }], { session })

          createdBookings.push(booking)
        } catch (createErr) {
          if (createErr.code === 11000) {
            conflicts.push({
              date: bookingDate,
              slot,
              reason: 'Khung giờ này đã có người đặt, vui lòng chọn giờ khác.',
            })
            continue
          }
          throw createErr
        }
      }

      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }

    return res.status(201).json({
      message: 'Đặt lịch lặp lại hoàn tất',
      createdCount: createdBookings.length,
      conflictCount: conflicts.length,
      createdBookings,
      conflicts,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi đặt lịch lặp lại',
      error: error.message,
    })
  }
}

function getNextWeekDate(dayOfWeek, weekOffset = 0) {
  const now = new Date()
  const currentDay = now.getDay()
  const diff = dayOfWeek - currentDay + (dayOfWeek <= currentDay ? 7 : 0)
  if (diff === 0) return normalizeDate(now.getTime() + (7 + weekOffset * 7) * 24 * 60 * 60 * 1000)
  const next = new Date(now.getTime() + (diff + weekOffset * 7) * 24 * 60 * 60 * 1000)
  return normalizeDate(next)
}

export const scheduleWeeklyBooking = async (req, res) => {
  try {
    const { ptId, time, note } = req.body
    const weeks = Math.min(Math.max(Number(req.body.weeks) || 1, 1), 12)

    // Mỗi ngày 1 khung giờ riêng: daySlots = [{ day, slot }]
    let daySlots = null
    if (Array.isArray(req.body.daySlots) && req.body.daySlots.length) {
      daySlots = req.body.daySlots.map((item) => ({
        day: Number(item?.day),
        slot: String(item?.slot || '').trim(),
      }))
    } else if (Array.isArray(req.body.daysOfWeek) && req.body.daysOfWeek.length && time) {
      daySlots = req.body.daysOfWeek.map((day) => ({ day: Number(day), slot: time }))
    }
    if (!daySlots || daySlots.length === 0) {
      return res.status(400).json({
        message: 'Thiếu thông tin: ptId, daySlots (mỗi ngày 1 khung giờ)',
      })
    }
    const invalidPair = daySlots.find((p) => !Number.isInteger(p.day) || p.day < 0 || p.day > 6 || !p.slot)
    if (invalidPair) {
      return res.status(400).json({
        message: 'daySlots không hợp lệ: mỗi mục cần day (0-6) và slot',
      })
    }

    // FIX: standardize feature code to match createBooking
    const featureCheck = await checkMemberFeature(req.user._id, 'BOOK_PT_PRIVATE')
    if (!featureCheck.allowed) {
      return res.status(403).json({ message: featureCheck.reason })
    }

    // Snapshot giá buổi từ cấu hình giá PT (nếu có) — chỉ để hiển thị, không bắt buộc thanh toán.
    const ptProfile = await PT.findOne({ userId: ptId }).lean()
    if (!ptProfile) {
      return res.status(404).json({ message: 'Không tìm thấy PT' })
    }
    const sessionPrice = ptProfile.oneToOnePrice || 0

    const session = await mongoose.startSession()
    const results = []
    const errors = []

    try {
      session.startTransaction()

      for (const { day, slot } of daySlots) {
        for (let weekOffset = 0; weekOffset < weeks; weekOffset++) {
          const bookingDate = getNextWeekDate(day, weekOffset)

        if (!(await requireActiveMembershipForDate(req.user._id, bookingDate, res))) {
          await session.abortTransaction()
          return
        }

        // Kiểm tra lịch làm việc của PT cho từng ngày đăng ký
        const scheduleCheck = await validatePTAssignment({ trainerId: ptId, date: bookingDate, slot })
        if (!scheduleCheck.ok) {
          errors.push({
            day,
            date: bookingDate,
            slot,
            reason: scheduleCheck.message,
          })
          continue
        }

        const slotRange = normalizeSlot(slot)
        const [memberBookings, ptBookings] = await Promise.all([
          Booking.find({
            memberId: req.user._id,
            date: bookingDate,
            status: { $in: activeStatus },
          }).session(session).lean(),
          Booking.find({
            ptId,
            date: bookingDate,
            status: { $in: activeStatus },
          }).session(session).lean(),
        ])

        const memberConflict = memberBookings.find((b) => {
          const r = normalizeSlot(b.slot)
          return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
        })
        const ptConflict = ptBookings.find((b) => {
          const r = normalizeSlot(b.slot)
          return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
        })

        if (memberConflict || ptConflict) {
          errors.push({
            day,
            date: bookingDate,
            slot,
            reason: 'Trùng lịch, vui lòng chọn giờ khác',
          })
          continue
        }

        const ptScheduleConflicts = await findPTMemberConflicts({
          ptId,
          date: bookingDate,
          slot,
          session,
        }).then((list) => list.filter((c) => c.source === 'schedule'))
        if (ptScheduleConflicts.length > 0) {
          errors.push({
            day,
            date: bookingDate,
            slot,
            reason: 'PT có buổi tập khác trùng khung giờ này',
          })
          continue
        }

        try {
          const [booking] = await Booking.create([{
            memberId: req.user._id,
            ptId,
            date: bookingDate,
            slot,
            note,
            trainingType: 'one_to_one',
            priceAtBooking: sessionPrice,
            totalAmount: sessionPrice,
            paymentStatus: 'unpaid',
            status: 'pending',
          }], { session })

          results.push(booking)
        } catch (createErr) {
          if (createErr.code === 11000) {
            errors.push({
              day,
              date: bookingDate,
              slot,
              reason: 'Khung giờ này đã có người đặt, vui lòng chọn giờ khác.',
            })
            continue
          }
          throw createErr
        }
      }
      }

      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }

    return res.status(201).json({
      message: 'Gửi yêu cầu đăng ký lịch tập thành công',
      createdCount: results.length,
      createdBookings: results,
      errors,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi đăng ký lịch tập',
      error: error.message,
    })
  }
}

export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      memberId: req.user._id,
    })
      .populate('ptId', 'name fullName email phone avatar')
      .sort({ date: 1, slot: 1 })

    return res.json(bookings)
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi lấy lịch của member',
      error: error.message,
    })
  }
}

export const getPTBookings = async (req, res) => {
  try {
    const { filter, memberId, status, from } = req.query

    const query = {
      ptId: req.user._id,
    }

    const today = normalizeDate(new Date())

    if (filter === 'today') {
      query.date = today
    }

    if (filter === 'week') {
      const endWeek = new Date(today)
      endWeek.setDate(today.getDate() + 7)

      query.date = {
        $gte: today,
        $lte: endWeek,
      }
    }

    if (status) {
      query.status = status
    }

    if (from === 'today') {
      query.date = { $gte: today }
    }

    if (memberId) {
      query.memberId = memberId
    }

    const bookings = await Booking.find(query)
      .populate('memberId', 'name fullName email phone avatar memberCode')
      .sort({ date: 1, slot: 1 })

    return res.json(bookings)
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi lấy lịch của PT',
      error: error.message,
    })
  }
}

export const rejectAllPendingBookings = async (req, res) => {
  try {
    const today = normalizeDate(new Date())

    const result = await Booking.updateMany(
      {
        ptId: req.user._id,
        status: 'pending',
        date: { $gte: today },
      },
      {
        $set: {
          status: 'cancelled',
          rejectReason: 'PT từ chối tất cả lịch chờ xác nhận',
        },
      }
    )

    return res.json({
      message: 'Đã từ chối tất cả lịch chờ xác nhận',
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi từ chối lịch',
      error: error.message,
    })
  }
}

export const confirmBooking = async (req, res) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    const booking = await Booking.findOne({
      _id: req.params.id,
      ptId: req.user._id,
    }).session(session)

    if (!booking) {
      await session.abortTransaction()
      return res.status(404).json({
        message: 'Không tìm thấy lịch đặt',
      })
    }

    // PT acceptance chỉ cần booking còn ở trạng thái chờ xác nhận.
    // Không còn bước thanh toán: xác nhận xong là hoàn tất luôn.
    if (!['pending', 'awaiting_payment'].includes(booking.status)) {
      await session.abortTransaction()
      return res.status(409).json({
        message: `Lịch đặt đang ở trạng thái ${booking.status}, không thể xác nhận`,
      })
    }

    // Sát giờ: không xác nhận buổi đã bắt đầu/đã qua — tránh member bị kẹt lịch đã trôi qua
    if (getBookingStartDateTime(booking.date, booking.slot) <= new Date()) {
      await session.abortTransaction()
      return res.status(409).json({
        message: 'Buổi tập đã bắt đầu hoặc đã qua, không thể xác nhận lịch này nữa. Hội viên cần đặt lịch mới.',
      })
    }

    // Gói tập của member phải còn hiệu lực tại ngày buổi tập
    if (!(await hasActiveMembershipForDate(booking.memberId, booking.date))) {
      await session.abortTransaction()
      return res.status(409).json({
        message: 'Hội viên không có gói tập còn hiệu lực tại thời điểm buổi tập này. Không thể xác nhận lịch.',
      })
    }

    booking.status = 'confirmed'
    booking.paymentStatus = booking.paymentStatus === 'paid' ? 'paid' : 'unpaid'
    booking.paymentDeadline = null
    await booking.save({ session })

    await session.commitTransaction()

    await createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      title: 'Lịch tập đã được PT xác nhận',
      content: `Lịch tập của bạn đã được PT xác nhận. Chúc bạn tập luyện hiệu quả!`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/workout',
      createdBy: 'PT',
    })

    return res.json({
      message: 'Đã xác nhận lịch',
      booking,
    })
  } catch (error) {
    await session.abortTransaction()
    return res.status(500).json({
      message: 'Lỗi xác nhận lịch',
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

export const rejectBooking = async (req, res) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    const { reason } = req.body

    const booking = await Booking.findOne({
      _id: req.params.id,
      ptId: req.user._id,
    }).session(session)

    if (!booking) {
      await session.abortTransaction()
      return res.status(404).json({
        message: 'Không tìm thấy lịch đặt',
      })
    }

    // Chính sách hoàn tiền: PT từ chối lịch đã thanh toán → hoàn 100% về ví hội viên
    let refunded = false
    if (booking.paymentStatus === 'paid' && Number(booking.totalAmount || 0) > 0) {
      await applyWalletTransaction({
        userId: booking.memberId,
        amount: Number(booking.totalAmount),
        type: 'refund',
        provider: 'wallet',
        source: 'pt_booking_refund',
        description: `Hoàn tiền buổi PT ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot} (PT từ chối lịch)`,
        referenceId: booking._id.toString(),
        status: 'completed',
        metadata: { bookingId: booking._id.toString(), ptId: booking.ptId, reason: 'pt_reject' },
        idempotencyKey: `pt_booking_refund_${booking._id}`,
        session,
      })
      booking.paymentStatus = 'refunded'
      refunded = true
    }

    booking.status = 'cancelled'
    booking.rejectReason = reason || 'PT từ chối lịch'
    await booking.save({ session })

    await session.commitTransaction()

    await createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.BOOKING_REJECTED,
      title: 'Lịch tập bị PT từ chối',
      content: `Lịch tập của bạn đã bị PT từ chối${refunded ? '. Số tiền đã thanh toán sẽ được hoàn về ví.' : ''} Lý do: ${reason || 'Không có lý do.'}`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/booking',
      createdBy: 'PT',
    })

    recordAuditLog({
      req,
      module: 'booking',
      action: 'pt_reject_booking',
      entity: booking,
      entityName: `Booking ${booking._id}`,
      details: `PT từ chối lịch${refunded ? ` — hoàn tiền ${Number(booking.totalAmount).toLocaleString('vi-VN')}đ về ví hội viên` : ''}`,
    }).catch((err) => console.error('Audit reject booking failed:', err.message))

    return res.json({
      message: refunded
        ? 'Đã từ chối lịch. Tiền của hội viên đã được hoàn về ví.'
        : 'Đã từ chối lịch',
      booking,
    })
  } catch (error) {
    await session.abortTransaction()
    return res.status(500).json({
      message: 'Lỗi từ chối lịch',
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

export const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    const { reason } = req.body

    const booking = await Booking.findOne({
      _id: req.params.id,
      memberId: req.user._id,
    }).session(session)

    if (!booking) {
      await session.abortTransaction()
      return res.status(404).json({
        message: 'Không tìm thấy lịch đặt',
      })
    }

    const now = new Date()
    const bookingStart = getBookingStartDateTime(booking.date, booking.slot)
    const diffHours = (bookingStart - now) / (1000 * 60 * 60)

    // Chính sách hoàn tiền: hủy trước 24h → hoàn 100% về ví; hủy trong vòng 24h → giữ tiền phạt (isViolation)
    let refunded = false
    if (
      booking.paymentStatus === 'paid' &&
      Number(booking.totalAmount || 0) > 0 &&
      diffHours >= 24
    ) {
      await applyWalletTransaction({
        userId: req.user._id,
        amount: Number(booking.totalAmount),
        type: 'refund',
        provider: 'wallet',
        source: 'pt_booking_refund',
        description: `Hoàn tiền hủy lịch PT ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot} (hủy trước 24h)`,
        referenceId: booking._id.toString(),
        status: 'completed',
        metadata: { bookingId: booking._id.toString(), ptId: booking.ptId, reason: 'member_cancel' },
        idempotencyKey: `pt_booking_refund_${booking._id}`,
        session,
      })
      booking.paymentStatus = 'refunded'
      refunded = true
    }

    booking.status = 'cancelled'
    booking.cancelReason = reason || 'Member hủy lịch'
    booking.isViolation = diffHours < 24

    await booking.save({ session })

    const bookingSlotId = makeSlotId(booking.ptId, booking.date, booking.slot)

    const firstWaitlist = await Waitlist.findOne({
      bookingSlotId,
      notifiedAt: null,
    }).sort({ createdAt: 1 }).session(session)

    if (firstWaitlist) {
      firstWaitlist.notifiedAt = new Date()
      await firstWaitlist.save({ session })
    }

    await session.commitTransaction()

    const memberName = req.user?.fullName || req.user?.name || 'Hội viên'
    const memberCode = req.user?.memberCode || ''
    const ptInfo = await User.findById(booking.ptId).select('fullName name').lean()

    createNotification({
      receiverId: booking.ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã hủy lịch PT 1-1',
      content: `Hội viên ${memberName}${memberCode ? ` (${memberCode})` : ''} đã hủy buổi tập ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot}${reason ? `. Lý do: ${reason}` : ''}.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/pt/bookings',
      createdBy: 'System',
    }).catch(err => console.error('Notify PT booking cancelled failed:', err.message))

    createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã hủy lịch PT 1-1',
      content: `Hội viên ${memberName}${memberCode ? ` (${memberCode})` : ''} đã hủy buổi tập ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot}. PT phụ trách: ${ptInfo?.fullName || ptInfo?.name || '—'}.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/admin/members',
      createdBy: 'System',
    }).catch(err => console.error('Notify admin booking cancelled failed:', err.message))

    if (refunded) {
      createNotification({
        receiverId: booking.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.REFUND_APPROVED,
        title: 'Hoàn tiền hủy lịch PT',
        content: `Đã hoàn ${Number(booking.totalAmount).toLocaleString('vi-VN')}đ về ví cho buổi ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot}.`,
        relatedId: booking._id,
        relatedType: 'Booking',
        redirectUrl: '/wallet',
        createdBy: 'System',
      }).catch(err => console.error('Notify member refund failed:', err.message))

      recordAuditLog({
        req,
        module: 'booking',
        action: 'member_cancel_booking',
        entity: booking,
        entityName: `Booking ${booking._id}`,
        details: `Hội viên hủy trước 24h — hoàn tiền ${Number(booking.totalAmount).toLocaleString('vi-VN')}đ về ví`,
      }).catch((err) => console.error('Audit refund failed:', err.message))
    }

    return res.json({
      message: refunded
        ? 'Hủy lịch thành công. Tiền đã được hoàn về ví của bạn.'
        : booking.isViolation
          ? 'Hủy lịch thành công. Ghi nhận vi phạm do hủy trong vòng 24h'
          : 'Hủy lịch thành công',
      booking,
      notifiedWaitlistMember: firstWaitlist || null,
    })
  } catch (error) {
    await session.abortTransaction()
    return res.status(500).json({
      message: 'Lỗi hủy lịch',
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

export const rescheduleBooking = async (req, res) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    // P10: member đổi lịch phải qua PT xác nhận (requestRescheduleBooking).
    // Endpoint này chỉ còn dành cho staff/admin đổi lịch trực tiếp.
    if (!['staff', 'admin', 'super_admin'].includes(req.user.role)) {
      await session.abortTransaction()
      return res.status(403).json({ message: 'Bạn không có quyền đổi lịch trực tiếp. Hội viên đổi lịch cần PT xác nhận.' })
    }

    const { date, slot, reason } = req.body

    if (!date || !slot) {
      await session.abortTransaction()
      return res.status(400).json({
        message: 'Thiếu ngày hoặc khung giờ mới',
      })
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      ...(['staff', 'admin', 'super_admin'].includes(req.user.role) ? {} : { memberId: req.user._id }),
    }).session(session)

    if (!booking) {
      await session.abortTransaction()
      return res.status(404).json({
        message: 'Không tìm thấy lịch đặt',
      })
    }

    if (!['pending', 'awaiting_payment', 'confirmed'].includes(booking.status)) {
      await session.abortTransaction()
      return res.status(400).json({
        message: 'Chỉ có thể đổi lịch khi buổi tập còn hiệu lực',
      })
    }

    const oldDate = booking.date
    const oldSlot = booking.slot
    const newDate = normalizeDate(date)

    if (getBookingStartDateTime(newDate, slot) <= new Date()) {
      await session.abortTransaction()
      return res.status(400).json({
        message: 'Không thể đổi sang thời gian đã qua',
      })
    }

// Staff/admin đổi lịch phải kiểm tra gói tập của HỘI VIÊN (không phải staff)
    if (!(await hasActiveMembershipForDate(booking.memberId, newDate))) {
      await session.abortTransaction()
      return res.status(403).json({
        message: 'Hội viên không có gói tập còn hiệu lực tại thời điểm ngày đổi mới. Không thể đổi lịch.',
      })
    }

    const scheduleCheck = await validatePTAssignment({
      trainerId: booking.ptId,
      date: newDate,
      slot,
      session,
    })

    if (!scheduleCheck.ok) {
      await session.abortTransaction()
      return res.status(400).json({ message: scheduleCheck.message })
    }

    // So trùng theo OVERLAP thời gian, loại trừ chính booking đang đổi
    const slotRange = normalizeSlot(slot)
    const [memberBookings, ptBookings] = await Promise.all([
      Booking.find({
        memberId: booking.memberId,
        date: newDate,
        status: { $in: activeStatus },
        _id: { $ne: booking._id },
      }).session(session).lean(),
      Booking.find({
        ptId: booking.ptId,
        date: newDate,
        status: { $in: activeStatus },
        _id: { $ne: booking._id },
      }).session(session).lean(),
    ])

    const memberConflict = memberBookings.find((b) => {
      const r = normalizeSlot(b.slot)
      return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
    })
    const ptConflict = ptBookings.find((b) => {
      const r = normalizeSlot(b.slot)
      return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
    })

    if (memberConflict || ptConflict) {
      await session.abortTransaction()
      return res.status(409).json({
        message: memberConflict
          ? 'Hội viên đã có lịch tập ở khung giờ này'
          : 'PT đã có người đặt khung giờ này',
      })
    }

    // PT đã có buổi 1-1 khác (workout schedule) đè giờ → chặn
    const ptScheduleConflicts = await findPTMemberConflicts({
      ptId: booking.ptId,
      date: newDate,
      slot,
      excludeBookingId: booking._id,
      excludeMemberId: booking.memberId,
      session,
    })
    if (ptScheduleConflicts.some((c) => c.source === 'schedule')) {
      await session.abortTransaction()
      return res.status(409).json({
        message: `PT đã có buổi tập khác trùng khung giờ này (${ptScheduleConflicts.find((c) => c.source === 'schedule')?.memberName}). Vui lòng chọn khung giờ khác.`,
      })
    }

    booking.date = newDate
    booking.slot = slot
    booking.rescheduleReason = reason || ''
    booking.rescheduledAt = new Date()
    booking.rescheduledFrom = {
      date: oldDate,
      slot: oldSlot,
    }

    await booking.save({ session })
    await session.commitTransaction()

    await createNotification({
      receiverId: booking.ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã đổi lịch PT',
      content: `Hội viên đã đổi lịch từ ${normalizeDate(oldDate).toLocaleDateString('vi-VN')} ${oldSlot} sang ${newDate.toLocaleDateString('vi-VN')} ${slot}.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/pt/bookings',
      createdBy: 'System',
    })

    const memberName = req.user?.fullName || req.user?.name || 'Hội viên'
    const memberCode = req.user?.memberCode || ''
    const ptInfo = await User.findById(booking.ptId).select('fullName name').lean()

    await createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã đổi lịch PT 1-1',
      content: `Hội viên ${memberName}${memberCode ? ` (${memberCode})` : ''} đã đổi lịch từ ${normalizeDate(oldDate).toLocaleDateString('vi-VN')} ${oldSlot} sang ${newDate.toLocaleDateString('vi-VN')} ${slot}. PT phụ trách: ${ptInfo?.fullName || ptInfo?.name || '—'}.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/admin/members',
      createdBy: 'System',
    })

    return res.json({
      message: 'Đổi lịch tập thành công',
      booking,
    })
  } catch (error) {
    await session.abortTransaction()

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Khung giờ này đã có người đặt, vui lòng chọn giờ khác.',
      })
    }

    return res.status(500).json({
      message: 'Lỗi đổi lịch tập',
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

/**
 * P10: Member gửi yêu cầu đổi lịch buổi PT đã xác nhận — PT phải duyệt mới áp dụng.
 */
export const requestRescheduleBooking = async (req, res) => {
  try {
    const { date, slot, reason } = req.body

    if (!date || !slot) {
      return res.status(400).json({ message: 'Thiếu ngày hoặc khung giờ mới' })
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      memberId: req.user._id,
    })

    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy lịch đặt' })
    }

    if (booking.status !== 'confirmed') {
      return res.status(409).json({ message: 'Chỉ có thể đổi lịch buổi đã được PT xác nhận' })
    }

    if (booking.rescheduleRequest?.status === 'pending') {
      return res.status(409).json({ message: 'Đã có yêu cầu đổi lịch đang chờ PT duyệt. Vui lòng chờ phản hồi hoặc hủy yêu cầu hiện tại.' })
    }

    const oldDate = booking.date
    const oldSlot = booking.slot
    const newDate = normalizeDate(date)

    if (newDate.getTime() === normalizeDate(oldDate).getTime() && slot === oldSlot) {
      return res.status(400).json({ message: 'Thời gian mới trùng với thời gian hiện tại' })
    }

    if (getBookingStartDateTime(newDate, slot) <= new Date()) {
      return res.status(400).json({ message: 'Không thể đổi sang thời gian đã qua' })
    }

    if (!(await requireActiveMembershipForDate(req.user._id, newDate, res))) {
      return
    }

    const scheduleCheck = await validatePTAssignment({
      trainerId: booking.ptId,
      date: newDate,
      slot,
    })

    if (!scheduleCheck.ok) {
      return res.status(400).json({ message: scheduleCheck.message })
    }

    // So trùng theo OVERLAP thời gian, loại trừ chính booking đang đổi
    const slotRange = normalizeSlot(slot)
    const [memberBookings, ptBookings] = await Promise.all([
      Booking.find({
        memberId: req.user._id,
        date: newDate,
        status: { $in: activeStatus },
        _id: { $ne: booking._id },
      }).lean(),
      Booking.find({
        ptId: booking.ptId,
        date: newDate,
        status: { $in: activeStatus },
        _id: { $ne: booking._id },
      }).lean(),
    ])

    const memberConflict = memberBookings.find((b) => {
      const r = normalizeSlot(b.slot)
      return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
    })
    const ptConflict = ptBookings.find((b) => {
      const r = normalizeSlot(b.slot)
      return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
    })

    if (memberConflict || ptConflict) {
      return res.status(409).json({
        message: memberConflict
          ? 'Bạn đã có lịch tập ở khung giờ này'
          : 'PT đã có người đặt khung giờ này',
      })
    }

    // PT đã có buổi 1-1 khác (workout schedule) đè giờ → chặn
    const ptScheduleConflicts = await findPTMemberConflicts({
      ptId: booking.ptId,
      date: newDate,
      slot,
      excludeBookingId: booking._id,
      excludeMemberId: req.user._id,
    })
    if (ptScheduleConflicts.some((c) => c.source === 'schedule')) {
      return res.status(409).json({
        message: `PT đã có buổi tập khác trùng khung giờ này (${ptScheduleConflicts.find((c) => c.source === 'schedule')?.memberName}). Vui lòng chọn khung giờ khác.`,
      })
    }

    booking.rescheduleRequest = {
      status: 'pending',
      requestedBy: req.user._id,
      requestedAt: new Date(),
      oldDate,
      oldSlot,
      newDate,
      newSlot: slot,
      reason: reason || '',
      decidedBy: null,
      decidedAt: null,
      decisionNote: '',
    }
    await booking.save()

    const memberName = req.user?.fullName || req.user?.name || 'Hội viên'
    const memberCode = req.user?.memberCode || ''
    await createNotification({
      receiverId: booking.ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.BOOKING_RESCHEDULE_REQUEST,
      title: 'Hội viên yêu cầu đổi lịch PT',
      content: `Hội viên ${memberName}${memberCode ? ` (${memberCode})` : ''} muốn đổi buổi ${normalizeDate(oldDate).toLocaleDateString('vi-VN')} ${oldSlot} sang ${newDate.toLocaleDateString('vi-VN')} ${slot}${reason ? `. Lý do: ${reason}` : ''}. Vui lòng xác nhận.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/pt/bookings',
      createdBy: 'System',
      requiresAction: true,
      actions: ['approve', 'reject'],
      priority: 'high',
    }).catch((err) => console.error('Notify PT reschedule request failed:', err.message))

    return res.json({
      message: 'Đã gửi yêu cầu đổi lịch. PT sẽ xác nhận trước khi buổi mới được áp dụng.',
      booking,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi gửi yêu cầu đổi lịch', error: error.message })
  }
}

/**
 * P10: PT (hoặc staff/admin) duyệt yêu cầu đổi lịch → áp dụng đổi lịch.
 * Re-check xung đột BÊN TRONG transaction để tránh TOCTOU (slot có thể bị lấy mất khi đang chờ duyệt).
 */
export const approveRescheduleBooking = async (req, res) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    const isStaffAction = ['staff', 'admin', 'super_admin'].includes(req.user.role)
    const booking = await Booking.findOne({
      _id: req.params.id,
      ...(isStaffAction ? {} : { ptId: req.user._id }),
    }).session(session)

    if (!booking) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy lịch đặt' })
    }

    const request = booking.rescheduleRequest
    if (!request || request.status !== 'pending') {
      await session.abortTransaction()
      return res.status(409).json({ message: 'Không có yêu cầu đổi lịch nào đang chờ duyệt' })
    }

    if (booking.status !== 'confirmed') {
      await session.abortTransaction()
      return res.status(409).json({ message: `Booking đang ở trạng thái ${booking.status}, không thể đổi lịch` })
    }

    // Re-check xung đột tại thời điểm duyệt (slot có thể đã bị chiếm trong lúc chờ)
    // + gói tập của member phải còn hiệu lực tại ngày mới
    if (!(await hasActiveMembershipForDate(booking.memberId, request.newDate))) {
      booking.rescheduleRequest.status = 'rejected'
      booking.rescheduleRequest.decidedBy = req.user._id
      booking.rescheduleRequest.decidedAt = new Date()
      booking.rescheduleRequest.decisionNote = 'Gói tập của hội viên không còn hiệu lực tại ngày đổi mới.'
      await booking.save({ session })
      await session.commitTransaction()
      return res.status(409).json({ message: 'Gói tập của hội viên không còn hiệu lực tại ngày đổi mới. Yêu cầu đổi lịch đã bị từ chối tự động.' })
    }

    const scheduleCheck = await validatePTAssignment({
      trainerId: booking.ptId,
      date: request.newDate,
      slot: request.newSlot,
      session,
    })
    if (!scheduleCheck.ok) {
      await session.abortTransaction()
      return res.status(409).json({ message: scheduleCheck.message })
    }

    // So trùng theo OVERLAP thời gian, loại trừ chính booking đang đổi
    const slotRange = normalizeSlot(request.newSlot)
    const [memberBookings, ptBookings] = await Promise.all([
      Booking.find({
        memberId: booking.memberId,
        date: request.newDate,
        status: { $in: activeStatus },
        _id: { $ne: booking._id },
      }).session(session).lean(),
      Booking.find({
        ptId: booking.ptId,
        date: request.newDate,
        status: { $in: activeStatus },
        _id: { $ne: booking._id },
      }).session(session).lean(),
    ])

    const memberConflict = memberBookings.find((b) => {
      const r = normalizeSlot(b.slot)
      return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
    })
    const ptConflict = ptBookings.find((b) => {
      const r = normalizeSlot(b.slot)
      return timesOverlap(slotRange.start, slotRange.end, r.start, r.end)
    })

    if (memberConflict || ptConflict) {
      const conflict = memberConflict || ptConflict
      // Slot đã bị chiếm → tự động từ chối, báo member chọn giờ khác
      booking.rescheduleRequest.status = 'rejected'
      booking.rescheduleRequest.decidedBy = req.user._id
      booking.rescheduleRequest.decidedAt = new Date()
      booking.rescheduleRequest.decisionNote = 'Khung giờ mới đã có người đặt khi đang chờ duyệt.'
      await booking.save({ session })
      await session.commitTransaction()

      await createNotification({
        receiverId: booking.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.BOOKING_RESCHEDULE_REJECTED,
        title: 'Yêu cầu đổi lịch bị từ chối',
        content: `Khung giờ ${new Date(request.newDate).toLocaleDateString('vi-VN')} ${request.newSlot} đã có người đặt, yêu cầu đổi lịch không được áp dụng. Vui lòng chọn khung giờ khác.`,
        relatedId: booking._id,
        relatedType: 'Booking',
        redirectUrl: '/booking',
        createdBy: isStaffAction ? 'Staff' : 'PT',
      }).catch((err) => console.error('Notify auto-reject reschedule failed:', err.message))

      return res.status(409).json({ message: `Khung giờ mới đã bị chiếm (${memberConflict ? 'hội viên đã có lịch' : 'PT bận'}). Yêu cầu đổi lịch đã bị từ chối tự động.` })
    }

    // PT đã có buổi 1-1 khác (workout schedule) đè giờ → chặn
    const ptScheduleConflicts = await findPTMemberConflicts({
      ptId: booking.ptId,
      date: request.newDate,
      slot: request.newSlot,
      excludeBookingId: booking._id,
      excludeMemberId: booking.memberId,
      session,
    })
    if (ptScheduleConflicts.some((c) => c.source === 'schedule')) {
      booking.rescheduleRequest.status = 'rejected'
      booking.rescheduleRequest.decidedBy = req.user._id
      booking.rescheduleRequest.decidedAt = new Date()
      booking.rescheduleRequest.decisionNote = 'Khung giờ mới trùng buổi tập khác của PT.'
      await booking.save({ session })
      await session.commitTransaction()

      await createNotification({
        receiverId: booking.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.BOOKING_RESCHEDULE_REJECTED,
        title: 'Yêu cầu đổi lịch bị từ chối',
        content: `Khung giờ mới trùng với một buổi tập khác của PT. Vui lòng chọn khung giờ khác.`,
        relatedId: booking._id,
        relatedType: 'Booking',
        redirectUrl: '/booking',
        createdBy: isStaffAction ? 'Staff' : 'PT',
      }).catch((err) => console.error('Notify auto-reject reschedule failed:', err.message))

      return res.status(409).json({ message: 'Khung giờ mới trùng với buổi tập khác của PT. Yêu cầu đổi lịch đã bị từ chối tự động.' })
    }

    const oldDate = booking.date
    const oldSlot = booking.slot

    booking.date = request.newDate
    booking.slot = request.newSlot
    booking.rescheduleReason = request.reason || ''
    booking.rescheduledAt = new Date()
    booking.rescheduledFrom = { date: oldDate, slot: oldSlot }
    booking.rescheduleRequest.status = 'approved'
    booking.rescheduleRequest.decidedBy = req.user._id
    booking.rescheduleRequest.decidedAt = new Date()

    await booking.save({ session })
    await session.commitTransaction()

    const member = await User.findById(booking.memberId).select('fullName name memberCode').lean()
    const ptName = req.user?.fullName || req.user?.name || 'PT'
    await createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.BOOKING_RESCHEDULE_APPROVED,
      title: 'Đổi lịch PT thành công',
      content: `PT đã xác nhận đổi buổi ${normalizeDate(oldDate).toLocaleDateString('vi-VN')} ${oldSlot} sang ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot}.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/booking',
      createdBy: isStaffAction ? 'Staff' : 'PT',
    }).catch((err) => console.error('Notify member reschedule approved failed:', err.message))

    await createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Đã đổi lịch buổi PT 1-1',
      content: `Hội viên ${member?.fullName || member?.name || ''}${member?.memberCode ? ` (${member.memberCode})` : ''} đổi lịch từ ${normalizeDate(oldDate).toLocaleDateString('vi-VN')} ${oldSlot} sang ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot} (duyệt bởi ${ptName}).`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/admin/members',
      createdBy: 'System',
    }).catch((err) => console.error('Notify admin reschedule failed:', err.message))

    return res.json({
      message: 'Đã duyệt yêu cầu đổi lịch. Buổi mới đã được áp dụng.',
      booking,
    })
  } catch (error) {
    await session.abortTransaction()
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Khung giờ này đã có người đặt, vui lòng chọn giờ khác.' })
    }
    return res.status(500).json({ message: 'Lỗi duyệt đổi lịch', error: error.message })
  } finally {
    session.endSession()
  }
}

/**
 * P10: PT (hoặc staff/admin) từ chối yêu cầu đổi lịch của member.
 */
export const rejectRescheduleBooking = async (req, res) => {
  try {
    const isStaffAction = ['staff', 'admin', 'super_admin'].includes(req.user.role)
    const booking = await Booking.findOne({
      _id: req.params.id,
      ...(isStaffAction ? {} : { ptId: req.user._id }),
    })

    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy lịch đặt' })
    }

    const request = booking.rescheduleRequest
    if (!request || request.status !== 'pending') {
      return res.status(409).json({ message: 'Không có yêu cầu đổi lịch nào đang chờ duyệt' })
    }

    request.status = 'rejected'
    request.decidedBy = req.user._id
    request.decidedAt = new Date()
    request.decisionNote = String(req.body?.note || '').trim()
    booking.markModified('rescheduleRequest')
    await booking.save()

    await createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.BOOKING_RESCHEDULE_REJECTED,
      title: 'Yêu cầu đổi lịch bị từ chối',
      content: `PT từ chối đổi buổi ${normalizeDate(request.oldDate).toLocaleDateString('vi-VN')} ${request.oldSlot} sang ${new Date(request.newDate).toLocaleDateString('vi-VN')} ${request.newSlot}${request.decisionNote ? `. Lý do: ${request.decisionNote}` : ''}. Buổi tập giữ nguyên.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/booking',
      createdBy: isStaffAction ? 'Staff' : 'PT',
    }).catch((err) => console.error('Notify member reschedule rejected failed:', err.message))

    return res.json({
      message: 'Đã từ chối yêu cầu đổi lịch. Buổi tập giữ nguyên.',
      booking,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi từ chối đổi lịch', error: error.message })
  }
}

/**
 * P10: Member hủy yêu cầu đổi lịch đang chờ duyệt.
 */
export const cancelRescheduleRequest = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      memberId: req.user._id,
    })

    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy lịch đặt' })
    }

    const request = booking.rescheduleRequest
    if (!request || request.status !== 'pending') {
      return res.status(409).json({ message: 'Không có yêu cầu đổi lịch nào đang chờ duyệt' })
    }

    request.status = 'cancelled'
    booking.markModified('rescheduleRequest')
    await booking.save()

    await createNotification({
      receiverId: booking.ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Yêu cầu đổi lịch đã được hủy',
      content: `Hội viên đã hủy yêu cầu đổi lịch từ ${normalizeDate(request.oldDate).toLocaleDateString('vi-VN')} ${request.oldSlot} sang ${new Date(request.newDate).toLocaleDateString('vi-VN')} ${request.newSlot}. Buổi tập giữ nguyên.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/pt/bookings',
      createdBy: 'System',
    }).catch((err) => console.error('Notify PT reschedule cancelled failed:', err.message))

    return res.json({
      message: 'Đã hủy yêu cầu đổi lịch. Buổi tập giữ nguyên.',
      booking,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi hủy yêu cầu đổi lịch', error: error.message })
  }
}

export const completeBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      ptId: req.user._id,
    })

    if (!booking) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch đặt',
      })
    }

    // Chỉ hoàn thành được buổi đã xác nhận và đã tới giờ (hoặc đang diễn ra)
    if (booking.status !== 'confirmed') {
      return res.status(409).json({
        message: `Lịch đặt đang ở trạng thái ${booking.status}, không thể hoàn thành`,
      })
    }
    const sessionStart = getBookingStartDateTime(booking.date, booking.slot)
    if (sessionStart > new Date()) {
      return res.status(400).json({
        message: 'Buổi tập chưa diễn ra, chưa thể đánh dấu hoàn thành',
      })
    }

    // P1: chỉ hoàn thành khi member ĐÃ check-in buổi này — check-in là nguồn xác thực sự có mặt.
    // Không có check-in → member không đến: phải đi qua luồng no-show / điểm danh PT / needs_review.
    const memberCheckedIn = await CheckIn.exists({
      memberId: booking.memberId,
      bookingId: booking._id,
      status: 'success',
    })
    if (!memberCheckedIn) {
      return res.status(409).json({
        message: 'Hội viên chưa check-in buổi này, không thể hoàn thành. Hãy điểm danh PT hoặc đánh dấu no-show để hệ thống chốt đúng kết quả.',
      })
    }

    booking.status = 'completed'
    booking.completedAt = new Date()

    await booking.save()

    await createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PT_SESSION_COMPLETED,
      title: 'Buổi tập đã hoàn thành',
      content: `PT đã đánh dấu buổi tập của bạn là hoàn thành.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/booking',
      createdBy: 'PT',
    })

    return res.json({
      message: 'Đã hoàn thành buổi tập',
      booking,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi hoàn thành buổi tập',
      error: error.message,
    })
  }
}

const assertBookingSessionBegun = (booking, res) => {
  const sessionStart = getBookingStartDateTime(booking.date, booking.slot)
  if (sessionStart > new Date()) {
    res.status(400).json({ message: 'Buổi tập chưa diễn ra, chưa thể ghi nhận kết quả' })
    return false
  }
  return true
}

export const markBookingMemberNoShow = async (req, res) => {
  try {
    // P1: PT chỉ xử lý được booking của mình; staff/admin xử lý được tất cả (quầy lễ tân)
    const isStaffAction = ['staff', 'admin', 'super_admin'].includes(req.user.role)
    const booking = await Booking.findOne({
      _id: req.params.id,
      ...(isStaffAction ? {} : { ptId: req.user._id }),
    })

    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy lịch đặt' })
    }
    if (booking.status !== 'confirmed') {
      return res.status(409).json({ message: `Lịch đặt đang ở trạng thái ${booking.status}, không thể đánh dấu no-show` })
    }
    if (!assertBookingSessionBegun(booking, res)) return

    // Member đã check-in buổi này → không được đánh no-show
    const memberCheckedIn = await CheckIn.exists({
      memberId: booking.memberId,
      bookingId: booking._id,
      status: 'success',
    })
    if (memberCheckedIn) {
      return res.status(409).json({ message: 'Hội viên đã check-in buổi này. Không thể đánh dấu no-show.' })
    }

    // PT đã được điểm danh VẮNG MẶT → buổi là lỗi của PT, không phải no-show member
    const ptAttendance = await PTSessionAttendance.findOne({ bookingId: booking._id }).lean()
    if (ptAttendance?.status === 'absent') {
      return res.status(409).json({ message: 'PT được ghi nhận vắng mặt ở buổi này. Vui lòng đánh dấu PT no-show (hoàn tiền + đền bù).' })
    }

    booking.status = 'member_no_show'
    booking.noShowMarkedAt = new Date()
    booking.noShowMarkedBy = req.user._id
    booking.autoNoShow = false
    booking.needsReview = false
    booking.noShowReason = String(req.body?.reason || '').trim()
    await booking.save()

    createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PT_SESSION_NO_SHOW,
      title: 'Vắng buổi tập PT',
      content: `Bạn đã vắng buổi PT ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot} mà không hủy trước. Buổi tập đã được tính là no-show.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/booking',
      createdBy: isStaffAction ? 'Staff' : 'PT',
    }).catch((err) => console.error('Notify member no-show failed:', err.message))

    return res.json({
      message: 'Đã đánh dấu hội viên vắng mặt (giữ tiền buổi, tính là đã tiêu 1 buổi)',
      booking,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi đánh dấu no-show', error: error.message })
  }
}

export const markBookingPtNoShow = async (req, res) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    // P1: PT chỉ xử lý được booking của mình; staff/admin xử lý được tất cả
    const isStaffAction = ['staff', 'admin', 'super_admin'].includes(req.user.role)
    const booking = await Booking.findOne({
      _id: req.params.id,
      ...(isStaffAction ? {} : { ptId: req.user._id }),
    }).session(session)

    if (!booking) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy lịch đặt' })
    }
    if (booking.status !== 'confirmed') {
      await session.abortTransaction()
      return res.status(409).json({ message: `Lịch đặt đang ở trạng thái ${booking.status}, không thể đánh dấu PT no-show` })
    }
    if (getBookingStartDateTime(booking.date, booking.slot) > new Date()) {
      await session.abortTransaction()
      return res.status(400).json({ message: 'Buổi tập chưa diễn ra, chưa thể ghi nhận kết quả' })
    }

    // PT được điểm danh CÓ MẶT → không thể tự phủ nhận; dùng dữ liệu điểm danh làm nguồn chính
    const ptAttendance = await PTSessionAttendance.findOne({ bookingId: booking._id }).lean()
    if (ptAttendance?.status === 'present') {
      await session.abortTransaction()
      return res.status(409).json({ message: 'PT đã được điểm danh có mặt ở buổi này. Không thể đánh dấu PT no-show.' })
    }

    const amount = Number(booking.totalAmount || 0)
    const now = new Date()

    // 1) Hoàn 100% tiền buổi về ví
    if (booking.paymentStatus === 'paid' && amount > 0) {
      await applyWalletTransaction({
        userId: booking.memberId,
        amount,
        type: 'refund',
        provider: 'wallet',
        source: 'pt_booking_refund',
        description: `Hoàn 100% buổi PT ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot} (PT không đến)`,
        referenceId: booking._id.toString(),
        status: 'completed',
        metadata: { bookingId: booking._id.toString(), ptId: booking.ptId, reason: 'pt_no_show' },
        idempotencyKey: `pt_booking_refund_${booking._id}`,
        session,
      })
      booking.paymentStatus = 'refunded'

      // 2) Đền bù 1 buổi tập (credit giá trị 1 buổi)
      await applyWalletTransaction({
        userId: booking.memberId,
        amount,
        type: 'compensation',
        provider: 'wallet',
        source: 'pt_booking_compensation',
        description: `Đền bù 1 buổi tập vì PT không đến (buổi ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot})`,
        referenceId: booking._id.toString(),
        status: 'completed',
        metadata: { bookingId: booking._id.toString(), ptId: booking.ptId, reason: 'pt_no_show_compensation' },
        idempotencyKey: `pt_booking_compensation_${booking._id}`,
        session,
      })
    }

    booking.status = 'pt_no_show'
    booking.noShowMarkedAt = now
    booking.noShowMarkedBy = req.user._id
    booking.autoNoShow = false
    booking.needsReview = false
    booking.noShowReason = String(req.body?.reason || '').trim()
    await booking.save({ session })

    await session.commitTransaction()

    createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.REFUND_APPROVED,
      title: 'PT vắng mặt — đã hoàn tiền và đền bù',
      content: `PT không đến buổi ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot}. Đã hoàn ${amount.toLocaleString('vi-VN')}đ về ví và đền bù thêm 1 buổi tập.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/booking',
      createdBy: isStaffAction ? 'Staff' : 'PT',
    }).catch((err) => console.error('Notify pt no-show failed:', err.message))

    return res.json({
      message: 'Đã đánh dấu PT vắng mặt. Hoàn 100% tiền buổi + đền bù 1 buổi cho hội viên.',
      booking,
    })
  } catch (error) {
    await session.abortTransaction()
    return res.status(500).json({ message: 'Lỗi đánh dấu PT no-show', error: error.message })
  } finally {
    session.endSession()
  }
}

/**
 * P1: Ghi nhận điểm danh sự có mặt của PT cho một buổi (present/absent).
 * PT chỉ ghi được cho booking của mình; staff/admin ghi được cho tất cả.
 * Đây là nguồn dữ liệu độc lập với check-in member để chốt kết quả buổi (xem noShowSweeper).
 */
export const markPtAttendance = async (req, res) => {
  try {
    const { status, note } = req.body
    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái điểm danh không hợp lệ (present/absent).' })
    }

    const isStaffAction = ['staff', 'admin', 'super_admin'].includes(req.user.role)
    const booking = await Booking.findOne({
      _id: req.params.id,
      ...(isStaffAction ? {} : { ptId: req.user._id }),
    }).lean()

    if (!booking) {
      return res.status(404).json({ message: 'Không tìm thấy lịch đặt' })
    }
    if (!['confirmed', 'completed', 'member_no_show', 'pt_no_show', 'needs_review'].includes(booking.status)) {
      return res.status(409).json({ message: `Booking đang ở trạng thái ${booking.status}, không thể điểm danh` })
    }
    if (getBookingStartDateTime(booking.date, booking.slot) > new Date()) {
      return res.status(400).json({ message: 'Buổi tập chưa diễn ra, chưa thể điểm danh' })
    }

    const attendance = await PTSessionAttendance.findOneAndUpdate(
      { bookingId: booking._id },
      {
        $set: {
          bookingId: booking._id,
          ptId: booking.ptId,
          memberId: booking.memberId,
          status,
          note: String(note || '').trim(),
          markedBy: req.user._id,
          markedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    )

    // Nếu buổi đang chờ xử lý (needs_review) và giờ đã có đủ dữ liệu → chốt ngay
    if (booking.status === 'needs_review') {
      const memberCheckedIn = await CheckIn.exists({
        memberId: booking.memberId,
        bookingId: booking._id,
        status: 'success',
      })
      const nextStatus = memberCheckedIn ? 'completed' : status === 'present' ? 'member_no_show' : 'pt_no_show'
      const updates = {
        status: nextStatus,
        needsReview: false,
        noShowMarkedAt: new Date(),
        noShowMarkedBy: req.user._id,
      }
      if (nextStatus === 'completed') updates.completedAt = new Date()
      await Booking.updateOne({ _id: booking._id }, { $set: updates })
    }

    return res.json({
      message: `Đã điểm danh PT ${status === 'present' ? 'có mặt' : 'vắng mặt'} cho buổi ${booking.slot}.`,
      attendance,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi điểm danh PT', error: error.message })
  }
}

export const joinWaitlist = async (req, res) => {
  try {
    const { slotId } = req.params

    const existed = await Waitlist.findOne({
      bookingSlotId: slotId,
      memberId: req.user._id,
    })

    if (existed) {
      return res.status(400).json({
        message: 'Bạn đã ở trong danh sách chờ',
      })
    }

    const waitlist = await Waitlist.create({
      bookingSlotId: slotId,
      memberId: req.user._id,
    })

    const count = await Waitlist.countDocuments({
      bookingSlotId: slotId,
    })

    return res.status(201).json({
      message: 'Đã tham gia danh sách chờ',
      waitlist,
      waitlistCount: count,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi tham gia danh sách chờ',
      error: error.message,
    })
  }
}

export const reviewPT = async (req, res) => {
  try {
    const { rating, comment } = req.body

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: 'Rating phải từ 1 đến 5 sao',
      })
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      memberId: req.user._id,
      status: 'completed',
    })

    if (!booking) {
      return res.status(404).json({
        message: 'Chỉ được đánh giá sau khi buổi tập hoàn thành',
      })
    }

    booking.rating = rating
    booking.reviewComment = comment || ''

    await booking.save()

    return res.json({
      message: 'Đánh giá PT thành công',
      booking,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi đánh giá PT',
      error: error.message,
    })
  }
}

/**
 * Thanh toán đặt lịch PT.
 * - Mặc định: trừ toàn bộ từ ví (idempotent theo `pt_booking_<id>`).
 * - `useVnpay: true` + ví không đủ → tạo phiên VNPay thanh toán phần còn thiếu
 *   (áp dụng cho TOÀN BỘ booking đang chờ thanh toán của yêu cầu PT 1-1);
 *   khi VNPay báo thành công, finalizePtBookingPayment mới trừ ví + xác nhận lịch.
 */
export const payBooking = async (req, res) => {
  const session = await mongoose.startSession()
  let activatedTrainerId = null

  try {
    session.startTransaction()

    const booking = await Booking.findOne({
      _id: req.params.id,
      memberId: req.user._id,
    }).session(session)

    if (!booking) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch đặt',
      })
    }

    if (booking.status !== 'awaiting_payment') {
      return res.status(400).json({
        message: 'Lịch này chưa được PT xác nhận hoặc không thể thanh toán',
      })
    }

    // Sát giờ: buổi đã kết thúc thì không chấp nhận thanh toán nữa (không trả tiền sau giờ tập)
    if (getBookingEndDateTime(booking.date, booking.slot) <= new Date()) {
      return res.status(410).json({
        message: 'Buổi tập đã kết thúc, không thể thanh toán lịch này. Slot đã được giải phóng, vui lòng đặt lịch mới.',
      })
    }

    // Yêu cầu PT 1-1 phải vẫn đang chờ thanh toán — không bị tự đóng do membership
    // hết hạn (reconcileStaleRequests) hoặc bị hủy; nếu không, thanh toán sẽ "phục sinh"
    // lại yêu cầu đã đóng và kích hoạt lại PTAssignment.
    if (booking.requestId) {
      const requestDoc = await TrainingRequest.findById(booking.requestId).session(session)
      if (!requestDoc || requestDoc.status !== 'awaiting_payment') {
        return res.status(409).json({
          message: 'Yêu cầu đặt lịch đã bị đóng (membership hết hạn / đã hủy / hết hạn). Không thể thanh toán.',
        })
      }
    }

    // Membership phải còn hiệu lực tại thời điểm buổi tập
    if (!(await hasActiveMembershipForDate(req.user._id, booking.date))) {
      return res.status(403).json({
        message: 'Bạn cần có gói tập đang hoạt động tại thời điểm buổi tập để thanh toán.',
      })
    }

    if (booking.requestId && booking.paymentDeadline && booking.paymentDeadline <= new Date()) {
      const expiredAt = new Date()
      await Booking.updateMany(
        { requestId: booking.requestId, status: 'awaiting_payment' },
        { $set: { status: 'cancelled', paymentStatus: 'expired', paymentExpiredAt: expiredAt, cancelReason: 'Payment deadline expired' } },
        { session },
      )
      await TrainingRequest.findByIdAndUpdate(
        booking.requestId,
        { status: 'payment_expired', paymentExpiredAt: expiredAt, paymentDeadline: null },
        { session },
      )
      await session.commitTransaction()
      return res.status(410).json({ message: 'Yêu cầu đã hết thời hạn thanh toán. Slot đã được giải phóng.' })
    }

    if (booking.paymentDeadline && booking.paymentDeadline <= new Date()) {
      booking.status = 'cancelled'
      booking.paymentStatus = 'expired'
      booking.paymentExpiredAt = new Date()
      booking.cancelReason = 'Quá thời hạn thanh toán đặt lịch PT'
      await booking.save({ session })
      await session.commitTransaction()
      return res.status(410).json({ message: 'Yêu cầu đã hết thời hạn thanh toán. Slot đã được giải phóng.' })
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        message: 'Lịch này đã được thanh toán',
      })
    }

    if (!booking.totalAmount || booking.totalAmount <= 0) {
      return res.status(400).json({
        message: 'Số tiền thanh toán không hợp lệ',
      })
    }

    // === Thanh toán bổ sung qua VNPay khi ví không đủ ===
    if (req.body?.useVnpay) {
      const wallet = await getWalletByUser(req.user._id)

      // Với yêu cầu PT 1-1: gộp tất cả buổi đang chờ thanh toán vào một phiên VNPay duy nhất
      const targetBookings = booking.requestId
        ? await Booking.find({ requestId: booking.requestId, status: 'awaiting_payment' }).session(session)
        : [booking]
      const validBookings = targetBookings.filter((b) => Number(b.totalAmount || 0) > 0)
      const totalAmount = validBookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0)
      const balance = Number(wallet?.balance || 0)

      if (totalAmount > 0 && balance < totalAmount) {
        const remaining = totalAmount - balance
        if (remaining < 10000 || remaining > 100000000) {
          await session.abortTransaction()
          return res.status(400).json({
            message: 'Số tiền cần thanh toán qua VNPay nằm ngoài phạm vi cho phép (10.000đ - 100.000.000đ). Vui lòng nạp thêm ví hoặc thanh toán khi đủ số dư.',
          })
        }

        // Nếu đã có phiên VNPay PENDING cho cùng các buổi này → tái sử dụng (tránh tạo lệnh trùng)
        const existingPending = await Payment.find({
          userId: req.user._id,
          status: 'PENDING',
          'metadata.purpose': 'PT_BOOKING_PAYMENT',
        }).session(session)
        const pendingPayment = existingPending.find((p) => {
          const ids = p.metadata?.bookingIds || []
          return validBookings.some((b) => ids.includes(String(b._id)))
        })

        if (pendingPayment) {
          const paymentUrl = createVnpayPaymentUrl({
            amount: Number(pendingPayment.metadata?.remainingAmount || remaining),
            txnRef: pendingPayment.txnRef,
            orderInfo: `Thanh toan dat lich PT GymPro ${pendingPayment.txnRef}`,
            ipAddr: getClientIp(req),
            locale: req.body.locale || 'vn',
          })
          await session.commitTransaction()
          return res.status(201).json({
            status: balance > 0 ? 'PARTIAL' : 'NO_BALANCE',
            totalAmount,
            walletBalance: balance,
            walletUsed: balance,
            remainingAmount: remaining,
            paymentId: pendingPayment._id,
            txnRef: pendingPayment.txnRef,
            paymentUrl,
          })
        }

        const txnRef = `PTBOOK${Date.now()}${req.user._id.toString().slice(-6).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        const [payment] = await Payment.create([{
          userId: req.user._id,
          walletId: wallet?._id || null,
          amount: totalAmount,
          currency: 'vnd',
          status: 'PENDING',
          paymentMethod: 'VNPAY',
          method: 'VNPAY',
          source: 'ONLINE',
          txnRef,
          metadata: {
            purpose: 'PT_BOOKING_PAYMENT',
            provider: 'VNPAY',
            bookingIds: validBookings.map((b) => String(b._id)),
            requestId: booking.requestId ? String(booking.requestId) : null,
            ptId: String(booking.ptId),
            totalAmount,
            walletUsed: balance,
            remainingAmount: remaining,
            walletBalanceAtCheckout: balance,
          },
        }], { session })

        const paymentUrl = createVnpayPaymentUrl({
          amount: remaining,
          txnRef,
          orderInfo: `Thanh toan dat lich PT GymPro ${txnRef}`,
          ipAddr: getClientIp(req),
          locale: req.body.locale || 'vn',
        })

        recordAuditLog({
          req,
          module: 'booking',
          action: 'pay_booking_vnpay_intent',
          entity: booking,
          entityName: `Booking ${booking._id}`,
          details: `Tạo phiên VNPay ${txnRef} thanh toán phần thiếu ${remaining.toLocaleString('vi-VN')}đ (tổng ${totalAmount.toLocaleString('vi-VN')}đ, ví ${balance.toLocaleString('vi-VN')}đ)`,
        }).catch((err) => console.error('Audit vnpay intent failed:', err.message))

        await session.commitTransaction()
        return res.status(201).json({
          status: balance > 0 ? 'PARTIAL' : 'NO_BALANCE',
          totalAmount,
          walletBalance: balance,
          walletUsed: balance,
          remainingAmount: remaining,
          paymentId: payment._id,
          txnRef,
          paymentUrl,
        })
      }
      // Ví đủ → tiếp tục thanh toán qua ví bình thường
    }

    const { transaction } = await applyWalletTransaction({
      userId: req.user._id,
      amount: -Number(booking.totalAmount),
      type: 'payment',
      provider: 'wallet',
      source: 'pt_booking',
      description: 'Thanh toán đặt lịch PT',
      referenceId: booking._id.toString(),
      status: 'completed',
      metadata: {
        bookingId: booking._id,
        ptId: booking.ptId,
        trainingType: booking.trainingType,
      },
      idempotencyKey: `pt_booking_${booking._id}`,
      session,
    })

    booking.paymentStatus = 'paid'
    booking.status = 'confirmed'
    booking.walletTransactionId = transaction._id

    await booking.save({ session })

    // Với yêu cầu PT 1-1 nhiều buổi, chỉ kích hoạt quan hệ PT-hội viên khi toàn bộ
    // các buổi trong yêu cầu đã thanh toán thành công.
    if (booking.requestId) {
      const remaining = await Booking.countDocuments({
        requestId: booking.requestId,
        status: { $in: ['pending', 'awaiting_payment'] },
      }).session(session)
      if (remaining === 0) {
        const { createAssignment } = await import('../services/ptAssignmentService.js')
        await createAssignment({ memberId: booking.memberId, ptId: booking.ptId, session })
        await TrainingRequest.findByIdAndUpdate(
          booking.requestId,
          { status: 'confirmed', paymentDeadline: null },
          { session },
        )
        activatedTrainerId = booking.ptId
      }
    } else {
      const { createAssignment } = await import('../services/ptAssignmentService.js')
      await createAssignment({ memberId: booking.memberId, ptId: booking.ptId, session })
    }

    await session.commitTransaction()

    recordAuditLog({
      req,
      module: 'booking',
      action: 'pay_booking',
      entity: booking,
      entityName: `Booking ${booking._id}`,
      details: `Thanh toán đặt lịch PT ${Number(booking.totalAmount).toLocaleString('vi-VN')}đ qua ví - trạng thái: confirmed`,
    }).catch((err) => console.error('Audit payBooking failed:', err.message))

    await createNotification({
      receiverId: req.user._id,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: 'Thanh toán đặt lịch thành công',
      content: `Bạn đã thanh toán thành công lịch tập PT.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/booking',
      createdBy: 'System',
    })

    if (activatedTrainerId) {
      await createNotification({
        receiverId: activatedTrainerId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
        title: 'Lịch PT 1-1 đã được xác nhận',
        content: 'Hội viên đã thanh toán đầy đủ. Bạn có thể bắt đầu gán giáo án và quản lý lịch tập.',
        relatedId: booking.requestId || booking._id,
        relatedType: booking.requestId ? 'TrainingRequest' : 'Booking',
        redirectUrl: '/pt/clients',
        createdBy: 'System',
      })
    }

    return res.json({
      message: 'Thanh toán đặt lịch thành công',
      booking,
    })
  } catch (error) {
    await session.abortTransaction()

    return res.status(error.statusCode || 500).json({
      message: error.message || 'Lỗi thanh toán đặt lịch',
    })
  } finally {
    session.endSession()
  }
}

/**
 * Hoàn tất thanh toán đặt lịch PT sau khi VNPay xác nhận (idempotent, một giao dịch duy nhất):
 * 1. Credit phần thiếu từ VNPay vào ví (idempotent theo txnRef)
 * 2. Trừ toàn bộ số tiền từng buổi từ ví (idempotent theo `pt_booking_<id>`)
 * 3. Booking → confirmed; request → confirmed; kích hoạt quan hệ PT ↔ Member
 * Không credit ví nếu các buổi đã được thanh toán bằng ví trước đó (chống trùng tiền).
 */
export const finalizePtBookingPayment = async ({ paymentId, vnpayQuery }) => {
  const session = await mongoose.startSession()
  let activatedTrainerId = null
  let outcome = null

  try {
    outcome = await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentId).session(session)
      if (!payment) return { status: 'not_found' }
      if (String(payment.status).toUpperCase() === 'PAID') return { status: 'already_paid' }
      if (String(payment.status).toUpperCase() !== 'PENDING') return { status: 'failed' }

      const meta = payment.metadata || {}
      const ids = (meta.bookingIds || []).map(String)
      const bookings = await Booking.find({ _id: { $in: ids }, memberId: payment.userId }).session(session)
      if (!bookings.length) return { status: 'not_found' }

      const validBookings = bookings.filter((b) => b.status === 'awaiting_payment' && b.paymentStatus !== 'paid')
      if (!validBookings.length) {
        // Không còn buổi nào hợp lệ để trừ tiền. Member vẫn BỊ VNPay trừ tiền →
        // hoàn ngay số tiền VNPay về ví (idempotent theo txnRef), không để member mất tiền.
        // Trường hợp phổ biến: member đã thanh toán bằng ví trước, hoặc hủy yêu cầu
        // sau khi bấm VNPay nhưng trước khi VNPay xác nhận.
        await finalizeWalletDeposit({
          userId: payment.userId,
          amountVnd: Number(meta.remainingAmount),
          originalAmount: Number(meta.remainingAmount),
          paymentMethod: 'VNPAY',
          description: 'Hoàn tiền thanh toán đặt lịch PT qua VNPay (lịch đã thanh toán/hủy)',
          txnRef: payment.txnRef,
          providerRef: vnpayQuery?.vnp_TransactionNo || null,
          providerRefKey: 'vnpTransactionNo',
          providerMetadata: { vnpayReturn: vnpayQuery || null, refundReason: 'no_active_booking' },
          idempotencyKey: payment.txnRef,
          existingPayment: payment,
          session,
        })
        payment.status = 'PAID'
        payment.paidAt = new Date()
        payment.completedAt = new Date()
        payment.metadata = { ...meta, vnpayReturn: vnpayQuery || null, verified: true, finalizedAt: new Date(), refundedToWallet: true }
        await payment.save({ session })
        createNotification({
          receiverId: payment.userId,
          receiverRole: 'member',
          notificationType: NOTIFICATION_TYPES.REFUND_APPROVED,
          title: 'Đã hoàn tiền về ví',
          content: 'Lịch PT không còn hiệu lực nên số tiền thanh toán VNPay đã được hoàn vào ví của bạn.',
          relatedId: payment._id,
          relatedType: 'Payment',
          redirectUrl: '/booking',
          createdBy: 'System',
        }).catch(() => {})
        return { status: 'already_paid' }
      }

      const now = new Date()
      const expired = validBookings.find((b) => b.paymentDeadline && b.paymentDeadline <= now)
      if (expired) {
        await Booking.updateMany(
          { _id: { $in: validBookings.map((b) => b._id) }, status: 'awaiting_payment' },
          { $set: { status: 'cancelled', paymentStatus: 'expired', paymentExpiredAt: now, cancelReason: 'Payment deadline expired' } },
          { session },
        )
        if (meta.requestId) {
          await TrainingRequest.findByIdAndUpdate(meta.requestId, { status: 'payment_expired', paymentExpiredAt: now, paymentDeadline: null }, { session })
        }
        payment.status = 'FAILED'
        payment.metadata = { ...meta, vnpayReturn: vnpayQuery || null, verified: true, expiredAt: now }
        await payment.save({ session })
        return { status: 'expired' }
      }

      // 1) Credit phần thiếu từ VNPay vào ví (idempotent theo txnRef)
      await finalizeWalletDeposit({
        userId: payment.userId,
        amountVnd: Number(meta.remainingAmount),
        originalAmount: Number(meta.remainingAmount),
        paymentMethod: 'VNPAY',
        description: 'Thanh toán phần còn thiếu đặt lịch PT qua VNPay',
        txnRef: payment.txnRef,
        providerRef: vnpayQuery?.vnp_TransactionNo || null,
        providerRefKey: 'vnpTransactionNo',
        providerMetadata: {
          vnpayReturn: vnpayQuery || null,
          bookingIds: meta.bookingIds,
          requestId: meta.requestId,
        },
        idempotencyKey: payment.txnRef,
        existingPayment: payment,
        session,
      })

      // 2) Trừ toàn bộ số tiền từng buổi từ ví
      for (const b of validBookings) {
        const { transaction } = await applyWalletTransaction({
          userId: payment.userId,
          amount: -Number(b.totalAmount),
          type: 'payment',
          provider: 'wallet',
          source: 'pt_booking',
          description: 'Thanh toán đặt lịch PT',
          referenceId: b._id.toString(),
          status: 'completed',
          metadata: { bookingId: b._id, ptId: b.ptId, trainingType: b.trainingType, vnpayTxnRef: payment.txnRef },
          idempotencyKey: `pt_booking_${b._id}`,
          session,
        })
        b.paymentStatus = 'paid'
        b.status = 'confirmed'
        b.walletTransactionId = transaction._id
        b.paymentMethod = 'vnpay'
        await b.save({ session })
      }

      // 3) Request + quan hệ PT ↔ Member (chỉ khi toàn bộ buổi đã thanh toán)
      const first = validBookings[0]
      if (first.requestId) {
        const remaining = await Booking.countDocuments({
          requestId: first.requestId,
          status: { $in: ['pending', 'awaiting_payment'] },
        }).session(session)
        if (remaining === 0) {
          const { createAssignment } = await import('../services/ptAssignmentService.js')
          await createAssignment({ memberId: first.memberId, ptId: first.ptId, session })
          await TrainingRequest.findByIdAndUpdate(first.requestId, { status: 'confirmed', paymentDeadline: null }, { session })
          activatedTrainerId = first.ptId
        }
      } else {
        const { createAssignment } = await import('../services/ptAssignmentService.js')
        await createAssignment({ memberId: first.memberId, ptId: first.ptId, session })
      }

      payment.status = 'PAID'
      payment.paidAt = new Date()
      payment.completedAt = new Date()
      payment.metadata = { ...meta, vnpayReturn: vnpayQuery || null, verified: true, finalizedAt: new Date() }
      await payment.save({ session })

      return { status: 'success', memberId: payment.userId, bookingId: first._id, requestId: first.requestId, ptId: first.ptId }
    })

    if (outcome?.status === 'success') {
      createNotification({
        receiverId: outcome.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
        title: 'Thanh toán đặt lịch thành công',
        content: 'Bạn đã thanh toán thành công lịch tập PT qua VNPay.',
        relatedId: outcome.bookingId,
        relatedType: 'Booking',
        redirectUrl: '/booking',
        createdBy: 'System',
      }).catch(() => {})
      if (activatedTrainerId) {
        createNotification({
          receiverId: activatedTrainerId,
          receiverRole: 'pt',
          notificationType: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
          title: 'Lịch PT 1-1 đã được xác nhận',
          content: 'Hội viên đã thanh toán đầy đủ. Bạn có thể bắt đầu gán giáo án và quản lý lịch tập.',
          relatedId: outcome.requestId || outcome.bookingId,
          relatedType: outcome.requestId ? 'TrainingRequest' : 'Booking',
          redirectUrl: '/pt/clients',
          createdBy: 'System',
        }).catch(() => {})
      }
    }

    return outcome || { status: 'failed' }
  } catch (error) {
    if (error?.errorLabels?.includes('TransientTransactionError')) {
      return { status: 'retry' }
    }
    throw error
  } finally {
    session.endSession()
  }
}
