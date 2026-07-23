import * as trainingRequestService from '../services/trainingRequestService.js'
import { getIO } from '../services/socketService.js'
import Notification from '../models/Notification.js'

export const createRequest = async (req, res) => {
  try {
    const request = await trainingRequestService.createRequest({ memberId: req.user._id, data: req.body })
    const pop = await trainingRequestService.getRequestById(request._id)

    if (req.body.type === 'pt1on1') {
      const io = getIO()
      if (io) {
        io.to('staff').emit('pt1on1:new_request', { request: pop })
      }
    }

    res.status(201).json({ message: 'Đã gửi yêu cầu tập luyện', request: pop })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMyRequests = async (req, res) => {
  try {
    const type = req.query.type || undefined
    const requests = await trainingRequestService.getMyRequests({ memberId: req.user._id, type, status: req.query.status })
    res.json({ requests })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllRequests = async (req, res) => {
  try {
    const type = req.query.type || undefined
    const result = await trainingRequestService.getAllRequests({ type, status: req.query.status, page: req.query.page })
    res.json(result)
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
    res.json({ message: 'Đã xếp lớp thành công', request })
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
    const io = getIO()
    if (io) {
      io.to('staff').emit('pt1on1:status_changed', { request: pop })
      const memberId = typeof pop.memberId === 'object' ? pop.memberId._id : pop.memberId
      if (memberId) {
        io.to(memberId.toString()).emit('pt1on1:status_changed', { request: pop })
      }
      if (pop.assignedTrainerId) {
        const trainerId = typeof pop.assignedTrainerId === 'object' ? pop.assignedTrainerId._id : pop.assignedTrainerId
        io.to(trainerId.toString()).emit('pt1on1:status_changed', { request: pop })
      }
    }

    res.json({ message: 'Đã phân công PT thành công', request: pop })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message })
  }
}

export const cancelByAdmin = async (req, res) => {
  try {
    const request = await trainingRequestService.cancelRequest({ requestId: req.params.id, reason: req.body.reason || '' })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    const pop = await trainingRequestService.getRequestById(request._id)
    const io = getIO()
    if (io) {
      io.to('staff').emit('pt1on1:status_changed', { request: pop })
      const memberId = typeof pop.memberId === 'object' ? pop.memberId._id : pop.memberId
      if (memberId) {
        io.to(memberId.toString()).emit('pt1on1:status_changed', { request: pop })
      }
    }

    // Notify member
    const memberName = typeof pop.memberId === 'object' ? (pop.memberId.fullName || pop.memberId.name || '') : ''
    const { createNotification } = await import('../services/notificationService.js')
    const { NOTIFICATION_TYPES } = await import('../models/Notification.js')
    const memberId = typeof pop.memberId === 'object' ? pop.memberId._id : pop.memberId
    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.BOOKING_REJECTED,
      title: 'Yêu cầu PT 1-1 đã bị hủy',
      content: `Yêu cầu PT 1-1 của bạn đã bị hủy.\nLý do: ${req.body.reason || 'Không có lý do'}`,
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/booking',
      createdBy: 'Admin',
    })

    res.json({ message: 'Đã hủy yêu cầu', request: pop })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const cancelMyRequest = async (req, res) => {
  try {
    const request = await trainingRequestService.cancelRequest({ requestId: req.params.id, reason: req.body.reason || '' })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })

    const io = getIO()
    if (io && request.type === 'pt1on1') {
      const pop = await trainingRequestService.getRequestById(request._id)
      io.to('staff').emit('pt1on1:status_changed', { request: pop })
    }

    res.json({ message: 'Đã hủy yêu cầu', request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
