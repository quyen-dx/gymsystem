import catchAsync from '../utils/catchAsync.js'
import { sendSuccess, sendPaginated } from '../utils/responseHelper.js'
import {
  getUserById,
  getUsers,
  adminUpdateUser,
  changeUserRole,
  activateUserAccount,
  deactivateUserAccount,
  softDeleteUser,
  restoreUser,
} from '../services/userService.js'

export const getUsersList = catchAsync(async (req, res) => {
  const result = await getUsers(req.query)
  sendPaginated(res, result.users, result.pagination)
})

export const getSingleUser = catchAsync(async (req, res) => {
  const result = await getUserById(req.params.id, req.user.role)
  sendSuccess(res, { user: result.user })
})

export const updateUser = catchAsync(async (req, res) => {
  const result = await adminUpdateUser(req.params.id, req.body, req.user._id, req.user.role)
  sendSuccess(res, { user: result.user, message: 'Cập nhật người dùng thành công' })
})

export const updateRole = catchAsync(async (req, res) => {
  await changeUserRole(req.params.id, req.body.role, req.user._id)
  sendSuccess(res, { message: 'Cập nhật vai trò thành công' })
})

export const activateUser = catchAsync(async (req, res) => {
  await activateUserAccount(req.params.id, req.user._id)
  sendSuccess(res, { message: 'Kích hoạt người dùng thành công' })
})

export const deactivateUser = catchAsync(async (req, res) => {
  await deactivateUserAccount(req.params.id, req.user._id, req.user.role)
  sendSuccess(res, { message: 'Vô hiệu hóa người dùng thành công' })
})

export const deleteUser = catchAsync(async (req, res) => {
  await softDeleteUser(req.params.id, req.user._id, req.user.role)
  sendSuccess(res, { message: 'Xóa người dùng thành công' })
})

export const restoreDeletedUser = catchAsync(async (req, res) => {
  await restoreUser(req.params.id, req.user._id)
  sendSuccess(res, { message: 'Khôi phục người dùng thành công' })
})
