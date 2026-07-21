import Order from '../models/Order.js'
import Shipping from '../models/Shipping.js'
import { getTrackingInfoGHN } from '../services/ghnService.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import logger from '../config/logger.js'

export const runShipmentTrackingJob = async () => {
  try {
    const activeOrders = await Order.find({
      status: { $in: ['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG'] },
      trackingCode: { $exists: true, $ne: '', $ne: null },
    }).lean()

    for (const order of activeOrders) {
      try {
        const ghnData = await getTrackingInfoGHN(order.trackingCode)
        if (!ghnData) continue

        const ghnStatus = ghnData.status || ''
        const mappedStatus =
          ghnStatus === 'delivered' ? 'GIAO THÀNH CÔNG'
          : ghnStatus === 'canceled' || ghnStatus === 'returned' ? 'ĐÃ HỦY'
          : null

        if (!mappedStatus) continue

        if (mappedStatus === 'GIAO THÀNH CÔNG' && order.status !== 'GIAO THÀNH CÔNG') {
          await Order.updateOne(
            { _id: order._id },
            { $set: { status: 'GIAO THÀNH CÔNG', inventoryDeducted: true } },
          )
          await Shipping.updateOne(
            { orderId: order._id },
            { $set: { trackingStatus: 'GIAO THÀNH CÔNG' } },
          )

          createNotification({
            receiverId: order.userId,
            notificationType: NOTIFICATION_TYPES.OTHER,
            title: 'Đơn hàng đã được giao',
            content: 'Đơn hàng của bạn đã được giao thành công. Vui lòng xác nhận đã nhận hàng.',
            relatedId: order._id,
            relatedType: 'Order',
          }).catch(() => {})

          logger.info(`[ShipmentTrackingJob] Auto-confirmed delivery for order ${order._id}`)
        }

        if (mappedStatus === 'ĐÃ HỦY' && !['ĐÃ HỦY', 'GIAO THÀNH CÔNG'].includes(order.status)) {
          await Order.updateOne(
            { _id: order._id },
            { $set: { status: 'ĐÃ HỦY', cancelledAt: new Date() } },
          )
          await Shipping.updateOne(
            { orderId: order._id },
            { $set: { trackingStatus: 'ĐÃ HỦY' } },
          )
        }
      } catch (_) {
        // skip individual order failures
      }
    }
  } catch (error) {
    logger.error('[ShipmentTrackingJob] Failed:', error.message)
  }
}
