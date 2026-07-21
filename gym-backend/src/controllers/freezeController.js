import catchAsync from '../utils/catchAsync.js'
import { sendSuccess, sendPaginated } from '../utils/responseHelper.js'
import {
  createFreezeRequest,
  getMyFreezes,
  listFreezes,
  approveFreeze,
  rejectFreeze,
} from '../services/freezeService.js'

export const createFreeze = catchAsync(async (req, res) => {
  const freeze = await createFreezeRequest(req.user._id, req.body)
  sendSuccess(res, { freeze }, 201)
})

export const getMyFreezeList = catchAsync(async (req, res) => {
  const result = await getMyFreezes(req.user._id, req.query)
  sendPaginated(res, result.freezes, result.pagination)
})

export const getFreezeList = catchAsync(async (req, res) => {
  const result = await listFreezes(req.query)
  sendPaginated(res, result.freezes, result.pagination)
})

export const approveFreezeRequest = catchAsync(async (req, res) => {
  const freeze = await approveFreeze(req.params.id, req.user._id)
  sendSuccess(res, { freeze, message: 'Đã duyệt yêu cầu tạm ngưng' })
})

export const rejectFreezeRequest = catchAsync(async (req, res) => {
  const freeze = await rejectFreeze(req.params.id, req.user._id)
  sendSuccess(res, { freeze, message: 'Đã từ chối yêu cầu tạm ngưng' })
})
