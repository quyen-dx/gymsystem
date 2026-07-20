import catchAsync from '../utils/catchAsync.js'
import { sendSuccess } from '../utils/responseHelper.js'
import {
  getMyProfile,
  updateMyProfile,
  uploadUserAvatar,
  changeUserPassword,
} from '../services/userService.js'

export const getMe = catchAsync(async (req, res) => {
  const result = await getMyProfile(req.user._id)
  sendSuccess(res, { user: result.user, hasPassword: result.hasPassword })
})

export const updateMe = catchAsync(async (req, res) => {
  const result = await updateMyProfile(req.user._id, req.body)
  sendSuccess(res, { user: result.user, message: 'Cập nhật thông tin thành công' })
})

export const uploadAvatar = catchAsync(async (req, res) => {
  const result = await uploadUserAvatar(req.user._id, req.file)
  sendSuccess(res, { user: result.user, message: 'Tải ảnh đại diện thành công' })
})

export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  await changeUserPassword(req.user._id, currentPassword, newPassword)
  sendSuccess(res, { message: 'Đổi mật khẩu thành công' })
})
