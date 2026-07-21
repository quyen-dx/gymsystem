import OrderReturn from '../models/OrderReturn.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import logger from '../config/logger.js'

const SELLER_RESPONSE_HOURS = 48

export const runReturnApprovalTimeoutJob = async () => {
  try {
    const cutoff = new Date(Date.now() - SELLER_RESPONSE_HOURS * 60 * 60 * 1000)

    const expired = await OrderReturn.find({
      status: 'requested',
      createdAt: { $lt: cutoff },
    }).lean()

    let rejectedCount = 0

    for (const { _id, userId } of expired) {
      const updated = await OrderReturn.findOneAndUpdate(
        { _id, status: 'requested' },
        {
          $set: {
            status: 'rejected',
            rejectionReason: `Người bán không phản hồi trong ${SELLER_RESPONSE_HOURS} giờ`,
            rejectedAt: new Date(),
          },
        },
        { new: true },
      )

      if (!updated) continue

      rejectedCount++

      createNotification({
        receiverId: userId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.OTHER,
        title: 'Yêu cầu hoàn trả bị từ chối (hết thời gian)',
        content: `Người bán đã không phản hồi yêu cầu hoàn trả của bạn trong ${SELLER_RESPONSE_HOURS} giờ. Vui lòng liên hệ hỗ trợ để được giải quyết.`,
        relatedId: _id,
        relatedType: 'OrderReturn',
        redirectUrl: '/my-orders',
        createdBy: 'System',
      }).catch(() => {})

      createNotification({
        receiverId: null,
        receiverRole: 'seller',
        notificationType: NOTIFICATION_TYPES.OTHER,
        title: 'Yêu cầu hoàn trả bị từ chối tự động',
        content: `Yêu cầu hoàn trả #${_id} đã bị từ chối tự động do bạn không phản hồi trong ${SELLER_RESPONSE_HOURS} giờ.`,
        relatedId: _id,
        relatedType: 'OrderReturn',
        redirectUrl: '/seller/returns',
        createdBy: 'System',
      }).catch(() => {})
    }

    if (rejectedCount > 0) {
      logger.info(`[ReturnApprovalTimeoutJob] Auto-rejected ${rejectedCount} return requests due to seller timeout`)
    }
  } catch (error) {
    logger.error('[ReturnApprovalTimeoutJob] Failed:', error.message)
  }
}
