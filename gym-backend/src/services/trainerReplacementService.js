import TrainerReplacementRequest from '../models/TrainerReplacementRequest.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import ScheduleOverride from '../models/ScheduleOverride.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import User from '../models/User.js'
import { emitTrainerReplacementNotification } from './socketService.js'

const DAY_LABELS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

export const createReplacementRequest = async ({ scheduleId, originalTrainerId, date, reason }) => {
  const request = await TrainerReplacementRequest.create({
    scheduleId,
    originalTrainerId,
    date: new Date(date),
    reason,
    status: 'pending',
  })

  createNotification({
    receiverId: null,
    receiverRole: 'admin',
    notificationType: NOTIFICATION_TYPES.TRAINER_REPLACEMENT_ASSIGNED,
    title: 'Yêu cầu thay ca mới',
    content: `Có một yêu cầu thay ca mới cần được xử lý.`,
    relatedId: request._id,
    relatedType: 'TrainerReplacementRequest',
    redirectUrl: '/admin/trainer-replacements',
    createdBy: 'PT',
  }).catch(err => console.error('Notify trainer replacement request failed:', err.message))

  return request
}

export const getMyRequests = async ({ trainerId, status }) => {
  const filter = { originalTrainerId: trainerId }
  if (status) filter.status = status
  return TrainerReplacementRequest.find(filter)
    .populate('scheduleId', 'memberId date sessions')
    .populate('replacementTrainerId', 'name fullName email')
    .sort({ createdAt: -1 })
}

export const getAllPendingRequests = async ({ page = 1, limit = 20 }) => {
  const skip = (Number(page) - 1) * Number(limit)
  const filter = { status: 'pending' }
  const [items, total] = await Promise.all([
    TrainerReplacementRequest.find(filter)
      .populate('originalTrainerId', 'name fullName email')
      .populate('scheduleId', 'memberId date sessions')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    TrainerReplacementRequest.countDocuments(filter),
  ])
  return {
    requests: items,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  }
}

export const approveRequest = async ({ requestId, replacementTrainerId, handledBy }) => {
  const request = await TrainerReplacementRequest.findByIdAndUpdate(
    requestId,
    {
      status: 'approved',
      replacementTrainerId,
      handledBy,
      handledAt: new Date(),
    },
    { new: true },
  )
  if (request) {
    try {
      const schedule = await WorkoutSchedule.findById(request.scheduleId)
        .populate('memberId', 'name fullName')
        .lean()

      const originalPt = await User.findById(request.originalTrainerId)
        .select('name fullName')
        .lean()

      if (schedule) {
        const targetDate = new Date(request.date)
        const dayLabel = DAY_LABELS[targetDate.getDay()]
        const dateStr = targetDate.toLocaleDateString('vi-VN')

        // Tạo ScheduleOverride cho từng session trùng ngày — thay PT tạm thời chỉ trong ngày đó
        const overrides = []
        const sessionDetailsParts = []
        const sessions = schedule.sessions || []
        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i]
          if (!s.date) continue
          const sDate = new Date(s.date)
          if (sDate.toDateString() !== targetDate.toDateString()) continue

          overrides.push({
            replacementRequestId: request._id,
            workoutScheduleId: request.scheduleId,
            sessionIndex: i,
            originalPtId: request.originalTrainerId,
            overridePtId: replacementTrainerId,
            effectiveDate: targetDate,
          })

          const parts = [`Giờ: ${s.time || 'Chưa xác định'}`]
          if (s.className) parts.push(`Lớp: ${s.className}`)
          if (s.classCode) parts.push(`Mã: ${s.classCode}`)
          if (s.location) parts.push(`Địa điểm: ${s.location}`)
          if (s.title) parts.push(`Nội dung: ${s.title}`)
          sessionDetailsParts.push(parts.join(' - '))
        }

        if (overrides.length > 0) {
          await ScheduleOverride.insertMany(overrides)
        }

        const sessionDetails = sessionDetailsParts.join('; ')

        const memberName = schedule.memberId?.fullName || schedule.memberId?.name || 'Hội viên'
        const originalPtName = originalPt?.fullName || originalPt?.name || 'PT'

        // Lấy thông tin PT thay thế
        const replacementPt = await User.findById(replacementTrainerId)
          .select('name fullName')
          .lean()
        const replacementPtName = replacementPt?.fullName || replacementPt?.name || 'PT'

        // Thông báo cho PT thay thế (PT B)
        const notifReplacement = await createNotification({
          receiverId: replacementTrainerId,
          receiverRole: 'pt',
          notificationType: NOTIFICATION_TYPES.TRAINER_REPLACEMENT_ASSIGNED,
          title: 'Lịch dạy thay mới',
          content: `Bạn được xếp dạy thay ${originalPtName} vào ${dayLabel}, ngày ${dateStr}. ${sessionDetails ? `Chi tiết: ${sessionDetails}.` : ''} Hội viên: ${memberName}.`,
          relatedId: requestId,
          relatedType: 'TrainerReplacementRequest',
          createdBy: 'Admin',
          sendEmail: false,
        })

        emitTrainerReplacementNotification({
          userId: replacementTrainerId,
          notification: notifReplacement,
        })

        // Thông báo cho PT gốc (PT A) - biết ai đã nhận thay
        const notifOriginal = await createNotification({
          receiverId: request.originalTrainerId,
          receiverRole: 'pt',
          notificationType: NOTIFICATION_TYPES.TRAINER_REPLACEMENT_ASSIGNED,
          title: 'Đã có PT dạy thay',
          content: `Yêu cầu thay ca của bạn vào ${dayLabel}, ngày ${dateStr} đã được duyệt. PT ${replacementPtName} sẽ dạy thay bạn. ${sessionDetails ? `Chi tiết: ${sessionDetails}.` : ''} Hội viên: ${memberName}.`,
          relatedId: requestId,
          relatedType: 'TrainerReplacementRequest',
          createdBy: 'Admin',
          sendEmail: false,
        })

        emitTrainerReplacementNotification({
          userId: request.originalTrainerId,
          notification: notifOriginal,
        })
      }
    } catch (err) {
      console.error('Gửi thông báo thay ca thất bại:', err.message)
    }
  }
  return request
}

export const rejectRequest = async ({ requestId, handledBy, reason = '' }) => {
  const request = await TrainerReplacementRequest.findByIdAndUpdate(
    requestId,
    { status: 'rejected', handledBy, handledAt: new Date(), rejectReason: reason },
    { new: true },
  )

  // Thông báo cho PT yêu cầu biết yêu cầu bị từ chối
  if (request) {
    try {
      const targetDate = new Date(request.date)
      const dayLabel = DAY_LABELS[targetDate.getDay()]
      const dateStr = targetDate.toLocaleDateString('vi-VN')

      const notif = await createNotification({
        receiverId: request.originalTrainerId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.TRAINER_REPLACEMENT_REJECTED,
        title: 'Yêu cầu thay ca bị từ chối',
        content: `Yêu cầu thay ca của bạn vào ${dayLabel}, ngày ${dateStr} đã bị từ chối. ${reason ? `Lý do: ${reason}` : 'Vui lòng liên hệ admin để biết thêm chi tiết.'}`,
        relatedId: requestId,
        relatedType: 'TrainerReplacementRequest',
        createdBy: 'Admin',
        sendEmail: false,
      })

      emitTrainerReplacementNotification({
        userId: request.originalTrainerId,
        notification: notif,
      })
    } catch (err) {
      console.error('Gửi thông báo từ chối thất bại:', err.message)
    }
  }

  return request
}
