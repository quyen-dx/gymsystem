import RefundRequest from '../models/RefundRequest.js'
import {
  createRefundRequest,
  approveRefundRequest,
  rejectRefundRequest,
  listRefundRequests,
} from '../services/refundRequestService.js'

const sendServiceError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message })
  }
  return next(error)
}

export const createRefundRequestHandler = async (req, res, next) => {
  try {
    const { periodId, reason } = req.body
    if (!periodId) {
      return res.status(400).json({ message: 'periodId là bắt buộc.' })
    }
    const result = await createRefundRequest({
      userId: req.user._id,
      periodId,
      reason,
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const countPendingRefundRequestsHandler = async (req, res, next) => {
  try {
    const count = await RefundRequest.countDocuments({ status: 'PENDING' })
    return res.json({ count })
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const listRefundRequestsHandler = async (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query
    const result = await listRefundRequests({ page, limit, status, search })
    return res.json(result)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const approveRefundRequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params
    const { staffNote } = req.body
    const result = await approveRefundRequest({
      refundRequestId: id,
      staffId: req.user._id,
      staffNote,
    })
    return res.json(result)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const rejectRefundRequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const result = await rejectRefundRequest({
      refundRequestId: id,
      staffId: req.user._id,
      reason,
    })
    return res.json(result)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}
