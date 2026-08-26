import * as trainingRequestService from '../services/trainingRequestService.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { hasActiveMembershipForDate } from './bookingController.js'
import { getIO, emitPtRequestEvent, emitNotificationUpdated, emitPtClientsUpdated } from '../services/socketService.js'
import Booking from '../models/Booking.js'
import PT from '../models/PT.js'
import User from '../models/User.js'
import Notification, { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { validatePTAssignment } from '../services/ptScheduleValidationService.js'
import { createAssignment } from '../services/ptAssignmentService.js'

const ACTIVE_BOOKING_STATUSES = ['pending', 'awaiting_payment', 'confirmed']
const AUTO_APPROVAL_ROLLBACK_REASONS = [
  'Không thể tự xác nhận đầy đủ lịch PT 1-1',
  'Không thể hoàn tất tự xác nhận PT 1-1',
]

const normalizeDate = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const getSlotStartDateTime = (date, slot) => {
  const d = normalizeDate(date)
  const start = String(slot || '').split('-')[0].trim()
  const [hour = 0, minute = 0] = start.split(':').map(Number)
  d.setHours(hour || 0, minute || 0, 0, 0)
  return d
}

const nextRequestDate = (dayOfWeek, slot, weekOffset = 0) => {
  const now = new Date()
  const today = normalizeDate(now)
  const currentDay = today.getDay()
  let diff = Number(dayOfWeek) - currentDay
  if (diff < 0) diff += 7
  const target = new Date(today)
  // Xác định buổi đầu tiên còn ở tương lai trước, rồi mới cộng các tuần lặp.
  // Nếu cộng weekOffset trước khi kiểm tra giờ đã qua thì lịch cùng thứ trong
  // ngày tạo yêu cầu sẽ bị lặp tuần đầu và thiếu buổi cuối.
  target.setDate(today.getDate() + diff)
  if (getSlotStartDateTime(target, slot) <= now) target.setDate(target.getDate() + 7)
  target.setDate(target.getDate() + weekOffset * 7)
  return normalizeDate(target)
}

const getDocId = (value) => (value && typeof value === 'object' ? value._id : value)

const syncPt1on1RequestBookings = async ({ request, trainerId, status = 'pending' }) => {
  if (!request || request.type !== 'pt1on1' || !trainerId) return { createdCount: 0, updatedCount: 0, skippedCount: 0 }

  const memberId = getDocId(request.memberId)
  const requestId = getDocId(request._id)
  if (!memberId || !requestId) return { createdCount: 0, updatedCount: 0, skippedCount: 0 }

  // Mỗi ngày 1 khung giờ riêng (daySlots); fallback cho dữ liệu cũ (daysOfWeek + 1 slot chung)
  let daySlots = Array.isArray(request.daySlots) && request.daySlots.length
    ? request.daySlots
    : null
  if (!daySlots) {
    const days = Array.isArray(request.daysOfWeek) ? request.daysOfWeek : []
    const slots = Array.isArray(request.timeSlots) ? request.timeSlots.filter(Boolean) : []
    if (days.length && slots.length) {
      daySlots = days.map((day) => ({ day: Number(day), slot: slots[0] }))
    }
  }
  if (!daySlots || daySlots.length === 0) return { createdCount: 0, updatedCount: 0, skippedCount: 0 }

  // Số tuần lặp lại: request.weeks (mặc định 1 tuần, tối đa 12 tuần)
  const weeks = Math.min(Math.max(Number(request.weeks) || 1, 1), 12)

  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0

  // Snapshot giá buổi 1-1 từ cấu hình giá PT (backend là nguồn quyết định)
  const ptProfile = await PT.findOne({ userId: trainerId }).lean()
  const sessionPrice = ptProfile?.oneToOnePrice || 0

  for (const { day, slot } of daySlots) {
    for (let weekOffset = 0; weekOffset < weeks; weekOffset++) {
      const bookingDate = nextRequestDate(day, slot, weekOffset)

      // Gói tập của member phải còn hiệu lực tại từng ngày trong chuỗi —
      // không tạo booking ngoài phạm vi gói (PT accept chỉ kích hoạt các ngày hợp lệ)
      if (!(await hasActiveMembershipForDate(memberId, bookingDate))) {
        skippedCount += 1
        continue
      }

    const existingFromRequest = await Booking.findOne({
      memberId,
      ptId: trainerId,
      date: bookingDate,
      slot,
      requestId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
    })

    if (existingFromRequest) {
      // Booking đã xác nhận dứt điểm — không bao giờ chạm lại
      if (existingFromRequest.status === 'confirmed') {
        continue
      }
      if (existingFromRequest.status !== status) {
        // Không còn bước thanh toán: PT xác nhận → booking chuyển thẳng sang confirmed.
        existingFromRequest.status = status
        existingFromRequest.paymentStatus = status === 'confirmed' ? 'not_required' : existingFromRequest.paymentStatus
        existingFromRequest.paymentDeadline = null
        await existingFromRequest.save()
        updatedCount += 1
      }
      continue
    }

    // Lịch từ request do member chọn + admin phân công + PT xác nhận => không chặn
    // theo ca làm việc của PT (tránh mất dữ liệu âm thầm). Chỉ chặn khi trùng lịch thật.

    const conflict = await Booking.findOne({
      $or: [
        { memberId, date: bookingDate, slot, status: { $in: ACTIVE_BOOKING_STATUSES } },
        { ptId: trainerId, date: bookingDate, slot, status: { $in: ACTIVE_BOOKING_STATUSES } },
      ],
    })

    if (conflict) {
      skippedCount += 1
      continue
    }

    // Nếu lượt tự duyệt trước đã rollback sau khi tạo booking (ví dụ do lỗi
    // phân công phát sinh sau đó), dùng lại chính bản ghi bị hủy. Không tạo một
    // booking thứ hai cùng ngày/giờ rồi để PT nhìn thấy cả “Đã hủy” lẫn
    // “Đã xác nhận” cho một buổi duy nhất.
    const rolledBackBooking = await Booking.findOne({
      memberId,
      ptId: trainerId,
      date: bookingDate,
      slot,
      requestId,
      status: 'cancelled',
      cancelReason: { $in: AUTO_APPROVAL_ROLLBACK_REASONS },
    }).sort({ updatedAt: -1 })

    if (rolledBackBooking) {
      rolledBackBooking.status = status === 'confirmed' ? 'confirmed' : 'pending'
      rolledBackBooking.paymentStatus = 'not_required'
      rolledBackBooking.paymentDeadline = null
      rolledBackBooking.cancelReason = ''
      rolledBackBooking.rejectReason = ''
      rolledBackBooking.isViolation = false
      await rolledBackBooking.save()
      updatedCount += 1
      continue
    }

try {
      await Booking.create({
        memberId,
        ptId: trainerId,
        requestId,
        date: bookingDate,
        slot,
        note: request.note || '',
        trainingType: 'one_to_one',
        priceAtBooking: sessionPrice,
        totalAmount: 0,
        paymentStatus: 'not_required',
        paymentDeadline: null,
        // Không còn bước thanh toán: booking tạo ra đã confirmed ngay (nếu PT accept)
        status: status === 'confirmed' ? 'confirmed' : 'pending',
      })
      createdCount += 1
    } catch (error) {
      if (error.code === 11000) {
        skippedCount += 1
        continue
      }
      throw error
    }
    }
  }

  return { createdCount, updatedCount, skippedCount }
}

const validateRequestBeforePtAcceptance = async ({ request, trainerId }) => {
  const daySlots = Array.isArray(request.daySlots) && request.daySlots.length
    ? request.daySlots
    : (request.daysOfWeek || []).map((day) => ({ day, slot: request.timeSlots?.[0] }))
  const weeks = Math.min(Math.max(Number(request.weeks) || 1, 1), 12)
  const requestId = getDocId(request._id)

  for (const { day, slot } of daySlots) {
    for (let weekOffset = 0; weekOffset < weeks; weekOffset += 1) {
      const date = nextRequestDate(day, slot, weekOffset)
      if (!(await hasActiveMembershipForDate(getDocId(request.memberId), date))) {
        const error = new Error(`Gói tập của hội viên không còn hiệu lực tại buổi ${date.toLocaleDateString('vi-VN')} ${slot}`)
        error.statusCode = 409
        throw error
      }
      const availability = await validatePTAssignment({ trainerId, date, slot })
      if (!availability.ok) {
        const error = new Error(`PT không thể nhận lịch ${date.toLocaleDateString('vi-VN')} ${slot}: ${availability.message}`)
        error.statusCode = 409
        throw error
      }
      const conflict = await Booking.exists({
        ptId: trainerId,
        date,
        slot,
        requestId: { $ne: requestId },
        status: { $in: ACTIVE_BOOKING_STATUSES },
      })
      if (conflict) {
        const error = new Error(`PT đã có lịch trùng vào ${date.toLocaleDateString('vi-VN')} ${slot}. Vui lòng để Admin phân công PT khác.`)
        error.statusCode = 409
        throw error
      }
    }
  }
}

/**
 * Hội viên tự chọn PT: tự xác nhận khi toàn bộ lịch thực tế vẫn hợp lệ.
 * Nếu bất kỳ điều kiện nào không đạt, request được GIỮ pending để Admin
 * dùng danh sách gợi ý phân công — không tự động gán một PT khác.
 */
const tryAutoApproveSpecificPtRequest = async ({ request, trainerId }) => {
  const trainer = await User.findOne({ _id: trainerId, role: 'pt', isActive: true })
    .select('fullName name specialties')
    .lean()
  if (!trainer) return { approved: false, reason: 'PT được chọn không còn hoạt động.' }

  const requestedSpecialization = String(request.specialization || '').trim().toUpperCase()
  const trainerSpecialties = (trainer.specialties || []).map((item) => String(item || '').trim().toUpperCase())
  if (trainerSpecialties.length && !trainerSpecialties.includes(requestedSpecialization)) {
    return { approved: false, reason: 'PT được chọn không phù hợp với chuyên môn hội viên yêu cầu.' }
  }

  let bookingSync = null
  try {
    await validateRequestBeforePtAcceptance({ request, trainerId })

    const expectedBookings = (request.daySlots || []).length * Math.min(Math.max(Number(request.weeks) || 1, 1), 12)
    bookingSync = await syncPt1on1RequestBookings({ request, trainerId, status: 'confirmed' })
    if (bookingSync.createdCount + bookingSync.updatedCount < expectedBookings) {
      await trainingRequestService.cancelRequestBookings({
        requestId: request._id,
        ptId: trainerId,
        reason: 'Không thể tự xác nhận đầy đủ lịch PT 1-1',
      })
      return { approved: false, reason: 'Một số buổi đã phát sinh xung đột. Admin sẽ hỗ trợ phân công.' }
    }

    await createAssignment({ memberId: request.memberId, ptId: trainerId })
    const confirmedRequest = await trainingRequestService.updateRequestStatus({ requestId: request._id, status: 'confirmed' })
    return { approved: true, request: confirmedRequest, trainer, bookingSync }
  } catch (error) {
    if (bookingSync && (bookingSync.createdCount || bookingSync.updatedCount)) {
      await trainingRequestService.cancelRequestBookings({
        requestId: request._id,
        ptId: trainerId,
        reason: 'Không thể hoàn tất tự xác nhận PT 1-1',
      }).catch(() => {})
    }
    return { approved: false, reason: error.message || 'Không thể tự xác nhận yêu cầu.' }
  }
}

export const createRequest = async (req, res) => {
  try {
    const request = await trainingRequestService.createRequest({ memberId: req.user._id, data: req.body })
    const isPt1on1 = (req.body.type || 'group') === 'pt1on1'
    const autoApproval = isPt1on1 && request.preferredTrainerId
      ? await tryAutoApproveSpecificPtRequest({ request, trainerId: request.preferredTrainerId })
      : { approved: false, reason: '' }
    const pop = await trainingRequestService.getRequestById(request._id)

    emitPtRequestEvent(autoApproval.approved ? 'pt_request_auto_approved' : 'pt_request_created', { request: pop })
    const memberName = typeof pop.memberId === 'object' ? (pop.memberId.fullName || pop.memberId.name || '') : ''
    if (!autoApproval.approved) {
      createNotification({
        receiverId: null,
        receiverRole: 'admin',
        notificationType: NOTIFICATION_TYPES.PT_REQUEST_NEW,
        title: isPt1on1 ? 'Có yêu cầu PT 1-1 cần xử lý' : 'Có yêu cầu tập luyện nhóm mới',
        content: `Hội viên ${memberName || '—'} vừa gửi yêu cầu ${isPt1on1 ? 'PT 1-1' : 'tập luyện nhóm'}.${autoApproval.reason ? `\nKhông tự duyệt: ${autoApproval.reason}` : ''}\nVui lòng xử lý.`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: isPt1on1 ? '/admin/members?pt1on1=1&pt1on1Status=pending' : '/admin/members',
        priority: 'high',
        createdBy: 'System',
      })
    }

    // Xác nhận cho hội viên (ngôi thứ hai — "Bạn đã...")
    const memberUserId = typeof pop.memberId === 'object' ? pop.memberId._id : pop.memberId
    if (memberUserId) {
      createNotification({
        receiverId: memberUserId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PT_REQUEST_NEW,
        title: autoApproval.approved ? 'Yêu cầu PT 1-1 đã được tự xác nhận' : isPt1on1 ? 'Bạn đã gửi yêu cầu PT 1-1' : 'Bạn đã gửi yêu cầu tập luyện nhóm',
        content: autoApproval.approved
          ? `PT ${autoApproval.trainer?.fullName || autoApproval.trainer?.name || 'bạn đã chọn'} đã được phân công. Lịch PT 1-1 của bạn đã sẵn sàng trong mục Lịch tập.`
          : isPt1on1
          ? 'Bạn đã gửi yêu cầu PT 1-1 thành công. Admin sẽ xử lý yêu cầu của bạn trong thời gian sớm nhất.'
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
        title: autoApproval.approved ? 'Bạn có hội viên PT 1-1 mới' : 'Hội viên đã yêu cầu bạn làm PT riêng',
        content: autoApproval.approved
          ? `Hội viên ${memberName || '—'} đã chọn bạn làm PT riêng. Hệ thống đã tự xác nhận lịch phù hợp; không cần phản hồi thêm.`
          : `Hội viên ${memberName || '—'} đã chỉ định bạn làm PT riêng. Yêu cầu đang chờ Admin xử lý.`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/pt/clients',
        createdBy: 'System',
      })
    }

    recordAuditLog({
      req,
      module: 'training_request',
      action: autoApproval.approved ? 'auto_approve_specific_pt' : 'create_request',
      entity: pop,
      entityName: `Request ${request._id}`,
      details: autoApproval.approved
        ? `Tự xác nhận PT ${request.preferredTrainerId}; bookings: ${JSON.stringify(autoApproval.bookingSync)}`
        : `Yêu cầu chờ Admin xử lý${autoApproval.reason ? `: ${autoApproval.reason}` : ''}`,
    }).catch((error) => console.error('Audit create training request failed:', error.message))

    res.status(201).json({
      message: autoApproval.approved
        ? 'Đã tự xác nhận PT và tạo lịch PT 1-1 thành công.'
        : 'Đã gửi yêu cầu. Admin sẽ xem các PT phù hợp và phân công cho bạn.',
      request: pop,
      autoApproved: autoApproval.approved,
    })
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

    // Member chỉ xem được yêu cầu của chính mình (chống IDOR); staff/PT/admin xem được tất cả
    if (req.user?.role === 'member') {
      const ownerId = String(request.memberId?._id || request.memberId || '')
      if (ownerId !== String(req.user._id)) {
        return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })
      }
    }

    res.json({ request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Gợi ý PT cho modal Phân công PT (đã sort thông minh + kèm xung đột lịch)
export const getPtSuggestions = async (req, res) => {
  try {
    const suggestions = await trainingRequestService.getPtSuggestions({ requestId: req.params.id })
    if (!suggestions) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })
    res.json({ suggestions })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message })
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

    const bookingSync = await syncPt1on1RequestBookings({
      request,
      trainerId: req.body.trainerId,
      status: 'pending',
    })

    recordAuditLog({
      req,
      module: 'training_request',
      action: 'assign_trainer',
      entity: request,
      entityName: `Request ${request._id}`,
      details: `Phân công PT ${req.body.trainerId} cho member ${request.memberId} - bookingSync: ${JSON.stringify(bookingSync)}`,
    }).catch((err) => console.error('Audit assignTrainer failed:', err.message))

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

    // Thông báo member: PT đã được phân công, chờ PT xác nhận
    const memberUserId = getDocId(pop.memberId)
    if (memberUserId) {
      createNotification({
        receiverId: memberUserId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PT_REQUEST_ASSIGNED,
        title: 'Đã phân công PT cho bạn',
        content: trainerName
          ? `PT ${trainerName} đã được phân công phụ trách bạn.\nPT sẽ xác nhận lịch trong thời gian sớm nhất.`
          : 'PT đã được phân công phụ trách bạn.\nPT sẽ xác nhận lịch trong thời gian sớm nhất.',
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/booking',
        createdBy: 'System',
      })
    }

    res.json({ message: 'Đã phân công PT thành công', request: pop, bookingSync })
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

    if (action === 'accept') {
      await validateRequestBeforePtAcceptance({ request, trainerId })
    }

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
      recordAuditLog({
        req,
        module: 'training_request',
        action: 'pt_accept_assignment',
        entity: request,
        entityName: `Request ${request._id}`,
        details: `PT ${trainerId} chấp nhận phụ trách member ${memberUserId}`,
      }).catch((err) => console.error('Audit pt accept failed:', err.message))

const bookingSync = await syncPt1on1RequestBookings({
        request,
        trainerId,
        status: 'confirmed',
      })

      // Không còn bước thanh toán: kích hoạt ngay quan hệ PT ↔ Member khi PT accept
      const { createAssignment } = await import('../services/ptAssignmentService.js')
      await createAssignment({ memberId: memberUserId, ptId: trainerId })
      await trainingRequestService.updateRequestStatus({ requestId: request._id, status: 'confirmed' })

      // Realtime: cập nhật ngay lịch làm việc của PT (booking 1-1 mới xuất hiện)
      const popRequest = await trainingRequestService.getRequestById(request._id)
      emitPtRequestEvent('pt_request_updated', { request: popRequest })

      // Realtime: yêu cầu trang "Học viên của tôi" của PT tải lại ngay (counter 0 → 1)
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
        content: bookingSync.createdCount + bookingSync.updatedCount > 0
          ? `PT ${trainerName} đã xác nhận phụ trách bạn.\nLịch PT 1-1 của bạn đã được cập nhật trong mục Lịch tập.`
          : `PT ${trainerName} đã xác nhận phụ trách bạn.\nPT sẽ chủ động liên hệ với bạn qua SĐT hoặc Email.`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/workout',
        createdBy: 'System',
      })
    } else {
      // Rút phân công → yêu cầu về chờ phân công để admin chọn PT khác
      // Hủy mọi booking của PT này (kể cả confirmed đã thanh toán — hoàn tiền nếu trước 24h)
      await trainingRequestService.cancelRequestBookings({
        requestId: request._id,
        ptId: trainerId,
        reason: reason || 'PT từ chối nhận hội viên',
      })

      recordAuditLog({
        req,
        module: 'training_request',
        action: 'pt_reject_assignment',
        entity: request,
        entityName: `Request ${request._id}`,
        details: `PT ${trainerId} từ chối phụ trách member ${memberUserId}${reason ? ` - Lý do: ${reason}` : ''}`,
      }).catch((err) => console.error('Audit pt reject failed:', err.message))
      const updated = await trainingRequestService.unassignTrainer({ requestId: request._id, rejectedPtId: trainerId, reason: reason || 'PT từ chối nhận hội viên' })
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
    const request = await trainingRequestService.cancelRequest({ requestId: req.params.id, memberId: req.user._id, reason: req.body.reason || '' })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    // Hủy mọi booking của yêu cầu (kể cả confirmed đã thanh toán — hoàn tiền nếu hủy trước 24h)
    // để không còn booking chặn slot PT sau khi member hủy lịch.
    const cancelResult = await trainingRequestService.cancelRequestBookings({
      requestId: request._id,
      reason: req.body.reason || 'Member cancelled request',
    })

    recordAuditLog({
      req,
      module: 'training_request',
      action: 'member_cancel_request',
      entity: request,
      entityName: `Request ${request._id}`,
      details: req.body.reason || 'Member cancelled request while processing',
    }).catch((err) => console.error('Audit member cancel failed:', err.message))

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

/**
 * Admin/staff hủy yêu cầu PT 1-1 hoặc nhóm kèm lý do.
 * - Hủy các booking pending/awaiting_payment (nếu đã phân công PT).
 * - Vô hiệu hóa nút phản hồi của PT (requiresAction = false).
 * - Thông báo member + PT (nếu có).
 */
export const cancelRequestByAdmin = async (req, res) => {
  try {
    const reason = (req.body.reason || '').trim()
    if (!reason) {
      return res.status(400).json({ message: 'Vui lòng nhập lý do hủy yêu cầu' })
    }

    const request = await trainingRequestService.adminCancelRequest({
      requestId: req.params.id,
      reason,
      adminId: req.user._id,
    })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    const pop = await trainingRequestService.getRequestById(request._id)
    emitPtRequestEvent('pt_request_cancelled', { request: pop })

    const memberId = typeof pop.memberId === 'object' ? pop.memberId._id : pop.memberId
    const memberName = typeof pop.memberId === 'object' ? (pop.memberId.fullName || pop.memberId.name || '') : ''
    const adminName = req.user.fullName || req.user.name || 'Admin'
    const isPt1on1 = pop.type === 'pt1on1'
    const trainerId = typeof pop.assignedTrainerId === 'object' ? pop.assignedTrainerId?._id : pop.assignedTrainerId

    // PT 1-1 đã phân công: hủy mọi booking (kể cả confirmed đã thanh toán — hoàn tiền nếu trước 24h)
    // + vô hiệu hóa phản hồi của PT
    if (isPt1on1 && trainerId) {
      await trainingRequestService.cancelRequestBookings({
        requestId: request._id,
        ptId: trainerId,
        reason: reason || 'Hủy bởi Admin',
      })

      const ptNotifs = await Notification.find({
        receiverId: trainerId,
        notificationType: NOTIFICATION_TYPES.MEMBER_ASSIGNED,
        relatedId: request._id,
        deletedAt: null,
      })
      for (const notif of ptNotifs) {
        notif.requiresAction = false
        notif.actionStatus = 'cancelled'
        notif.actionAt = new Date()
        notif.isRead = true
        notif.readAt = new Date()
        notif.content = `Yêu cầu của hội viên ${memberName || '—'} đã bị hủy bởi Admin. Không cần phản hồi.`
        await notif.save()
        emitNotificationUpdated({ userId: trainerId, notification: notif.toObject() })
      }

      createNotification({
        receiverId: trainerId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.PT_REQUEST_CANCELLED,
        title: 'Yêu cầu đã bị hủy bởi Admin',
        content: `Hội viên ${memberName || '—'} đã được hủy yêu cầu PT 1-1. Bạn không cần phản hồi.`,
        relatedId: request._id,
        relatedType: 'TrainingRequest',
        redirectUrl: '/pt/clients',
        createdBy: 'System',
      })
    }

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PT_REQUEST_CANCELLED,
      title: 'Yêu cầu đã bị hủy',
      content: `Yêu cầu ${isPt1on1 ? 'PT 1-1' : 'tập luyện nhóm'} của bạn đã bị hủy bởi ${adminName}.${reason ? `\nLý do: ${reason}` : ''}`,
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/booking',
      createdBy: 'System',
    })

    res.json({ message: 'Đã hủy yêu cầu', request: pop })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message })
  }
}
