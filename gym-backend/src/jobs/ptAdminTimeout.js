import TrainingRequest from '../models/TrainingRequest.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { emitPtRequestEvent } from '../services/socketService.js'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

export const runPtAdminTimeoutJob = async () => {
  const now = new Date()
  const staleRequests = await TrainingRequest.find({
    type: 'pt1on1',
    status: 'pending',
    adminDeadline: { $lte: now },
  }).lean()

  for (const request of staleRequests) {
    const expired = await TrainingRequest.findOneAndUpdate(
      { _id: request._id, status: 'pending', adminDeadline: { $lte: now } },
      { $set: { status: 'expired', cancelledAt: now, cancelReason: 'Admin processing deadline expired' } },
      { new: true },
    )
    if (!expired) continue

    await createNotification({
      receiverId: expired.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_FAILED,
      title: 'Yêu cầu đặt lịch PT đã hết thời gian xử lý',
      content: 'Yêu cầu chưa được Admin xử lý trước giờ tập nên đã tự đóng. Bạn chưa bị trừ bất kỳ khoản phí nào.',
      relatedId: expired._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/booking',
      createdBy: 'System',
    })
    await createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.PT_REQUEST_CANCELLED,
      title: 'Yêu cầu PT 1-1 quá hạn xử lý',
      content: 'Một yêu cầu PT 1-1 đã tự đóng vì thời điểm tập đầu tiên đã qua.',
      relatedId: expired._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/admin/members?pt1on1=1&pt1on1Status=expired',
      createdBy: 'System',
    })
    emitPtRequestEvent('pt_request_expired', { request: expired })
  }
}

export const startPtAdminTimeoutJob = () => {
  runPtAdminTimeoutJob().catch((error) => console.error('[ptAdminTimeout] Job failed:', error.message))
  return setInterval(() => {
    runPtAdminTimeoutJob().catch((error) => console.error('[ptAdminTimeout] Job failed:', error.message))
  }, CHECK_INTERVAL_MS)
}
