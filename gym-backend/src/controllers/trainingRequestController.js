import * as trainingRequestService from '../services/trainingRequestService.js'

export const createRequest = async (req, res) => {
  try {
    const request = await trainingRequestService.createRequest({ memberId: req.user._id, data: req.body })
    res.status(201).json({ message: 'Đã gửi yêu cầu tập luyện', request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMyRequests = async (req, res) => {
  try {
    const requests = await trainingRequestService.getMyRequests({ memberId: req.user._id, status: req.query.status })
    res.json({ requests })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllRequests = async (req, res) => {
  try {
    const result = await trainingRequestService.getAllRequests({ status: req.query.status, page: req.query.page })
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

export const cancelMyRequest = async (req, res) => {
  try {
    const request = await trainingRequestService.cancelRequest({ requestId: req.params.id, reason: req.body.reason || '' })
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' })
    res.json({ message: 'Đã hủy yêu cầu', request })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
