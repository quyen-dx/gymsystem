import Booking from '../models/Booking.js'
import MembershipCycle from '../models/MembershipCycle.js'
import Waitlist from '../models/Waitlist.js'
import PT from '../models/PT.js'
import ViolationLog from '../models/ViolationLog.js'
import mongoose from 'mongoose'
import { applyWalletTransaction } from '../services/walletService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { checkMemberFeature } from '../utils/featureCheck.js'
import { markBenefitUsed } from '../services/membershipCycleService.js'

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

  // Active cycle: cần expiresAt >= ngày đặt và trạng thái active
  const activeCycle = await MembershipCycle.findOne({
    memberId,
    status: 'active',
    expiresAt: { $gte: bookingDate },
  }).lean()
  if (activeCycle) return true

  // Pending activation cycle: chưa kích hoạt nhưng đã có quyền lợi PT
  const pendingCycle = await MembershipCycle.findOne({
    memberId,
    status: 'pending_initial_activation',
  }).lean()
  if (pendingCycle) return true

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

const checkBookingWindow = (date, res) => {
  const bookingDate = normalizeDate(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = (bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays > 30) {
    res.status(400).json({ message: 'Chỉ có thể đặt lịch trong vòng 30 ngày' })
    return false
  }
  return true
}

const checkSelfBooking = (reqUserId, ptId, res) => {
  if (reqUserId.toString() === String(ptId)) {
    res.status(400).json({ message: 'PT không thể đặt lịch cho chính mình' })
    return false
  }
  return true
}

const checkNoShowBlock = async (memberId, res) => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const count = await ViolationLog.countDocuments({
    memberId,
    type: 'no_show',
    createdAt: { $gte: ninetyDaysAgo },
  })
  if (count >= 3) {
    const latestViolation = await ViolationLog.findOne({
      memberId,
      type: 'no_show',
      createdAt: { $gte: ninetyDaysAgo },
    }).sort({ createdAt: -1 }).lean()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    if (latestViolation && latestViolation.createdAt > thirtyDaysAgo) {
      res.status(400).json({ message: 'Bạn đã bị khóa đặt lịch trong 30 ngày do vi phạm không điểm danh 3 lần' })
      return false
    }
  }
  return true
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

    if (!checkBookingWindow(date, res)) return

    if (!checkSelfBooking(req.user._id, ptId, res)) return

    if (!(await checkNoShowBlock(req.user._id, res))) return

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

    const ptSessionCount = await Booking.countDocuments({
      ptId,
      date: bookingDate,
      status: { $in: ['pending', 'awaiting_payment', 'confirmed'] },
    })
    if (ptSessionCount >= 8) {
      return res.status(400).json({ message: 'PT đã đạt giới hạn 8 buổi tập trong ngày' })
    }

    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const activeMemberIds = await Booking.distinct('memberId', {
      ptId,
      status: { $nin: ['cancelled'] },
      date: { $gte: thirtyDaysAgo },
    })
    if (activeMemberIds.length >= 10 && !activeMemberIds.some(id => id.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'PT đã đạt giới hạn 10 hội viên trong 30 ngày' })
    }

    // FIX: priceAtBooking/ totalAmount hardcoded to 0 because PT pricing is not yet implemented.
    // TODO: Fetch PT session price from PlanFeature or SystemSettings when implemented
    const priceAtBooking = 0

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

      // === MembershipCycle benefit tracking (FIX: added await) ===
      const benefitType = finalTrainingType === 'one_to_one' ? 'pt_1on1' : 'pt_group'
      await markBenefitUsed(req.user._id, benefitType, { session })

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

    if (Number(weeks) > 4) {
      return res.status(400).json({ message: 'Đặt lịch định kỳ tối đa 4 tuần' })
    }

    const lastBookingDate = normalizeDate(date)
    lastBookingDate.setDate(lastBookingDate.getDate() + (Number(weeks) - 1) * 7)
    if (!(await requireActiveMembershipForDate(req.user._id, lastBookingDate, res))) return

    // FIX: standardize feature code to match createBooking
    const featureCheck = await checkMemberFeature(req.user._id, 'BOOK_PT_PRIVATE')
    if (!featureCheck.allowed) {
      return res.status(403).json({ message: featureCheck.reason })
    }

    if (!checkSelfBooking(req.user._id, ptId, res)) return

    if (!checkBookingWindow(date, res)) return

    if (!(await checkNoShowBlock(req.user._id, res))) return

    const session = await mongoose.startSession()
    const createdBookings = []
    const conflicts = []

    try {
      session.startTransaction()

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
            status: 'pending',
          }], { session })

          // FIX: added await for markBenefitUsed
          await markBenefitUsed(req.user._id, 'pt_1on1', { session })

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

    // FIX: standardize feature code to match createBooking
    const featureCheck = await checkMemberFeature(req.user._id, 'BOOK_PT_PRIVATE')
    if (!featureCheck.allowed) {
      return res.status(403).json({ message: featureCheck.reason })
    }

    if (!checkSelfBooking(req.user._id, ptId, res)) return

    if (!(await checkNoShowBlock(req.user._id, res))) return

    const session = await mongoose.startSession()
    const results = []
    const errors = []

    try {
      session.startTransaction()

      for (const day of daysOfWeek) {
        const bookingDate = getNextWeekDate(day)

        if (!checkBookingWindow(bookingDate, res)) continue

        if (!(await requireActiveMembershipForDate(req.user._id, bookingDate, res))) {
          await session.abortTransaction()
          return
        }

        const conflict = await Booking.findOne({
          $or: [
            { memberId: req.user._id, date: bookingDate, slot: time, status: { $in: activeStatus } },
            { ptId, date: bookingDate, slot: time, status: { $in: activeStatus } },
          ],
        }).session(session)

        if (conflict) {
          errors.push({
            day,
            date: bookingDate,
            reason: 'Trùng lịch, vui lòng chọn giờ khác',
          })
          continue
        }

        try {
          const [booking] = await Booking.create([{
            memberId: req.user._id,
            ptId,
            date: bookingDate,
            slot: time,
            note,
            status: 'pending',
          }], { session })

          // FIX: added await for markBenefitUsed
          await markBenefitUsed(req.user._id, 'pt_1on1', { session })

          results.push(booking)
        } catch (createErr) {
          if (createErr.code === 11000) {
            errors.push({
              day,
              date: bookingDate,
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

    // FIX: If totalAmount is 0 (free PT session covered by membership), skip payment step
    // and directly confirm the booking. Otherwise set awaiting_payment for wallet payment.
    const needsPayment = booking.totalAmount && booking.totalAmount > 0
    if (!needsPayment) {
      booking.status = 'confirmed'
      booking.paymentStatus = 'paid'
    } else {
      booking.status = 'awaiting_payment'
    }
    await booking.save({ session })

    const { createAssignment } = await import('../services/ptAssignmentService.js')
    await createAssignment({
      memberId: booking.memberId,
      ptId: req.user._id,
      session,
    })

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

    await createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.BOOKING_REJECTED,
      title: 'Lịch tập bị PT từ chối',
      content: `Lịch tập của bạn đã bị PT từ chối. Lý do: ${reason || 'Không có lý do.'}`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/my-bookings',
      createdBy: 'PT',
    })

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
    const bookingDateTime = new Date(booking.date)
    const diffHours = (bookingDateTime - now) / (1000 * 60 * 60)

    booking.status = 'cancelled'
    booking.cancelReason = reason || 'Member hủy lịch'

    if (diffHours < 2 && booking.totalAmount && booking.totalAmount > 0) {
      const penalty = Math.floor(booking.totalAmount * 0.5)
      try {
        await applyWalletTransaction({
          userId: req.user._id,
          amount: -penalty,
          type: 'payment',
          provider: 'wallet',
          source: 'booking_penalty',
          description: 'Phí hủy lịch PT trong vòng 2 giờ',
          referenceId: booking._id.toString(),
          status: 'completed',
          metadata: { bookingId: booking._id, penaltyType: 'late_cancel' },
          idempotencyKey: `late_cancel_${booking._id}`,
          session,
        })
      } catch (penaltyError) {
        await session.abortTransaction()
        return res.status(400).json({
          message: 'Không đủ số dư ví để thanh toán phí hủy lịch (50% giá buổi tập)',
        })
      }
    }
    booking.isViolation = diffHours < 2

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

    return res.json({
      message: booking.isViolation
        ? 'Hủy lịch thành công. Ghi nhận vi phạm do hủy trong vòng 2h'
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

    await createNotification({
      receiverId: req.user._id,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: 'Thanh toán đặt lịch thành công',
      content: `Bạn đã thanh toán thành công lịch tập PT.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/my-bookings',
      createdBy: 'System',
    })

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
