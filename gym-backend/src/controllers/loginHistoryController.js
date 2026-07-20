import catchAsync from '../utils/catchAsync.js'
import { sendSuccess, sendPaginated } from '../utils/responseHelper.js'
import {
  getLoginHistory,
  getActiveSessions,
  revokeDevice,
  revokeAllSessions,
  unlockAccount,
} from '../services/loginHistoryService.js'

export const getHistory = catchAsync(async (req, res) => {
  const result = await getLoginHistory(req.user._id, req.query)
  sendPaginated(res, result.entries, result.pagination)
})

export const getSessions = catchAsync(async (req, res) => {
  const result = await getActiveSessions(req.user._id)
  sendSuccess(res, result)
})

export const revokeDeviceHandler = catchAsync(async (req, res) => {
  await revokeDevice(req.params.id, req.user._id)
  sendSuccess(res, { message: 'Đã hủy phiên đăng nhập' })
})

export const revokeAllHandler = catchAsync(async (req, res) => {
  const result = await revokeAllSessions(req.user._id)
  sendSuccess(res, { message: 'Đã hủy tất cả phiên đăng nhập' })
})

export const unlockHandler = catchAsync(async (req, res) => {
  await unlockAccount(req.body.userId, req.user._id)
  sendSuccess(res, { message: 'Đã mở khóa tài khoản' })
})
