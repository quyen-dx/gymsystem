import PersonalTrainingRequest from '../models/PersonalTrainingRequest.js'
import User from '../models/User.js'
import { createNotification } from '../services/notificationService.js'
import {
  emitPersonalTrainingCountUpdate,
  emitPersonalTrainingNewRequest,
  emitNotificationToUser,
} from '../services/socketService.js'

export const createRequest = async (req, res) => {
  try {
    const {
      specialization, goals, phone, email,
      hasPTPreference, preferredPTId, notes,
    } = req.body

    if (!specialization) return res.status(400).json({ message: 'Chuyên môn là bắt buộc' })
    if (!phone) return res.status(400).json({ message: 'Số điện thoại là bắt buộc' })
    if (!email) return res.status(400).json({ message: 'Email là bắt buộc' })

    const request = await PersonalTrainingRequest.create({
      memberId: req.user._id,
      specialization,
      goals: goals || [],
      phone,
      email,
      hasPTPreference: hasPTPreference || false,
      preferredPTId: hasPTPreference ? preferredPTId || null : null,
      notes: notes || '',
      status: 'pending',
    })

    const populated = await PersonalTrainingRequest.findById(request._id)
      .populate('memberId', 'name fullName phone email avatar memberCode')

    emitPersonalTrainingNewRequest(populated)
    emitPersonalTrainingCountUpdate()

    res.status(201).json({ message: 'Đã gửi yêu cầu PT riêng thành công', request: populated })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({ message: messages.join(', ') })
    }
    res.status(500).json({ message: error.message })
  }
}

export const getMyRequests = async (req, res) => {
  try {
    const filter = { memberId: req.user._id }
    if (req.query.status) filter.status = req.query.status

    const requests = await PersonalTrainingRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate('preferredPTId', 'name fullName')
      .populate('assignedTrainerId', 'name fullName')

    res.json({ requests })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const cancelMyRequest = async (req, res) => {
  try {
    const request = await PersonalTrainingRequest.findOne({
      _id: req.params.id,
      memberId: req.user._id,
      status: 'pending',
    })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    request.status = 'cancelled'
    request.cancelledAt = new Date()
    request.cancelReason = req.body.reason || ''
    await request.save()

    emitPersonalTrainingCountUpdate()

    res.json({ message: 'Đã hủy yêu cầu', request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getRequestById = async (req, res) => {
  try {
    const request = await PersonalTrainingRequest.findById(req.params.id)
      .populate('memberId', 'name fullName phone email avatar memberCode')
      .populate('preferredPTId', 'name fullName')
      .populate('assignedTrainerId', 'name fullName')
      .populate('assignedBy', 'name fullName')
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })
    res.json({ request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query
    const filter = {}
    if (status) filter.status = status

    const total = await PersonalTrainingRequest.countDocuments(filter)
    const requests = await PersonalTrainingRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .populate('memberId', 'name fullName phone email avatar memberCode')
      .populate('preferredPTId', 'name fullName')
      .populate('assignedTrainerId', 'name fullName')

    res.json({
      requests,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const assignPT = async (req, res) => {
  try {
    const { trainerId } = req.body
    if (!trainerId) return res.status(400).json({ message: 'Vui lòng chọn PT phụ trách' })

    const request = await PersonalTrainingRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Yêu cầu này đã được xử lý' })

    request.status = 'assigned'
    request.assignedTrainerId = trainerId
    request.assignedAt = new Date()
    request.assignedBy = req.user._id
    await request.save()

    const populated = await PersonalTrainingRequest.findById(request._id)
      .populate('memberId', 'name fullName phone email avatar memberCode')
      .populate('assignedTrainerId', 'name fullName email phone')
      .populate('assignedBy', 'name fullName')

    const member = populated.memberId
    const trainer = populated.assignedTrainerId
    const memberName = member?.fullName || member?.name || 'Hội viên'
    const trainerName = trainer?.fullName || trainer?.name || 'PT'

    const ptNotif = await createNotification({
      receiverId: trainerId,
      receiverRole: 'pt',
      notificationType: 'PT_ASSIGNED',
      title: 'Phân công hội viên mới',
      content: `Bạn vừa được phân công hội viên ${memberName}.`,
      relatedId: request._id,
      relatedType: 'PersonalTrainingRequest',
      redirectUrl: `/pt`,
      createdBy: 'System',
      sendEmail: false,
    })
    emitNotificationToUser({ userId: trainerId, notification: ptNotif })

    const memberNotif = await createNotification({
      receiverId: request.memberId,
      receiverRole: 'member',
      notificationType: 'PT_ASSIGNED',
      title: 'Bạn đã được phân công PT',
      content: `Bạn đã được phân công PT ${trainerName}. PT sẽ chủ động liên hệ với bạn qua SĐT hoặc Email.`,
      relatedId: request._id,
      relatedType: 'PersonalTrainingRequest',
      redirectUrl: `/booking`,
      createdBy: 'System',
      sendEmail: false,
    })
    emitNotificationToUser({ userId: request.memberId, notification: memberNotif })

    emitPersonalTrainingCountUpdate()

    res.json({ message: 'Đã phân công PT thành công', request: populated })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const cancelByAdmin = async (req, res) => {
  try {
    const request = await PersonalTrainingRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Yêu cầu này đã được xử lý' })

    request.status = 'cancelled'
    request.cancelledAt = new Date()
    request.cancelReason = req.body.reason || 'Bị hủy bởi Admin'
    await request.save()

    const populated = await PersonalTrainingRequest.findById(request._id)
      .populate('memberId', 'name fullName')

    const member = populated.memberId
    const memberName = member?.fullName || member?.name || 'Hội viên'

    const notif = await createNotification({
      receiverId: request.memberId,
      receiverRole: 'member',
      notificationType: 'PT_REQUEST_CANCELLED',
      title: 'Yêu cầu PT 1-1 đã bị hủy',
      content: `Yêu cầu PT 1-1 của bạn đã bị hủy bởi Admin.`,
      relatedId: request._id,
      relatedType: 'PersonalTrainingRequest',
      redirectUrl: `/booking`,
      createdBy: 'System',
      sendEmail: false,
    })
    emitNotificationToUser({ userId: request.memberId, notification: notif })

    emitPersonalTrainingCountUpdate()

    res.json({ message: 'Đã hủy yêu cầu', request: populated })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
