import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { jwt as jwtConfig } from '../config/env.js'
import RefreshToken from '../models/RefreshToken.js'
import User from '../models/User.js'
import AppError from '../utils/appError.js'

const hashToken = (rawToken) => {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.expiresIn,
      issuer: 'gym-system',
      audience: 'user',
    },
  )
}

export const generateRefreshToken = async (user, deviceInfo = {}) => {
  const rawToken = crypto.randomBytes(40).toString('hex')
  const family = crypto.randomUUID()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const existingCount = await RefreshToken.countActiveByUser(user._id)
  if (existingCount >= 3) {
    const oldest = await RefreshToken.findOne({ userId: user._id, isRevoked: false })
      .sort({ createdAt: 1 })
    if (oldest) {
      oldest.isRevoked = true
      await oldest.save()
    }
  }

  await RefreshToken.create({
    userId: user._id,
    token: tokenHash,
    family,
    deviceInfo: {
      userAgent: deviceInfo.userAgent || '',
      ip: deviceInfo.ip || '',
      platform: deviceInfo.platform || '',
    },
    expiresAt,
  })

  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() })

  return { token: rawToken, expiresAt, family }
}

export const verifyAccessToken = async (token) => {
  let decoded
  try {
    decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: 'gym-system',
      audience: 'user',
    })
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired', 401, 'AUTH_TOKEN_EXPIRED')
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid access token', 401, 'AUTH_INVALID_TOKEN')
    }
    throw new AppError('Token verification failed', 401, 'AUTH_INVALID_TOKEN')
  }

  const user = await User.findById(decoded.id).select('+password +passwordHash')
  if (!user) {
    throw new AppError('User belonging to this token no longer exists', 401, 'AUTH_USER_NOT_FOUND')
  }

  if (!user.isActive) {
    throw new AppError('User account is deactivated', 403, 'AUTH_USER_INACTIVE')
  }

  if (user.status === 'locked' && user.isLocked) {
    throw new AppError('User account is locked', 423, 'AUTH_USER_LOCKED')
  }

  if (user.changedPasswordAfter(decoded.iat)) {
    throw new AppError('Password changed after token was issued', 401, 'AUTH_TOKEN_EXPIRED')
  }

  return { user, decoded }
}

export const rotateRefreshToken = async (rawToken) => {
  if (!rawToken) {
    throw new AppError('Refresh token is required', 401, 'AUTH_INVALID_TOKEN')
  }

  const tokenHash = hashToken(rawToken)
  const family = await RefreshToken.rotate(tokenHash)

  const existing = await RefreshToken.findOne({ token: tokenHash })
  if (!existing) {
    throw new AppError('Refresh token not found', 401, 'AUTH_TOKEN_EXPIRED')
  }

  const newRawToken = crypto.randomBytes(40).toString('hex')
  const newTokenHash = hashToken(newRawToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await RefreshToken.create({
    userId: existing.userId,
    token: newTokenHash,
    family,
    deviceInfo: existing.deviceInfo || {},
    expiresAt,
  })

  return { token: newRawToken, expiresAt, family }
}

export const decodeToken = (token) => {
  return jwt.decode(token, { complete: true })
}

export const revokeAllUserTokens = async (userId) => {
  return RefreshToken.revokeAllForUser(userId)
}

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  rotateRefreshToken,
  decodeToken,
  revokeAllUserTokens,
}
