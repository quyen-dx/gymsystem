import * as service from '../services/shiftChangeService.js'
import { emitShiftChangeCountUpdate, emitShiftChangeNewRequest } from '../services/socketService.js'
import User from '../models/User.js'
import sendError from '../utils/sendError.js'

export const createRequest = async (req, res) => {
  try {
    const { targetDate, reason, classIds } = req.body
    if (!targetDate) return res.status(400).json({ message: 'Vui lòng chọn ngày' })
    if (!classIds || !Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 ca cần thay' })
    }

    const result = await service.createShiftChangeRequest({
      ptId: req.user._id,
      targetDate,
      reason,
      classIds,
    })

    const pt = await User.findById(req.user._id).select('name fullName').lean()
    emitShiftChangeNewRequest({
      requestId: result._id,
      requestingPtName: pt?.fullName || pt?.name || 'PT',
      targetDate,
    })
    emitShiftChangeCountUpdate()

    res.status(201).json({ request: result })
  } catch (error) {
    sendError(res, error)
  }
}

export const getAllRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query
    const result = await service.getAllShiftChangeRequests({ page, limit, status })
    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
}

export const getRequestDetail = async (req, res) => {
  try {
    const result = await service.getShiftChangeRequestDetail(req.params.id)
    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
}

export const getMyRequests = async (req, res) => {
  try {
    const { status } = req.query
    const docs = await service.getMyShiftChangeRequests({ ptId: req.user._id, status })
    res.json({ requests: docs })
  } catch (error) {
    sendError(res, error)
  }
}

export const getMyAssignments = async (req, res) => {
  try {
    const { status } = req.query
    const docs = await service.getMyReplacementAssignments({ ptId: req.user._id, status })
    res.json({ assignments: docs })
  } catch (error) {
    sendError(res, error)
  }
}

export const getMyReplacements = async (req, res) => {
  try {
    const { weekStart } = req.query
    const replacements = await service.getActiveReplacementsForPT({ ptId: req.user._id, weekStart })
    res.json({ replacements })
  } catch (error) {
    sendError(res, error)
  }
}

export const getAvailablePTs = async (req, res) => {
  try {
    const { itemId } = req.query
    if (!itemId) return res.status(400).json({ message: 'Thiếu itemId' })
    const result = await service.getAvailableReplacementPTs({ requestId: req.params.id, itemId })
    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
}

export const assignPTs = async (req, res) => {
  try {
    const { assignments } = req.body
    const result = await service.assignReplacementPTs({
      requestId: req.params.id,
      handledBy: req.user._id,
      assignments,
    })
    emitShiftChangeCountUpdate()
    res.json({ message: 'Đã gán PT thay thế', result })
  } catch (error) {
    sendError(res, error)
  }
}

export const rejectRequest = async (req, res) => {
  try {
    const { reason } = req.body
    const result = await service.rejectShiftChangeRequest({
      requestId: req.params.id,
      handledBy: req.user._id,
      reason,
    })
    emitShiftChangeCountUpdate()
    res.json({ message: 'Đã từ chối yêu cầu thay ca', request: result })
  } catch (error) {
    sendError(res, error)
  }
}

export const cancelRequest = async (req, res) => {
  try {
    const result = await service.cancelShiftChangeRequest({
      requestId: req.params.id,
      ptId: req.user._id,
    })
    emitShiftChangeCountUpdate()
    res.json({ message: 'Đã hủy yêu cầu thay ca', request: result })
  } catch (error) {
    sendError(res, error)
  }
}

export const respondItem = async (req, res) => {
  try {
    const { itemId, action, reason, notificationId } = req.body
    if (!itemId) return res.status(400).json({ message: 'Thiếu itemId' })
    const result = await service.respondShiftChangeItem({
      itemId,
      ptId: req.user._id,
      action,
      reason,
      notificationId,
    })
    res.json({ message: action === 'accept' ? 'Đã chấp nhận nhận thay ca' : 'Đã từ chối nhận ca', result })
  } catch (error) {
    sendError(res, error)
  }
}
