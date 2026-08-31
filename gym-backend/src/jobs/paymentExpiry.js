import Payment from '../models/Payment.js'
import { releaseWalletPaymentReservation } from '../services/walletService.js'

const CHECK_INTERVAL_MS = 5 * 60 * 1000
// VNPay intent có hạn 15 phút (vnp_ExpireDate) → đóng Payment PENDING sau 20 phút
const VNPAY_PENDING_TTL_MS = 20 * 60 * 1000

export const runPaymentExpiryJob = async () => {
  const cutoff = new Date(Date.now() - VNPAY_PENDING_TTL_MS)

  const stalePayments = await Payment.find({
    status: 'PENDING',
    paymentMethod: 'VNPAY',
    createdAt: { $lte: cutoff },
  }).select('_id txnRef userId amount metadata').lean()

  let closedCount = 0
  for (const payment of stalePayments) {
    try {
      const result = await Payment.updateOne(
        { _id: payment._id, status: 'PENDING' },
        {
          $set: {
            status: 'FAILED',
            completedAt: new Date(),
            metadata: {
              ...(payment.metadata || {}),
              paymentExpiredAt: new Date(),
              expirySource: 'paymentExpiryJob',
            },
          },
        },
      )
      if (result.modifiedCount) {
        await releaseWalletPaymentReservation({ paymentId: payment._id, reason: 'vnpay_payment_expired' })
        closedCount += 1
        console.log(`[paymentExpiry] Đóng Payment PENDING hết hạn ${payment.txnRef} (${payment._id})`)
      }
    } catch (error) {
      console.error(`[paymentExpiry] Lỗi đóng payment ${payment._id}:`, error.message)
    }
  }

  return { scanned: stalePayments.length, closedCount }
}

export const startPaymentExpiryJob = () => {
  runPaymentExpiryJob().catch((error) => console.error('[paymentExpiry] Lỗi chạy job:', error.message))
  return setInterval(() => {
    runPaymentExpiryJob().catch((error) => console.error('[paymentExpiry] Lỗi chạy job:', error.message))
  }, CHECK_INTERVAL_MS)
}
