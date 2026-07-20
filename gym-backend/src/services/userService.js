import bcrypt from 'bcrypt'
import User from '../models/User.js'
import AppError from '../utils/appError.js'
import logger from '../config/logger.js'
import { normalizeUserMemberIdentity } from '../utils/memberIdentity.js'

const USER_SELECT_PUBLIC = '-password -passwordHash -refreshToken'

const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

const validatePasswordStrength = (password) => {
  if (!passwordStrengthRegex.test(password)) {
    throw new AppError(
      'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số',
      400,
    )
  }
}

const sanitizeUser = (user) => {
  if (!user) return null
  const obj = normalizeUserMemberIdentity(user.toObject ? user.toObject() : user)
  delete obj.password
  delete obj.passwordHash
  delete obj.refreshToken
  return obj
}

export const getMyProfile = async (userId) => {
  const user = await User.findById(userId).select('+password').lean()
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  const profile = sanitizeUser(user)

  if (!['super_admin', 'admin'].includes(user.role) && profile.identityNumber) {
    const num = profile.identityNumber
    profile.identityNumber = num.length > 4 ? '*'.repeat(num.length - 4) + num.slice(-4) : '****'
    delete profile.identityFrontImage
    delete profile.identityBackImage
  }

  return { user: profile, hasPassword: !!user.password }
}

export const updateMyProfile = async (userId, data) => {
  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  const allowedFields = [
    'name',
    'fullName',
    'phone',
    'dateOfBirth',
    'gender',
    'nationality',
    'language',
    'timezone',
    'country',
    'province',
    'detailedAddress',
    'bio',
    'themePreference',
    'accentColor',
    'preferredTime',
    'address',
    'emergencyContact',
    'healthInfo',
  ]

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      user[field] = data[field]
    }
  }

  await user.save({ validateBeforeSave: false })

  logger.info('Profile updated', { userId: user._id.toString() })

  const refreshed = await User.findById(user._id).lean()
  return { user: sanitizeUser(refreshed) }
}

export const uploadUserAvatar = async (userId, file) => {
  if (!file) {
    throw new AppError('Không có file nào được tải lên', 400)
  }

  const avatarUrl = file.path || file.secure_url
  if (!avatarUrl) {
    throw new AppError('Không thể lấy URL của ảnh đã tải lên', 500)
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { avatar: avatarUrl },
    { new: true, runValidators: false },
  ).lean()

  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  logger.info('Avatar uploaded', { userId, avatarUrl })

  return { user: sanitizeUser(user), avatarUrl }
}

export const changeUserPassword = async (userId, currentPassword, newPassword) => {
  validatePasswordStrength(newPassword)

  const user = await User.findById(userId).select('+password +passwordHash')
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (!user.password && !user.passwordHash) {
    throw new AppError('Tài khoản chưa có mật khẩu, hãy dùng chức năng đặt mật khẩu', 400)
  }

  const isMatch = await user.comparePassword(currentPassword)
  if (!isMatch) {
    throw new AppError('Mật khẩu hiện tại không đúng', 400)
  }

  user.password = newPassword
  await user.save()

  logger.info('Password changed', { userId: user._id.toString() })
}

export const getUserById = async (targetUserId, requestorRole) => {
  const user = await User.findById(targetUserId).lean()
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (
    (user.role === 'super_admin' || user.role === 'admin') &&
    !['super_admin', 'admin'].includes(requestorRole)
  ) {
    throw new AppError('Không có quyền xem thông tin người dùng này', 403, 'FORBIDDEN')
  }

  const profile = sanitizeUser(user)

  if (!['super_admin', 'admin'].includes(requestorRole) && profile.identityNumber) {
    const num = profile.identityNumber
    profile.identityNumber = num.length > 4 ? '*'.repeat(num.length - 4) + num.slice(-4) : '****'
    delete profile.identityFrontImage
    delete profile.identityBackImage
  }

  return { user: profile }
}

export const getUsers = async (query) => {
  const {
    page = 1,
    limit = 20,
    search,
    role,
    status,
    isActive,
    sort = '-createdAt',
    includeDeleted,
  } = query

  const filter = {}

  if (!includeDeleted) {
    filter.deletedAt = null
  }

  if (role) {
    filter.role = role
  }

  if (status) {
    filter.status = status
  }

  if (isActive !== undefined) {
    filter.isActive = isActive
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      { fullName: { $regex: escaped, $options: 'i' } },
    ]
  }

  const sortObj = {}
  for (const field of sort.split(',')) {
    const trimmed = field.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('-')) {
      sortObj[trimmed.slice(1)] = -1
    } else {
      sortObj[trimmed] = 1
    }
  }

  const skip = (page - 1) * limit

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .select(USER_SELECT_PUBLIC)
      .lean(),
    User.countDocuments(filter),
  ])

  return {
    users: users.map((u) => normalizeUserMemberIdentity(u)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const adminUpdateUser = async (targetUserId, data, requestorId, requestorRole) => {
  const user = await User.findById(targetUserId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (user._id.toString() === requestorId.toString()) {
    throw new AppError('Không thể chỉnh sửa chính tài khoản của mình qua route admin', 403)
  }

  if (
    (user.role === 'super_admin' || user.role === 'admin') &&
    requestorRole !== 'super_admin'
  ) {
    throw new AppError('Chỉ Super Admin mới có thể chỉnh sửa tài khoản admin', 403)
  }

  if (data.role !== undefined && requestorRole !== 'super_admin') {
    throw new AppError('Chỉ Super Admin mới có thể thay đổi vai trò', 403)
  }

  const allowedFields = [
    'name',
    'fullName',
    'email',
    'phone',
    'dateOfBirth',
    'gender',
    'isActive',
    'nationality',
    'language',
    'timezone',
    'country',
    'province',
    'detailedAddress',
    'bio',
    'role',
  ]

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      user[field] = data[field]
    }
  }

  await user.save({ validateBeforeSave: false })

  logger.info('Admin updated user', {
    adminId: requestorId.toString(),
    targetUserId: user._id.toString(),
  })

  const refreshed = await User.findById(user._id).select(USER_SELECT_PUBLIC).lean()
  return { user: normalizeUserMemberIdentity(refreshed) }
}

export const changeUserRole = async (targetUserId, role, requestorId) => {
  if (targetUserId === requestorId.toString()) {
    throw new AppError('Không thể thay đổi vai trò của chính mình', 403)
  }

  const user = await User.findById(targetUserId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (user.role === 'super_admin') {
    throw new AppError('Không thể thay đổi vai trò của Super Admin khác', 403)
  }

  const previousRole = user.role
  user.role = role
  await user.save({ validateBeforeSave: false })

  logger.info('User role changed', {
    adminId: requestorId.toString(),
    targetUserId: user._id.toString(),
    previousRole,
    newRole: role,
  })
}

export const activateUserAccount = async (targetUserId, requestorId) => {
  if (targetUserId === requestorId.toString()) {
    throw new AppError('Không thể thay đổi trạng thái của chính mình', 403)
  }

  const user = await User.findById(targetUserId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (user.deletedAt) {
    throw new AppError('Không thể kích hoạt người dùng đã bị xóa. Hãy khôi phục trước.', 400)
  }

  if (user.isActive && user.status === 'active' && !user.isLocked) {
    throw new AppError('Người dùng đã ở trạng thái hoạt động', 400)
  }

  user.isActive = true
  user.status = 'active'
  user.isLocked = false
  await user.save({ validateBeforeSave: false })

  logger.info('User account activated', {
    adminId: requestorId.toString(),
    targetUserId: user._id.toString(),
  })
}

export const deactivateUserAccount = async (targetUserId, requestorId, requestorRole) => {
  if (targetUserId === requestorId.toString()) {
    throw new AppError('Không thể thay đổi trạng thái của chính mình', 403)
  }

  const user = await User.findById(targetUserId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (
    (user.role === 'super_admin' || user.role === 'admin') &&
    requestorRole !== 'super_admin'
  ) {
    throw new AppError('Chỉ Super Admin mới có thể vô hiệu hóa tài khoản admin', 403)
  }

  if (user.deletedAt) {
    throw new AppError('Người dùng đã bị xóa', 400)
  }

  user.isActive = false
  user.status = 'locked'
  user.isLocked = true
  await user.save({ validateBeforeSave: false })

  logger.info('User account deactivated', {
    adminId: requestorId.toString(),
    targetUserId: user._id.toString(),
  })
}

export const softDeleteUser = async (targetUserId, requestorId, requestorRole) => {
  if (targetUserId === requestorId.toString()) {
    throw new AppError('Không thể xóa chính tài khoản của mình', 400)
  }

  const user = await User.findById(targetUserId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (user.role === 'super_admin') {
    throw new AppError('Không thể xóa tài khoản Super Admin', 403)
  }

  if (user.deletedAt) {
    throw new AppError('Người dùng đã bị xóa trước đó', 400)
  }

  user.deletedAt = new Date()
  user.isActive = false
  await user.save({ validateBeforeSave: false })

  logger.info('User soft deleted', {
    adminId: requestorId.toString(),
    targetUserId: user._id.toString(),
  })
}

export const restoreUser = async (targetUserId, requestorId) => {
  if (targetUserId === requestorId.toString()) {
    throw new AppError('Không thể khôi phục chính tài khoản của mình', 400)
  }

  const user = await User.findById(targetUserId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (!user.deletedAt) {
    throw new AppError('Người dùng chưa bị xóa', 400)
  }

  user.deletedAt = null
  user.isActive = true
  await user.save({ validateBeforeSave: false })

  logger.info('User restored', {
    adminId: requestorId.toString(),
    targetUserId: user._id.toString(),
  })
}
