import LoginHistory from '../models/LoginHistory.js'
import RefreshToken from '../models/RefreshToken.js'
import User from '../models/User.js'
import AppError from '../utils/appError.js'
import logger from '../config/logger.js'

export const recordLoginHistory = async (entry) => {
  await LoginHistory.create({
    userId: entry.userId || null,
    action: entry.action,
    ip: entry.ip || '',
    userAgent: entry.userAgent || '',
    platform: entry.platform || '',
    failureReason: entry.failureReason || '',
  })
}

export const getLoginHistory = async (userId, query) => {
  const { page = 1, limit = 20, action } = query

  const filter = { userId }

  if (action) {
    filter.action = action
  }

  const skip = (page - 1) * limit

  const [entries, total] = await Promise.all([
    LoginHistory.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LoginHistory.countDocuments(filter),
  ])

  return {
    entries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const getActiveSessions = async (userId) => {
  const sessions = await RefreshToken.find({
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .select('_id deviceInfo createdAt expiresAt')
    .lean()

  return {
    sessions: sessions.map((s) => ({
      id: s._id,
      deviceInfo: s.deviceInfo || {},
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    })),
    count: sessions.length,
  }
}

export const revokeDevice = async (sessionId, userId) => {
  const session = await RefreshToken.findOne({
    _id: sessionId,
    userId,
  })

  if (!session) {
    throw new AppError('Phiên đăng nhập không tồn tại', 404)
  }

  if (session.isRevoked) {
    throw new AppError('Phiên đăng nhập đã bị hủy', 400)
  }

  session.isRevoked = true
  await session.save()

  logger.info('Device session revoked', { userId: userId.toString(), sessionId })
}

export const revokeAllSessions = async (userId) => {
  const result = await RefreshToken.revokeAllForUser(userId)

  logger.info('All sessions revoked', { userId: userId.toString() })

  return { revokedCount: result.modifiedCount || 0 }
}

export const unlockAccount = async (targetUserId, requestorId) => {
  if (targetUserId === requestorId.toString()) {
    throw new AppError('Không thể mở khóa chính tài khoản của mình', 403)
  }

  const user = await User.findById(targetUserId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (user.role === 'super_admin') {
    throw new AppError('Không thể mở khóa tài khoản Super Admin', 403)
  }

  if (!user.isLocked && user.status !== 'locked') {
    throw new AppError('Tài khoản không bị khóa', 400)
  }

  user.isLocked = false
  user.status = 'active'
  user.isActive = true
  await user.save({ validateBeforeSave: false })

  logger.info('Account unlocked', {
    adminId: requestorId.toString(),
    targetUserId: user._id.toString(),
  })
}

export const cleanupExpiredRefreshTokens = async () => {
  const result = await RefreshToken.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isRevoked: true },
    ],
  })

  logger.info('Expired refresh tokens cleaned up', { deletedCount: result.deletedCount })

  return { deletedCount: result.deletedCount }
}
