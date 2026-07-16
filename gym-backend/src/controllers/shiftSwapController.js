import * as service from '../services/shiftSwapService.js'
import { emitShiftSwapCountUpdate, emitShiftSwapNewRequest } from '../services/socketService.js'
import sendError from '../utils/sendError.js'

export const createRequest = async (req, res) => {
  try {
    const { targetDate, reason, classIds } = req.body
    if (!targetDate) return res.status(400).json({ message: 'Vui lòng chọn ngày' })
    if (!classIds || !Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 ca cần đổi' })
    }

    const result = await service.createSwapRequest({
      ptId: req.user._id,
      targetDate,
      reason,
      classIds,
    })

    // Emit socket events asynchronously (don't block response)
    const User = (await import('../models/User.js')).default
    const pt = await User.findById(req.user._id).select('name fullName').lean()
    emitShiftSwapNewRequest({
      requestId: result._id,
      requestingPtName: pt?.fullName || pt?.name || 'PT',
      targetDate,
    })
    emitShiftSwapCountUpdate()

    res.status(201).json({ request: result })
  } catch (error) {
    sendError(res, error)
  }
}

export const approveRequest = async (req, res) => {
  try {
    const { assignments } = req.body
    if (!assignments || !Array.isArray(assignments) || !assignments.length) {
      return res.status(400).json({ message: 'Vui lòng chọn PT thay thế cho ít nhất 1 buổi' })
    }
    const result = await service.approveSwapRequest({
      id: req.params.id,
      approvedBy: req.user._id,
      assignments,
    })

    emitShiftSwapCountUpdate()

    res.json({ message: 'Đã duyệt yêu cầu thay ca', result })
  } catch (error) {
    sendError(res, error)
  }
}

export const rejectRequest = async (req, res) => {
  try {
    const { reason } = req.body
    const result = await service.rejectSwapRequest({
      id: req.params.id,
      approvedBy: req.user._id,
      reason,
    })

    emitShiftSwapCountUpdate()

    res.json({ message: 'Đã từ chối yêu cầu thay ca', request: result })
  } catch (error) {
    sendError(res, error)
  }
}

export const getMyRequests = async (req, res) => {
  try {
    const { status } = req.query
    const docs = await service.getMySwapRequests({ ptId: req.user._id, status })
    res.json({ requests: docs })
  } catch (error) {
    sendError(res, error)
  }
}

export const getAllRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query
    const result = await service.getAllSwapRequests({ page, limit, status })
    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
}

export const getRequestDetail = async (req, res) => {
  try {
    const result = await service.getSwapRequestDetail(req.params.id)
    const availablePTs = await service.getAvailableSubstitutePTs({ swapRequestId: req.params.id })
    res.json({ ...result, availablePTs })
  } catch (error) {
    sendError(res, error)
  }
}
