import Order from '../models/Order.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { settleStaleEscrow } from '../services/escrowService.js'
import logger from '../config/logger.js'

const ESCROW_SETTLE_DAYS = 7
const AUTO_CONFIRM_DAYS = 14

export const runEscrowSettlementJob = async () => {
  try {
    const now = new Date()

    const undeliveredOrders = await Order.find({
      status: 'ĐANG GIAO HÀNG',
      updatedAt: { $lt: new Date(now.getTime() - AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000) },
    }).lean()

    for (const order of undeliveredOrders) {
      await Order.updateOne(
        { _id: order._id },
        { $set: { status: 'GIAO THÀNH CÔNG', inventoryDeducted: true } },
      )
      createNotification({
        receiverId: order.userId,
        notificationType: NOTIFICATION_TYPES.OTHER,
        title: 'Đơn hàng tự động xác nhận',
        content: `Đơn hàng của bạn đã được tự động xác nhận giao hàng sau ${AUTO_CONFIRM_DAYS} ngày.`,
        relatedId: order._id,
        relatedType: 'Order',
      }).catch(() => {})
    }

    if (undeliveredOrders.length > 0) {
      logger.info(`[EscrowSettlementJob] Auto-confirmed ${undeliveredOrders.length} deliveries`)
    }

    const deliveredOrders = await Order.find({
      status: 'GIAO THÀNH CÔNG',
      confirmedByBuyer: true,
      escrowReleased: false,
      sellerEscrowAmount: { $gt: 0 },
      confirmedAt: { $lt: new Date(now.getTime() - ESCROW_SETTLE_DAYS * 24 * 60 * 60 * 1000) },
    }).lean()

    for (const order of deliveredOrders) {
      try {
        await settleStaleEscrow(order)
        logger.info(`[EscrowSettlementJob] Settled escrow for order ${order._id}`)
      } catch (_) {
        logger.error(`[EscrowSettlementJob] Failed to settle escrow for order ${order._id}`)
      }
    }

    if (deliveredOrders.length > 0) {
      logger.info(`[EscrowSettlementJob] Settled ${deliveredOrders.length} escrow payments`)
    }
  } catch (error) {
    logger.error('[EscrowSettlementJob] Failed:', error.message)
  }
}
