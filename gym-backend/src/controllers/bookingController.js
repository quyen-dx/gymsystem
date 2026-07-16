import Booking from '../models/Booking.js'
import Membership from '../models/Membership.js'
import Waitlist from '../models/Waitlist.js'
import PT from '../models/PT.js'
import mongoose from 'mongoose'
import { applyWalletTransaction } from '../services/walletService.js'

const activeStatus = ['pending', 'awaiting_payment', 'confirmed']

const normalizeDate = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const makeSlotId = (ptId, date, slot) => {
  const bookingDate = normalizeDate(date).toISOString().slice(0, 10)
  return `${ptId}_${bookingDate}_${slot}`
}

const hasActiveMembershipForDate = async (memberId, date) => {
  const bookingDate = normalizeDate(date)
  const membership = await Membership.findOne({
    memberId,
    status: { $in: ['active', 'pending_cancel'] },
    endDate: { $gte: bookingDate },
  }).lean()

  return !!membership
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

    const pt = await PT.findOne({ userId: ptId })

      if (!pt) {
        return res.status(404).json({
          message: 'Không tìm thấy PT',
        })
      }

      const priceAtBooking = 0

    const memberConflict = await Booking.findOne({
      memberId: req.user._id,
      date: bookingDate,
      slot,
      status: { $in: activeStatus },
    })

    if (memberConflict) {
      return res.status(400).json({
        message: 'Bạn đã có lịch tập ở khung giờ này',
      })
    }

    const ptConflict = await Booking.findOne({
      ptId,
      date: bookingDate,
      slot,
      status: { $in: activeStatus },
    })

    if (ptConflict) {
      return res.status(400).json({
        message: 'PT đã có người đặt khung giờ này',
      })
    }

    const booking = await Booking.create({
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
    })

    return res.status(201).json({
      message: 'Đặt lịch thành công, chờ PT xác nhận',
      booking,
    })
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

    const createdBookings = []
    const conflicts = []

    for (let i = 0; i < Number(weeks); i++) {
      const bookingDate = normalizeDate(date)
      bookingDate.setDate(bookingDate.getDate() + i * 7)

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
      })

      if (conflict) {
        conflicts.push({
          date: bookingDate,
          slot,
          reason: 'Trùng lịch member hoặc PT',
        })
        continue
      }

      const booking = await Booking.create({
        memberId: req.user._id,
        ptId,
        date: bookingDate,
        slot,
        note,
        status: 'pending',
      })

      createdBookings.push(booking)
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

function getNextWeekDate(dayOfWeek) {
  const now = new Date()
  const currentDay = now.getDay()
  const diff = dayOfWeek - currentDay + (dayOfWeek <= currentDay ? 7 : 0)
  if (diff === 0) return normalizeDate(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const next = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000)
  return normalizeDate(next)
}

export const scheduleWeeklyBooking = async (req, res) => {
  try {
    const { ptId, daysOfWeek, time, note } = req.body

    if (!ptId || !daysOfWeek || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0 || !time) {
      return res.status(400).json({
        message: 'Thiếu thông tin: ptId, daysOfWeek, time',
      })
    }

    const results = []
    const errors = []

    for (const day of daysOfWeek) {
      const bookingDate = getNextWeekDate(day)

      if (!(await requireActiveMembershipForDate(req.user._id, bookingDate, res))) return

      const conflict = await Booking.findOne({
        $or: [
          { memberId: req.user._id, date: bookingDate, slot: time, status: { $in: activeStatus } },
          { ptId, date: bookingDate, slot: time, status: { $in: activeStatus } },
        ],
      })

      if (conflict) {
        errors.push({
          day,
          date: bookingDate,
          reason: 'Trùng lịch, vui lòng chọn giờ khác',
        })
        continue
      }

      const booking = await Booking.create({
        memberId: req.user._id,
        ptId,
        date: bookingDate,
        slot: time,
        note,
        status: 'pending',
      })

      results.push(booking)
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

    booking.status = 'awaiting_payment'
    await booking.save()

    const { createAssignment } = await import('../services/ptAssignmentService.js')
    await createAssignment({
      memberId: booking.memberId,
      ptId: req.user._id,
    })

    return res.json({
      message: 'Đã xác nhận lịch. Chờ thành viên thanh toán',
      booking,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi xác nhận lịch',
      error: error.message,
    })
  }
}

export const rejectBooking = async (req, res) => {
  try {
    const { reason } = req.body

    const booking = await Booking.findOne({
      _id: req.params.id,
      ptId: req.user._id,
    })

    if (!booking) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch đặt',
      })
    }

    booking.status = 'cancelled'
    booking.rejectReason = reason || 'PT từ chối lịch'
    await booking.save()

    return res.json({
      message: 'Đã từ chối lịch',
      booking,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi từ chối lịch',
      error: error.message,
    })
  }
}

export const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body

    const booking = await Booking.findOne({
      _id: req.params.id,
      memberId: req.user._id,
    })

    if (!booking) {
      return res.status(404).json({
        message: 'Không tìm thấy lịch đặt',
      })
    }

    const now = new Date()
    const bookingDate = new Date(booking.date)
    const diffHours = (bookingDate - now) / (1000 * 60 * 60)

    booking.status = 'cancelled'
    booking.cancelReason = reason || 'Member hủy lịch'
    booking.isViolation = diffHours < 24

    await booking.save()

    const bookingSlotId = makeSlotId(booking.ptId, booking.date, booking.slot)

    const firstWaitlist = await Waitlist.findOne({
      bookingSlotId,
      notifiedAt: null,
    }).sort({ createdAt: 1 })

    if (firstWaitlist) {
      firstWaitlist.notifiedAt = new Date()
      await firstWaitlist.save()
    }

    return res.json({
      message: booking.isViolation
        ? 'Hủy lịch thành công. Ghi nhận vi phạm do hủy trong vòng 24h'
        : 'Hủy lịch thành công',
      booking,
      notifiedWaitlistMember: firstWaitlist || null,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi hủy lịch',
      error: error.message,
    })
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

    booking.status = 'completed'
    booking.completedAt = new Date()

    await booking.save()

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

export const payBooking = async (req, res) => {
  const session = await mongoose.startSession()

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

    await session.commitTransaction()

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
