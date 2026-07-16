import * as trainerReplacementService from '../services/trainerReplacementService.js'

export const createRequest = async (req, res) => {
  try {
    const { scheduleId, date, reason } = req.body
    if (!scheduleId || !date || !reason) {
      return res.status(400).json({ message: 'Thiếu thông tin' })
    }
    const request = await trainerReplacementService.createReplacementRequest({
      scheduleId, originalTrainerId: req.user._id, date, reason,
    })
    res.status(201).json({ message: 'Đã gửi yêu cầu thay ca', request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMyRequests = async (req, res) => {
  try {
    const requests = await trainerReplacementService.getMyRequests({ trainerId: req.user._id, status: req.query.status })
    res.json({ requests })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllPendingRequests = async (req, res) => {
  try {
    const result = await trainerReplacementService.getAllPendingRequests({ page: req.query.page })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const approveRequest = async (req, res) => {
  try {
    const { replacementTrainerId } = req.body
    if (!replacementTrainerId) return res.status(400).json({ message: 'Thiếu PT thay thế' })
    const request = await trainerReplacementService.approveRequest({
      requestId: req.params.id, replacementTrainerId, handledBy: req.user._id,
    })
    res.json({ message: 'Đã phê duyệt thay ca', request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const rejectRequest = async (req, res) => {
  try {
    const request = await trainerReplacementService.rejectRequest({
      requestId: req.params.id, handledBy: req.user._id, reason: req.body.reason || '',
    })
    res.json({ message: 'Đã từ chối yêu cầu thay ca', request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
