import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import CheckIn from '../models/CheckIn.js'
import PTSessionAttendance from '../models/PTSessionAttendance.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { applyWalletTransaction } from '../services/walletService.js'

const CHECK_INTERVAL_MS = 5 * 60 * 1000
// Đóng booking sau khi buổi kết thúc 2 tiếng mà chưa được chốt kết quả
const GRACE_AFTER_END_MS = 2 * 60 * 60 * 1000

const getSessionEnd = (date, slot) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const end = String(slot || '').split('-')[1]?.trim()
  const [hour = 0, minute = 0] = end ? end.split(':').map(Number) : [23, 59]
  d.setHours(hour || 0, minute || 0, 0, 0)
  return d
}

const fmtDate = (date) => new Date(date).toLocaleDateString('vi-VN')

/**
 * P1: chốt kết quả buổi PT dựa trên HAI nguồn độc lập:
 *   1) Member check-in (CheckIn success gắn bookingId)
 *   2) Điểm danh sự có mặt của PT (PTSessionAttendance: present/absent)
 *
 *   Member check-in | PT điểm danh     | Kết quả
 *   ---------------|------------------|---------------------------
 *   có             | có mặt           | completed
 *   có             | vắng mặt         | pt_no_show (hoàn 100% + đền bù 1 buổi)
 *   có             | chưa ghi nhận    | completed (mặc định PT có mặt)
 *   không          | có mặt           | member_no_show (giữ tiền, tính 1 buổi)
 *   không          | vắng mặt         | pt_no_show (hoàn 100% + đền bù 1 buổi)
 *   không          | chưa ghi nhận    | needs_review (thiếu dữ liệu → lễ tân xử lý)
 */
export const runNoShowSweeperJob = async () => {
  const now = new Date()
  const cutoff = new Date(now.getTime() - GRACE_AFTER_END_MS)

  const overdueBookings = await Booking.find({
    status: 'confirmed',
    $or: [
      { paymentStatus: { $in: ['paid', 'not_required'] } },
      { totalAmount: { $lte: 0 } },
    ],
    date: { $lte: cutoff },
  })
    .select('_id memberId ptId date slot totalAmount')
    .lean()

  let completed = 0
  let noShow = 0
  let ptNoShow = 0
  let needsReview = 0

  for (const booking of overdueBookings) {
    const sessionEnd = getSessionEnd(booking.date, booking.slot)
    if (sessionEnd > cutoff) continue

    const memberCheckedIn = await CheckIn.exists({
      memberId: booking.memberId,
      bookingId: booking._id,
      status: 'success',
    })

    const attendance = await PTSessionAttendance.findOne({ bookingId: booking._id }).lean()

    const updateResult = await Booking.updateOne(
      { _id: booking._id, status: 'confirmed' },
      { $set: { completedAt: now, noShowMarkedAt: now } },
    )
    if (!updateResult.modifiedCount) continue

    // === Trường hợp 1: member có check-in → buổi diễn ra thật ===
    if (memberCheckedIn) {
      if (attendance?.status === 'absent') {
        await handlePtNoShow(booking, now, { auto: true, attendance })
        ptNoShow += 1
      } else {
        await Booking.updateOne(
          { _id: booking._id },
          { $set: { status: 'completed', completedAt: now } },
        )
        completed += 1
        createNotification({
          receiverId: booking.memberId,
          receiverRole: 'member',
          notificationType: NOTIFICATION_TYPES.PT_SESSION_COMPLETED,
          title: 'Buổi tập hoàn thành',
          content: `Buổi PT ${fmtDate(booking.date)} ${booking.slot} đã được chốt là hoàn thành (có check-in).`,
          relatedId: booking._id,
          relatedType: 'Booking',
          redirectUrl: '/booking',
          createdBy: 'System',
        }).catch((err) => console.error('Notify auto-complete failed:', err.message))
      }
      continue
    }

    // === Trường hợp 2: member KHÔNG check-in ===
    if (attendance) {
      if (attendance.status === 'present') {
        // PT có mặt nhưng member không đến → member no-show (giữ tiền, tiêu 1 buổi)
        await Booking.updateOne(
          { _id: booking._id },
          { $set: { status: 'member_no_show', noShowMarkedAt: now, noShowMarkedBy: null, autoNoShow: true, needsReview: false } },
        )
        noShow += 1
        createNotification({
          receiverId: booking.memberId,
          receiverRole: 'member',
          notificationType: NOTIFICATION_TYPES.PT_SESSION_NO_SHOW,
          title: 'Vắng buổi tập PT',
          content: `Buổi PT ${fmtDate(booking.date)} ${booking.slot} được chốt là no-show vì bạn không check-in (PT đã có mặt). Buổi tập được tính là đã tiêu.`,
          relatedId: booking._id,
          relatedType: 'Booking',
          redirectUrl: '/booking',
          createdBy: 'System',
        }).catch((err) => console.error('Notify auto member no-show failed:', err.message))
      } else {
        await handlePtNoShow(booking, now, { auto: true, attendance })
        ptNoShow += 1
      }
    } else {
      // Thiếu dữ liệu cả 2 nguồn → chuyển cho lễ tân/staff xử lý, KHÔNG tự kết luận
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { status: 'needs_review', needsReview: true, noShowMarkedAt: now } },
      )
      needsReview += 1
      createNotification({
        receiverId: null,
        receiverRole: 'staff',
        notificationType: NOTIFICATION_TYPES.ACTION_REQUIRED,
        title: 'Buổi PT cần kiểm tra',
        content: `Buổi PT ${fmtDate(booking.date)} ${booking.slot} (member ${booking.memberId}) không có check-in và chưa ghi nhận điểm danh PT. Vui lòng xác nhận kết quả.`,
        relatedId: booking._id,
        relatedType: 'Booking',
        redirectUrl: '/staff/checkin',
        createdBy: 'System',
      }).catch((err) => console.error('Notify needs-review failed:', err.message))
    }
  }

  return { completed, noShow, ptNoShow, needsReview }
}

/**
 * Xử lý pt_no_show: hoàn 100% tiền buổi + đền bù 1 buổi tập về ví member.
 * Dùng transaction + idempotency key để không bị double khi job chạy lại.
 */
const handlePtNoShow = async (booking, now, { auto, attendance } = {}) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    const amount = Number(booking.totalAmount || 0)

    if (booking.paymentStatus === 'paid' && amount > 0) {
      await applyWalletTransaction({
        userId: booking.memberId,
        amount,
        type: 'refund',
        provider: 'wallet',
        source: 'pt_booking_refund',
        description: `Hoàn 100% buổi PT ${fmtDate(booking.date)} ${booking.slot} (PT không đến)`,
        referenceId: booking._id.toString(),
        status: 'completed',
        metadata: { bookingId: booking._id.toString(), ptId: booking.ptId, reason: 'pt_no_show' },
        idempotencyKey: `pt_booking_refund_${booking._id}`,
        session,
      })
      await applyWalletTransaction({
        userId: booking.memberId,
        amount,
        type: 'compensation',
        provider: 'wallet',
        source: 'pt_booking_compensation',
        description: `Đền bù 1 buổi tập vì PT không đến (buổi ${fmtDate(booking.date)} ${booking.slot})`,
        referenceId: booking._id.toString(),
        status: 'completed',
        metadata: { bookingId: booking._id.toString(), ptId: booking.ptId, reason: 'pt_no_show_compensation' },
        idempotencyKey: `pt_booking_compensation_${booking._id}`,
        session,
      })
    }

    await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          status: 'pt_no_show',
          paymentStatus: booking.paymentStatus === 'paid' ? 'refunded' : booking.paymentStatus,
          noShowMarkedAt: now,
          noShowMarkedBy: auto ? null : booking.ptId,
          autoNoShow: !!auto,
          needsReview: false,
        },
      },
    ).session(session)

    await session.commitTransaction()

    createNotification({
      receiverId: booking.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.REFUND_APPROVED,
      title: 'PT vắng mặt — đã hoàn tiền và đền bù',
      content: `PT không đến buổi ${fmtDate(booking.date)} ${booking.slot}. Đã hoàn ${amount.toLocaleString('vi-VN')}đ về ví và đền bù thêm 1 buổi tập.`,
      relatedId: booking._id,
      relatedType: 'Booking',
      redirectUrl: '/booking',
      createdBy: 'System',
    }).catch((err) => console.error('Notify auto pt no-show failed:', err.message))
  } catch (error) {
    await session.abortTransaction()
    console.error(`[noShowSweeper] Lỗi xử lý pt_no_show booking ${booking._id}:`, error.message)
  } finally {
    session.endSession()
  }
}

export const startNoShowSweeperJob = () => {
  runNoShowSweeperJob().catch((error) => console.error('[noShowSweeper] Lỗi chạy job:', error.message))
  return setInterval(() => {
    runNoShowSweeperJob().catch((error) => console.error('[noShowSweeper] Lỗi chạy job:', error.message))
  }, CHECK_INTERVAL_MS)
}
