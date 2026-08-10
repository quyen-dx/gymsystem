import mongoose from 'mongoose'
import TrainingRequest from '../models/TrainingRequest.js'
import Booking from '../models/Booking.js'
import Notification, { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { emitPtRequestEvent, emitNotificationUpdated } from '../services/socketService.js'

// PT phải phản hồi trong N giờ sau khi được phân công; hết hạn → tự thu hồi
// và đưa yêu cầu về waiting_assignment để admin phân công PT khác.
const TIMEOUT_HOURS = Number(process.env.PT_CONFIRM_TIMEOUT_HOURS) || 48
const CHECK_INTERVAL_MS = 30 * 60 * 1000

const getDocId = (value) => (value && typeof value === 'object' ? value._id : value)

const processStaleRequest = async (request) => {
  const trainerId = getDocId(request.assignedTrainerId)
  const memberId = getDocId(request.memberId)
  const memberName = request.memberId && typeof request.memberId === 'object'
    ? (request.memberId.fullName || request.memberId.name || '')
    : ''

  const session = await mongoose.startSession()
  let updated
  const expiredNotifs = []
  try {
    session.startTransaction()

    // Atomic transition trước: chỉ khi yêu cầu VẪN còn ở trạng thái 'assigned' thì mới thu hồi.
    // Nếu PT đã accept/reject hoặc member đã hủy ngay trong lúc job chạy → không đụng gì cả,
    // tránh race condition hủy nhầm booking vừa được xác nhận chờ thanh toán.
    updated = await TrainingRequest.findOneAndUpdate(
      { _id: request._id, status: 'assigned' },
      {
        $set: {
          status: 'waiting_assignment',
          assignedTrainerId: null,
          assignedAt: null,
          ptConfirmationDeadline: null,
          ptConfirmationExpiredAt: new Date(),
        },
      },
      { new: true, session },
    )
    if (!updated) {
      await session.abortTransaction()
      return
    }

    // Transaction: yêu cầu + booking + notification của PT chuyển trạng thái đồng bộ,
    // tránh kẹt booking 'pending/awaiting_payment' khi request đã quay về chờ phân công.
    if (trainerId) {
      await Booking.updateMany(
        {
          requestId: request._id,
          ptId: trainerId,
          status: { $in: ['pending', 'awaiting_payment'] },
        },
        {
          $set: {
            status: 'cancelled',
            rejectReason: `PT không phản hồi trong ${TIMEOUT_HOURS}h`,
          },
        },
        { session },
      )

      // Vô hiệu hóa nút phản hồi trên notification còn treo của PT
      const ptNotifs = await Notification.find({
        receiverId: trainerId,
        notificationType: NOTIFICATION_TYPES.MEMBER_ASSIGNED,
        relatedId: request._id,
        deletedAt: null,
      }).session(session)
      for (const notif of ptNotifs) {
        notif.requiresAction = false
        notif.actionStatus = 'expired'
        notif.actionAt = new Date()
        notif.isRead = true
        notif.readAt = new Date()
        notif.content = `Yêu cầu của hội viên ${memberName || '—'} đã hết hạn phản hồi và được chuyển cho PT khác.`
        await notif.save({ session })
        expiredNotifs.push(notif.toObject())
      }
    }

    await session.commitTransaction()
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }

  for (const notif of expiredNotifs) {
    emitNotificationUpdated({ userId: trainerId, notification: notif })
  }

  const { getRequestById } = await import('../services/trainingRequestService.js')
  const pop = await getRequestById(request._id)
  emitPtRequestEvent('pt_request_waiting_assignment', { request: pop })

  const { fullName: trainerName } = request.assignedTrainerId && typeof request.assignedTrainerId === 'object'
    ? request.assignedTrainerId
    : { fullName: '' }

  createNotification({
    receiverId: null,
    receiverRole: 'admin',
    notificationType: NOTIFICATION_TYPES.PT_REASSIGN_DECLINED,
    title: 'PT chưa phản hồi yêu cầu',
    content: `PT ${trainerName || '—'} chưa phản hồi yêu cầu của hội viên ${memberName || '—'} trong ${TIMEOUT_HOURS}h.\nYêu cầu đã quay về chờ phân công. Vui lòng phân công PT khác.`,
    relatedId: request._id,
    relatedType: 'TrainingRequest',
    redirectUrl: '/admin/members?pt1on1=1&pt1on1Status=waiting_assignment',
    priority: 'high',
    createdBy: 'System',
  })
  if (memberId) {
    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PT_REASSIGNING,
      title: 'Đang tìm PT phù hợp hơn',
      content: 'PT được phân công chưa phản hồi trong thời gian quy định.\nHệ thống đang tìm PT phù hợp hơn cho bạn. Vui lòng chờ trong giây lát.',
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/booking',
      createdBy: 'System',
    })
  }
}

export const runPtConfirmationTimeoutJob = async () => {
  const deadline = new Date(Date.now() - TIMEOUT_HOURS * 60 * 60 * 1000)
  const stale = await TrainingRequest.find({
    type: 'pt1on1',
    status: 'assigned',
    $or: [
      { ptConfirmationDeadline: { $lte: new Date() } },
      { ptConfirmationDeadline: null, assignedAt: { $lte: deadline } },
    ],
  })
    .populate('memberId', 'fullName name')
    .populate('assignedTrainerId', 'fullName name')
    .lean()

  if (stale.length > 0) {
    console.log(`[ptConfirmationTimeout] ${stale.length} yêu cầu quá hạn ${TIMEOUT_HOURS}h, thu hồi phân công...`)
  }

  for (const request of stale) {
    try {
      await processStaleRequest(request)
    } catch (error) {
      console.error(`[ptConfirmationTimeout] Lỗi xử lý yêu cầu ${request._id}:`, error.message)
    }
  }
}

export const startPtConfirmationTimeoutJob = () => {
  runPtConfirmationTimeoutJob().catch((error) => {
    console.error('[ptConfirmationTimeout] Lỗi chạy job:', error.message)
  })
  return setInterval(() => {
    runPtConfirmationTimeoutJob().catch((error) => {
      console.error('[ptConfirmationTimeout] Lỗi chạy job:', error.message)
    })
  }, CHECK_INTERVAL_MS)
}
