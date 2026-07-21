import Payment from '../models/Payment.js'
import MembershipRegistration from '../models/MembershipRegistration.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import logger from '../config/logger.js'

const VNPAY_TIMEOUT_MS = 15 * 60 * 1000
const STRIPE_TIMEOUT_MS = 30 * 60 * 1000

export const runPaymentTimeoutJob = async () => {
  try {
    const now = new Date()
    const vnpayCutoff = new Date(now - VNPAY_TIMEOUT_MS)
    const stripeCutoff = new Date(now - STRIPE_TIMEOUT_MS)

    const filter = {
      $or: [
        { status: { $in: ['PENDING', 'pending'] }, paymentMethod: 'VNPAY', createdAt: { $lt: vnpayCutoff } },
        { status: { $in: ['PENDING', 'pending'] }, paymentMethod: 'STRIPE', createdAt: { $lt: stripeCutoff } },
      ],
    }

    const timedOutPayments = await Payment.find(filter).lean()

    if (timedOutPayments.length === 0) return

    const paymentIds = timedOutPayments.map((p) => p._id)

    await Payment.updateMany({ _id: { $in: paymentIds } }, { $set: { status: 'FAILED' } })

    logger.info('paymentTimeoutJob completed', {
      timedOut: timedOutPayments.length,
    })

    for (const payment of timedOutPayments) {
      if (payment.registrationId) {
        MembershipRegistration.updateOne(
          { _id: payment.registrationId, status: 'pending' },
          {
            $set: {
              status: 'cancelled',
              rejectionReason: 'Payment timed out',
              cancelledAt: now,
            },
          },
        ).catch((err) =>
          logger.error('paymentTimeoutJob: registration cancel failed', { error: err.message }),
        )
      }

      createNotification({
        receiverId: payment.userId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PAYMENT_FAILED,
        title: 'Thanh toán đã hết hạn',
        content: `Giao dịch thanh toán ${payment.amount?.toLocaleString('vi-VN') || ''}đ qua ${payment.paymentMethod || ''} đã hết hạn. Vui lòng thử lại.`,
        relatedId: payment._id,
        relatedType: 'Payment',
        redirectUrl: '/my-membership',
        sendPush: true,
      }).catch((err) =>
        logger.error('paymentTimeoutJob: notification failed', { error: err.message }),
      )
    }
  } catch (err) {
    logger.error('paymentTimeoutJob failed', { error: err.message })
  }
}
