import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import TrainingRequest from '../models/TrainingRequest.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

const CHECK_INTERVAL_MS = 60 * 1000

const expireDirectBooking = async (booking, now) => {
  const result = await Booking.updateOne(
    { _id: booking._id, status: 'awaiting_payment', paymentDeadline: { $lte: now } },
    { $set: { status: 'cancelled', paymentStatus: 'expired', paymentExpiredAt: now, cancelReason: 'Quá thời hạn thanh toán đặt lịch PT' } },
  )
  if (!result.modifiedCount) return

  await createNotification({
    receiverId: booking.memberId,
    receiverRole: 'member',
    notificationType: NOTIFICATION_TYPES.PAYMENT_FAILED,
    title: 'Yêu cầu PT đã hết hạn thanh toán',
    content: 'Bạn chưa thanh toán đúng hạn nên ca PT đã được giải phóng. Bạn có thể tạo yêu cầu mới.',
    relatedId: booking._id,
    relatedType: 'Booking',
    redirectUrl: '/booking',
    createdBy: 'System',
  })
}

// Transaction: yêu cầu + toàn bộ booking của yêu cầu được chuyển trạng thái đồng bộ,
// tránh trường hợp request sang 'payment_expired' nhưng booking vẫn kẹt 'awaiting_payment'.
const expireRequestPayment = async (booking, now) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()
    const request = await TrainingRequest.findOneAndUpdate(
      { _id: booking.requestId, status: 'awaiting_payment', paymentDeadline: { $lte: now } },
      { $set: { status: 'payment_expired', paymentExpiredAt: now, paymentDeadline: null } },
      { new: true, session },
    )
    if (!request) {
      await session.abortTransaction()
      return
    }

    await Booking.updateMany(
      { requestId: request._id, status: 'awaiting_payment' },
      { $set: { status: 'cancelled', paymentStatus: 'expired', paymentExpiredAt: now, cancelReason: 'Quá thời hạn thanh toán yêu cầu PT 1-1' } },
      { session },
    )

    await session.commitTransaction()

    await createNotification({
      receiverId: request.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_FAILED,
      title: 'Yêu cầu PT 1-1 đã hết hạn thanh toán',
      content: 'Bạn chưa thanh toán đúng hạn nên toàn bộ ca đã giữ được giải phóng. Bạn có thể gửi yêu cầu mới.',
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/booking',
      createdBy: 'System',
    })
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

export const runPtPaymentTimeoutJob = async () => {
  const now = new Date()
  const overdueBookings = await Booking.find({ status: 'awaiting_payment', paymentDeadline: { $lte: now } })
    .select('_id requestId memberId')
    .lean()

  for (const booking of overdueBookings) {
    try {
      if (booking.requestId) await expireRequestPayment(booking, now)
      else await expireDirectBooking(booking, now)
    } catch (error) {
      console.error(`[ptPaymentTimeout] Không thể xử lý booking ${booking._id}:`, error.message)
    }
  }
}

export const startPtPaymentTimeoutJob = () => {
  runPtPaymentTimeoutJob().catch((error) => console.error('[ptPaymentTimeout] Lỗi chạy job:', error.message))
  return setInterval(() => {
    runPtPaymentTimeoutJob().catch((error) => console.error('[ptPaymentTimeout] Lỗi chạy job:', error.message))
  }, CHECK_INTERVAL_MS)
}
