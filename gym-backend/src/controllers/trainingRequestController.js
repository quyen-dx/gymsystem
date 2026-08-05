import * as trainingRequestService from '../services/trainingRequestService.js'
import { getIO, emitPtRequestEvent, emitNotificationUpdated, emitPtClientsUpdated } from '../services/socketService.js'
import Notification, { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

export const createRequest = async (req, res) => {
  try {
    const request = await trainingRequestService.createRequest({ memberId: req.user._id, data: req.body })
    const pop = await trainingRequestService.getRequestById(request._id)
    const isPt1on1 = (req.body.type || 'group') === 'pt1on1'

    emitPtRequestEvent('pt_request_created', { request: pop })
    const memberName = typeof pop.memberId === 'object' ? (pop.memberId.fullName || pop.memberId.name || '') : ''
    createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.PT_REQUEST_NEW,
      title: isPt1on1 ? 'Có yêu cầu PT 1-1 mới' : 'Có yêu cầu tập luyện nhóm mới',
      content: `Hội viên ${memberName || '—'} vừa gửi yêu cầu ${isPt1on1 ? 'PT 1-1' : 'tập luyện nhóm'}. Vui lòng xử lý.`,
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: isPt1on1 ? '/admin/members?pt1on1=1&pt1on1Status=pending' : '/admin/members',
      priority: 'high',
      createdBy: 'System',
    })

    // Xác nhận cho hội viên (ngôi thứ hai — "Bạn đã...")
    const memberUserId = typeof pop.memberId === 'object' ? pop.memberId._id : pop.memberId
    if (memberUserId) {
      createNotification({
        receiverId: memberUserId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PT_REQUEST_NEW,
        title: isPt1on1 ? 'Bạn đã gửi yêu cầu PT 1-1' : 'Bạn đã gửi yêu cầu tập luyện nhóm',
        content: isPt1on1
          ? 'Bạn đã gửi yêu cầu PT 1-1 thành công.\nAdmin sẽ xử lý yêu cầu của bạn trong thời gian sớm nhất.'
          : 'Bạn đã gửi yêu cầu tập luyện nhóm thành công.\nAdmin sẽ xử lý yêu cầu của bạn trong thời gian sớm nhất.',
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/booking',
        createdBy: 'System',
      })
    }

    // Thông báo cho PT được hội viên chỉ định (nếu có) — PT chỉ nhận notification liên quan tới chính họ
    if (isPt1on1 && req.body.preferredTrainerId) {
      createNotification({
        receiverId: req.body.preferredTrainerId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.PT_REQUEST_DESIGNATED,
        title: 'Hội viên đã yêu cầu bạn làm PT riêng',
        content: `Hội viên ${memberName || '—'} đã chỉ định bạn làm PT riêng.\nYêu cầu đang chờ admin xử lý. Bạn sẽ được thông báo khi được phân công.`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/pt/clients',
        createdBy: 'System',
      })
    }

    res.status(201).json({ message: 'Đã gửi yêu cầu tập luyện', request: pop })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message })
  }
}

export const getMyRequests = async (req, res) => {
  try {
    const type = req.query.type || undefined
    const requests = await trainingRequestService.getMyRequests({ memberId: req.user._id, type, status: req.query.status, activeOnly: req.query.activeOnly === 'true' })
    res.json({ requests })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllRequests = async (req, res) => {
  try {
    const type = req.query.type || undefined
    const result = await trainingRequestService.getAllRequests({ type, status: req.query.status, activeOnly: req.query.activeOnly === 'true', page: req.query.page, limit: req.query.limit })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getPt1on1Counts = async (req, res) => {
  try {
    const counts = await trainingRequestService.getPt1on1Counts()
    res.json({ counts })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getRequestById = async (req, res) => {
  try {
    const request = await trainingRequestService.getRequestById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    res.json({ request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const assignToClass = async (req, res) => {
  try {
    const request = await trainingRequestService.assignToClass({
      requestId: req.params.id,
      classId: req.body.classId,
      assignedBy: req.user._id,
    })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    const pop = await trainingRequestService.getRequestById(request._id)
    emitPtRequestEvent('pt_request_assigned', { request: pop })

    res.json({ message: 'Đã xếp lớp thành công', request: pop })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message })
  }
}

export const assignTrainer = async (req, res) => {
  try {
    const request = await trainingRequestService.assignTrainer({
      requestId: req.params.id,
      trainerId: req.body.trainerId,
      assignedBy: req.user._id,
    })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    const pop = await trainingRequestService.getRequestById(request._id)
    emitPtRequestEvent('pt_request_assigned', { request: pop })

    const memberName = typeof pop.memberId === 'object' ? (pop.memberId.fullName || pop.memberId.name || '') : ''
    const trainerName = typeof pop.assignedTrainerId === 'object' ? (pop.assignedTrainerId.fullName || pop.assignedTrainerId.name || '') : ''
    createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.PT_REQUEST_ASSIGNED,
      title: 'Đã phân công PT cho hội viên',
      content: `Hội viên ${memberName || '—'} đã được phân công PT ${trainerName || '—'}. Yêu cầu đã hoàn thành.`,
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/admin/members?pt1on1=1&pt1on1Status=assigned',
      createdBy: 'System',
    })

    res.json({ message: 'Đã phân công PT thành công', request: pop })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message })
  }
}

/**
 * PT phản hồi (Chấp nhận / Từ chối) việc được phân công hội viên PT 1-1.
 * - accept: PT xác nhận phụ trách → admin + member nhận notification.
 * - reject: PT từ chối (kèm lý do) → yêu cầu quay về waiting_assignment để admin phân công PT khác.
 */
export const respondPtAssignment = async (req, res) => {
  try {
    const action = req.body.action
    const reason = (req.body.reason || '').trim()
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action phải là accept hoặc reject' })
    }
    if (action === 'reject' && !reason) {
      return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối' })
    }

    const request = await trainingRequestService.getRequestById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    const trainerId = typeof request.assignedTrainerId === 'object' ? request.assignedTrainerId?._id : request.assignedTrainerId
    if (!trainerId || trainerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bạn không được phân công cho hội viên này' })
    }
    if (request.status !== 'assigned') {
      return res.status(400).json({ message: 'Yêu cầu không còn ở trạng thái chờ xác nhận' })
    }

    const memberUserId = typeof request.memberId === 'object' ? request.memberId._id : request.memberId
    const memberName = typeof request.memberId === 'object' ? (request.memberId.fullName || request.memberId.name || '') : ''
    const trainerName = req.user.fullName || req.user.name || ''

    // Cập nhật notification của PT: action chỉ thao tác được 1 lần
    const ptNotifs = await Notification.find({
      receiverId: req.user._id,
      notificationType: NOTIFICATION_TYPES.MEMBER_ASSIGNED,
      relatedId: request._id,
      deletedAt: null,
    })
    const actionStatus = action === 'accept' ? 'accepted' : 'rejected'
    for (const notif of ptNotifs) {
      notif.actionStatus = actionStatus
      notif.actionAt = new Date()
      notif.isRead = true
      notif.readAt = new Date()
      notif.requiresAction = false
      notif.content = action === 'accept'
        ? 'Bạn đã chấp nhận hội viên này.'
        : `Bạn đã từ chối nhận hội viên ${memberName || '—'}.${reason ? ` Lý do: ${reason}` : ''}`
      await notif.save()
      emitNotificationUpdated({ userId: req.user._id, notification: notif.toObject() })
    }

    if (action === 'accept') {
      // Tạo quan hệ PT ↔ Member (PTAssignment active) để hội viên xuất hiện
      // trong "Học viên của tôi" của PT (nguồn dữ liệu backend — không hardcode frontend).
      const { createAssignment } = await import('../services/ptAssignmentService.js')
      await createAssignment({ memberId: memberUserId, ptId: trainerId })

      // Realtime: yêu cầu trang "Học viên của tôi" của PT tải lại ngay (counter 0 → 1)
      emitPtClientsUpdated({ userId: req.user._id, data: { action: 'added', memberId: memberUserId } })

      createNotification({
        receiverId: null,
        receiverRole: 'admin',
        notificationType: NOTIFICATION_TYPES.PT_REASSIGN_ACCEPTED,
        title: 'PT đã chấp nhận hội viên',
        content: `PT ${trainerName} đã chấp nhận phụ trách hội viên ${memberName || '—'}.`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/admin/members?pt1on1=1&pt1on1Status=assigned',
        createdBy: 'System',
      })
      createNotification({
        receiverId: memberUserId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PT_ASSIGNED,
        title: 'PT đã xác nhận phụ trách bạn',
        content: `PT ${trainerName} đã xác nhận phụ trách bạn.\nPT sẽ chủ động liên hệ với bạn qua SĐT hoặc Email.`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/my-membership',
        createdBy: 'System',
      })
    } else {
      // Rút phân công → yêu cầu về chờ phân công để admin chọn PT khác
      const updated = await trainingRequestService.unassignTrainer({ requestId: request._id, rejectedPtId: trainerId })
      const pop = updated ? await trainingRequestService.getRequestById(request._id) : request
      emitPtRequestEvent('pt_request_waiting_assignment', { request: pop })

      createNotification({
        receiverId: null,
        receiverRole: 'admin',
        notificationType: NOTIFICATION_TYPES.PT_REASSIGN_DECLINED,
        title: 'PT từ chối nhận hội viên',
        content: `PT ${trainerName} đã từ chối phụ trách hội viên ${memberName || '—'}.${reason ? `\nLý do: ${reason}` : ''}`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/admin/members?pt1on1=1&pt1on1Status=waiting_assignment',
        priority: 'high',
        createdBy: 'System',
      })
      createNotification({
        receiverId: memberUserId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PT_REASSIGNING,
        title: 'Đang tìm PT phù hợp hơn',
        content: 'Hệ thống đang tìm PT phù hợp hơn cho bạn. Vui lòng chờ trong giây lát.',
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/booking',
        createdBy: 'System',
      })
    }

    res.json({ message: action === 'accept' ? 'Đã chấp nhận hội viên' : 'Đã từ chối nhận hội viên' })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message })
  }
}

export const sendMessage = async (req, res) => {
  try {
    const content = (req.body.content || '').trim()
    const request = await trainingRequestService.sendMessage({ requestId: req.params.id, content, proposal: req.body.proposal || null })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    const pop = await trainingRequestService.getRequestById(request._id)
    emitPtRequestEvent('pt_request_updated', { request: pop })

    const isPt1on1 = pop.type === 'pt1on1'
    const memberId = typeof pop.memberId === 'object' ? pop.memberId._id : pop.memberId

    // Notify member với các nút [Đồng ý] / [Đề xuất giờ khác] / [Từ chối]
    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PT_REASSIGN_REQUEST,
      title: isPt1on1 ? 'Đề xuất PT phù hợp hơn' : 'Đề xuất lớp tập',
      content: content || (isPt1on1
        ? 'Hiện chưa có PT phù hợp với thời gian bạn yêu cầu.\nChúng tôi có một số gợi ý PT khác. Bạn có muốn xem và lựa chọn không?'
        : 'GymPro hiện chưa có lớp đúng thời gian bạn yêu cầu.\nChúng tôi đề xuất một lớp tập phù hợp hơn. Bạn vui lòng xác nhận để chúng tôi sắp xếp lịch.'),
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/booking',
      createdBy: 'Admin',
      requiresAction: true,
      actions: ['accept', 'counter', 'reject'],
    })

    res.json({ message: 'Đã gửi đề xuất cho hội viên', request: pop })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message })
  }
}

export const respondToMessage = async (req, res) => {
  try {
    const action = req.body.action
    const suggestion = (req.body.suggestion || '').trim()
    if (!['accept', 'counter', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action phải là accept, counter hoặc reject' })
    }

    const request = await trainingRequestService.respondToMessage({
      requestId: req.params.id,
      action,
      suggestion,
      memberId: req.user._id,
    })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    const pop = await trainingRequestService.getRequestById(request._id)
    const io = getIO()

    // Lưu trạng thái action vào notification (chỉ thao tác được 1 lần)
    const memberId = req.user._id
    const actionStatus = action === 'accept' ? 'accepted' : action === 'counter' ? 'countered' : 'rejected'
    const memberNotifs = await Notification.find({
      receiverId: memberId,
      notificationType: NOTIFICATION_TYPES.PT_REASSIGN_REQUEST,
      relatedId: request._id,
      deletedAt: null,
    })
    for (const notif of memberNotifs) {
      notif.actionStatus = actionStatus
      notif.actionAt = new Date()
      notif.isRead = true
      notif.readAt = new Date()
      notif.requiresAction = false
      await notif.save()
      emitNotificationUpdated({ userId: memberId, notification: notif.toObject() })
    }

    const memberName = typeof pop.memberId === 'object' ? (pop.memberId.fullName || pop.memberId.name || '') : ''
    const isPt1on1 = pop.type === 'pt1on1'

    if (action === 'accept') {
      emitPtRequestEvent('pt_request_waiting_assignment', { request: pop, memberName })
      // Nếu admin/staff đang mở màn hình Phân công (room pt1on1-active-view),
      // list sẽ tự cập nhật qua socket nên không tạo thông báo trùng lặp.
      const viewingModal = !!(io && io.sockets?.adapter?.rooms?.get('pt1on1-active-view')?.size)
      if (!viewingModal) {
        createNotification({
          receiverId: null,
          receiverRole: 'admin',
          notificationType: NOTIFICATION_TYPES.ACTION_REQUIRED,
          title: `Có yêu cầu cần ${isPt1on1 ? 'phân công PT' : 'xếp lớp'}`,
          content: `Hội viên ${memberName || '—'} đã đồng ý với đề xuất của bạn. Vui lòng ${isPt1on1 ? 'phân công PT' : 'xếp lớp'} để hoàn tất.`,
          relatedId: request._id,
          relatedType: 'TrainingRequest',
          redirectUrl: '/admin/members?pt1on1=1&pt1on1Status=waiting_assignment',
          requiresAction: true,
          actions: ['go_to_request'],
          priority: 'high',
          createdBy: 'System',
        })
      }
    } else if (action === 'counter') {
      emitPtRequestEvent('pt_request_updated', { request: pop, memberName })
      createNotification({
        receiverId: null,
        receiverRole: 'admin',
        notificationType: NOTIFICATION_TYPES.ACTION_REQUIRED,
        title: 'Hội viên đề xuất giờ khác',
        content: `Hội viên ${memberName || '—'} muốn điều chỉnh đề xuất của bạn.\n${suggestion}`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/admin/members',
        requiresAction: true,
        actions: ['go_to_request'],
        priority: 'high',
        createdBy: 'System',
      })
    } else {
      emitPtRequestEvent('pt_request_rejected', { request: pop, memberName })
      createNotification({
        receiverId: null,
        receiverRole: 'admin',
        notificationType: NOTIFICATION_TYPES.PT_REASSIGN_DECLINED,
        title: 'Hội viên đã từ chối đề xuất',
        content: `Hội viên ${memberName || '—'} đã từ chối đề xuất của bạn. Yêu cầu được đóng lại, không cần xử lý tiếp.`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/admin/members',
        createdBy: 'System',
      })
    }

    res.json({
      message: action === 'accept'
        ? 'Đã đồng ý đề xuất'
        : action === 'counter'
          ? 'Đã gửi đề xuất giờ khác'
          : 'Đã từ chối đề xuất',
      request: pop,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message })
  }
}

export const cancelMyRequest = async (req, res) => {
  try {
    const request = await trainingRequestService.cancelRequest({ requestId: req.params.id, reason: req.body.reason || '' })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    const pop = await trainingRequestService.getRequestById(request._id)
    emitPtRequestEvent('pt_request_cancelled', { request: pop })

    const memberName = typeof pop.memberId === 'object' ? (pop.memberId.fullName || pop.memberId.name || '') : ''
    const isPt1on1 = pop.type === 'pt1on1'

    // Notify admin
    createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.PT_REQUEST_CANCELLED,
      title: 'Hội viên đã hủy yêu cầu',
      content: `Hội viên ${memberName || '—'} đã hủy yêu cầu ${isPt1on1 ? 'PT 1-1' : 'tập luyện nhóm'}${req.body.reason ? ` với lý do: ${req.body.reason}` : ''}.`,
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/admin/members',
      createdBy: 'System',
    })

    // Notify PT nếu yêu cầu đã được phân công PT
    const trainerId = typeof pop.assignedTrainerId === 'object' ? pop.assignedTrainerId?._id : pop.assignedTrainerId
    if (trainerId) {
      createNotification({
        receiverId: trainerId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.PT_REQUEST_CANCELLED,
        title: 'Hội viên đã hủy yêu cầu',
        content: `Hội viên ${memberName || '—'} đã hủy yêu cầu PT 1-1. Yêu cầu không còn hiệu lực.`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/pt/clients',
        createdBy: 'System',
      })
    }

    res.json({ message: 'Đã hủy yêu cầu', request: pop })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
