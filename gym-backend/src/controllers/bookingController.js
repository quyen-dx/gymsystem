import Booking from '../models/Booking.js'
import MembershipCycle from '../models/MembershipCycle.js'
import Waitlist from '../models/Waitlist.js'
import PT from '../models/PT.js'
import User from '../models/User.js'
import TrainingRequest from '../models/TrainingRequest.js'
import Payment from '../models/Payment.js'
import CheckIn from '../models/CheckIn.js'
import mongoose from 'mongoose'
import { applyWalletTransaction, getWalletByUser } from '../services/walletService.js'
import { finalizeWalletDeposit } from '../services/walletDepositService.js'
import { createVnpayPaymentUrl } from '../services/vnpayService.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { checkMemberFeature } from '../utils/featureCheck.js'
import { validatePTAssignment } from '../services/ptScheduleValidationService.js'

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

const getBookingEndDateTime = (date, slot) => {
  const bookingDate = normalizeDate(date)
  const end = String(slot || '').split('-')[1]?.trim()
  const [hour = 0, minute = 0] = end ? end.split(':').map(Number) : [23, 59]
  bookingDate.setHours(hour || 0, minute || 0, 0, 0)
  return bookingDate
}

const makeSlotId = (ptId, date, slot) => {
  const bookingDate = normalizeDate(date).toISOString().slice(0, 10)
  return `${ptId}_${bookingDate}_${slot}`
}

const hasActiveMembershipForDate = async (memberId, date) => {
  const bookingDate = normalizeDate(date)

  // Active cycle (kích hoạt ngay sau thanh toán): cần expiresAt >= ngày đặt
  const activeCycle = await MembershipCycle.findOne({
    memberId,
    status: 'active',
    expiresAt: { $gte: bookingDate },
  }).lean()
  if (activeCycle) return true

  return false
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

    // Giá đặt lịch lấy từ cấu hình giá PT (backend là nguồn quyết định — không tin giá từ Frontend).
    // Snapshot giá vào booking để giá cũ không đổi khi Admin thay đổi cấu hình sau này.
    const sessionPrice =
      finalTrainingType === 'one_to_one' ? pt?.oneToOnePrice || 0 : pt?.groupPrice || 0
    if (!sessionPrice || sessionPrice <= 0) {
      return res.status(403).json({
        message: finalTrainingType === 'one_to_one'
          ? 'PT hiện chưa được cấu hình giá đặt lịch 1-1. Vui lòng chọn PT khác.'
          : 'PT hiện chưa được cấu hình giá đặt lịch nhóm. Vui lòng chọn PT khác.',
      })
    }
    const priceAtBooking = sessionPrice

    const session = await mongoose.startSession()
    try {
      session.startTransaction()

      // Re-check conflicts inside transaction to prevent race condition (TOCTOU)
      const [memberConflict, ptConflict] = await Promise.all([
        Booking.findOne({
          memberId: req.user._id,
          date: bookingDate,
          slot,
          status: { $in: activeStatus },
        }).session(session),
        Booking.findOne({
          ptId,
          date: bookingDate,
          slot,
          status: { $in: activeStatus },
        }).session(session),
      ])

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

    // Snapshot giá buổi từ cấu hình giá PT (chỉ 1-1; backend là nguồn quyết định)
    const ptProfile = await PT.findOne({ userId: ptId }).lean()
    if (!ptProfile) {
      return res.status(404).json({ message: 'Không tìm thấy PT' })
    }
    const sessionPrice = ptProfile.oneToOnePrice || 0
    if (!sessionPrice || sessionPrice <= 0) {
      return res.status(403).json({
        message: 'PT hiện chưa được cấu hình giá đặt lịch 1-1. Vui lòng chọn PT khác.',
      })
    }

    const session = await mongoose.startSession()
    const createdBookings = []
    const conflicts = []

    try {
      session.startTransaction()

      for (let i = 0; i < Number(weeks); i++) {
        const bookingDate = normalizeDate(date)
        bookingDate.setDate(bookingDate.getDate() + i * 7)

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

        const conflict = await Booking.findOne({
          $or: [
            {
              memberId: req.user._id,
              date: bookingDate,
              slot,
              status: { $in: activeStatus },
            },
            {
              ptId,
              date: bookingDate,
              slot,
              status: { $in: activeStatus },
            },
          ],
        }).session(session)

        if (conflict) {
          conflicts.push({
            date: bookingDate,
            slot,
            reason: 'Trùng lịch member hoặc PT',
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

    // Snapshot giá buổi từ cấu hình giá PT (chỉ 1-1; backend là nguồn quyết định)
    const ptProfile = await PT.findOne({ userId: ptId }).lean()
    if (!ptProfile) {
      return res.status(404).json({ message: 'Không tìm thấy PT' })
    }
    const sessionPrice = ptProfile.oneToOnePrice || 0
    if (!sessionPrice || sessionPrice <= 0) {
      return res.status(403).json({
        message: 'PT hiện chưa được cấu hình giá đặt lịch 1-1. Vui lòng chọn PT khác.',
      })
    }

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

        const conflict = await Booking.findOne({
          $or: [
            { memberId: req.user._id, date: bookingDate, slot, status: { $in: activeStatus } },
            { ptId, date: bookingDate, slot, status: { $in: activeStatus } },
          ],
        }).session(session)

        if (conflict) {
          errors.push({
            day,
            date: bookingDate,
            slot,
            reason: 'Trùng lịch, vui lòng chọn giờ khác',
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

    // Chỉ xác nhận được booking đang chờ (pending/awaiting_payment).
    // Chặn hồi sinh booking đã hủy/thất bại hoặc confirm lần 2.
    if (!['pending', 'awaiting_payment'].includes(booking.status)) {
      await session.abortTransaction()
      return res.status(409).json({
        message: `Lịch đặt đang ở trạng thái ${booking.status}, không thể xác nhận`,
      })
    }

    // PT acceptance only unlocks payment. An active PT assignment is created
    // after payment succeeds. Booking không có giá snapshot (0đ) không được
    // xác nhận — chặn bypass thanh toán tạo assignment miễn phí.
    if (!booking.totalAmount || booking.totalAmount <= 0) {
      await session.abortTransaction()
      return res.status(400).json({
        message: 'Lịch đặt chưa có giá hợp lệ, không thể xác nhận',
      })
    }

    booking.status = 'awaiting_payment'
    booking.paymentStatus = 'pending'
    booking.paymentDeadline = new Date(Date.now() + (Number(process.env.PT_PAYMENT_HOLD_MINUTES) || 30) * 60 * 1000)
    await booking.save({ session })

    await session.commitTransaction()

    await createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      title: 'Lịch tập đã được PT xác nhận',
      content: `Lịch tập của bạn đã được PT xác nhận. Vui lòng thanh toán để hoàn tất đặt lịch.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/my-bookings',
      createdBy: 'PT',
    })

    return res.json({
      message: 'Đã xác nhận lịch. Chờ thành viên thanh toán',
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
      redirectUrl: '/my-bookings',
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

    const { date, slot, reason } = req.body

    if (!date || !slot) {
      await session.abortTransaction()
      return res.status(400).json({
        message: 'Thiếu ngày hoặc khung giờ mới',
      })
    }

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

    if (!(await requireActiveMembershipForDate(req.user._id, newDate, res))) {
      await session.abortTransaction()
      return
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

    const conflict = await Booking.findOne({
      _id: { $ne: booking._id },
      $or: [
        { memberId: req.user._id, date: newDate, slot, status: { $in: activeStatus } },
        { ptId: booking.ptId, date: newDate, slot, status: { $in: activeStatus } },
      ],
    }).session(session)

    if (conflict) {
      await session.abortTransaction()
      return res.status(409).json({
        message: conflict.memberId?.toString() === req.user._id.toString()
          ? 'Bạn đã có lịch tập ở khung giờ này'
          : 'PT đã có người đặt khung giờ này',
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
      redirectUrl: '/my-bookings',
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
    const booking = await Booking.findOne({
      _id: req.params.id,
      ptId: req.user._id,
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

    booking.status = 'member_no_show'
    booking.noShowMarkedAt = new Date()
    booking.noShowMarkedBy = req.user._id
    await booking.save()

    createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_FAILED,
      title: 'Vắng buổi tập PT',
      content: `Bạn đã vắng buổi PT ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot} mà không hủy trước. Buổi tập đã được tính là no-show.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/my-bookings',
      createdBy: 'PT',
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

    const booking = await Booking.findOne({
      _id: req.params.id,
      ptId: req.user._id,
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
      redirectUrl: '/my-bookings',
      createdBy: 'PT',
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
