import crypto from 'crypto'
import User from '../models/User.js'
import RefreshToken from '../models/RefreshToken.js'
import PasswordResetToken from '../models/PasswordResetToken.js'
import AppError from '../utils/appError.js'
import logger from '../config/logger.js'
import * as tokenService from './tokenService.js'
import * as otpService from './otpService.js'
import { sendPasswordResetEmail } from './emailService.js'

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex')

export const register = async ({ email, password, name }) => {
  const existing = await User.findOne({ email }).select('_id').lean()
  if (existing) {
    throw new AppError('Email đã được sử dụng', 409, 'AUTH_EMAIL_EXISTS')
  }

  const user = await User.create({
    email,
    passwordHash: password,
    name,
    role: 'member',
    provider: 'email',
  })

  try {
    await otpService.sendOtp({
      identifier: email,
      purpose: 'email_verification',
      channel: 'email',
      provider: 'email',
      payload: { userId: user._id.toString() },
      exposePreview: process.env.NODE_ENV !== 'production',
    })
  } catch (err) {
    await User.findByIdAndDelete(user._id)
    throw err
  }

  logger.info('User registered', { userId: user._id, email })

  return user
}

export const login = async (email, password, deviceInfo = {}) => {
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user) {
    throw new AppError('Email hoặc mật khẩu không đúng', 401, 'AUTH_INVALID_CREDENTIALS')
  }

  if (!user.isActive) {
    throw new AppError('Tài khoản đã bị vô hiệu hóa', 403, 'AUTH_USER_INACTIVE')
  }

  if (user.status === 'locked' || user.isLocked) {
    throw new AppError('Tài khoản đã bị khóa', 423, 'AUTH_USER_LOCKED')
  }

  if (!user.isVerified && user.provider === 'email') {
    throw new AppError('Vui lòng xác thực email trước khi đăng nhập', 403, 'AUTH_EMAIL_UNVERIFIED')
  }

  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    throw new AppError('Email hoặc mật khẩu không đúng', 401, 'AUTH_INVALID_CREDENTIALS')
  }

  const accessToken = tokenService.generateAccessToken(user)
  const refreshResult = await tokenService.generateRefreshToken(user, deviceInfo)

  logger.info('User logged in', { userId: user._id })

  return {
    accessToken,
    refreshToken: refreshResult.token,
    refreshExpiresAt: refreshResult.expiresAt,
    user,
  }
}

export const logout = async (rawToken) => {
  if (!rawToken) return
  const tokenHash = hashToken(rawToken)
  await RefreshToken.findOneAndUpdate(
    { token: tokenHash, isRevoked: false },
    { isRevoked: true },
  )
}

export const logoutAll = async (userId) => {
  await RefreshToken.revokeAllForUser(userId)
}

export const refreshAccessToken = async (rawToken) => {
  const rotated = await tokenService.rotateRefreshToken(rawToken)

  const newTokenHash = hashToken(rotated.token)
  const newRecord = await RefreshToken.findOne({ token: newTokenHash }).select('userId').lean()
  if (!newRecord) {
    throw new AppError('Token không hợp lệ', 401, 'AUTH_INVALID_TOKEN')
  }

  const user = await User.findById(newRecord.userId).select('_id role').lean()
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 401, 'AUTH_USER_NOT_FOUND')
  }

  const accessToken = tokenService.generateAccessToken(user)

  return {
    accessToken,
    refreshToken: rotated.token,
    refreshExpiresAt: rotated.expiresAt,
  }
}

export const verifyEmail = async (email, otp) => {
  const record = await otpService.verifyOtp({
    identifier: email,
    purpose: 'email_verification',
    otp,
  })

  await otpService.consumeOtp(record._id)

  const userId = record.userId || record.payload?.userId
  if (!userId) {
    throw new AppError('Không tìm thấy thông tin xác thực', 400, 'OTP_INVALID')
  }

  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  if (user.isVerified) {
    throw new AppError('Email đã được xác thực trước đó', 400, 'AUTH_ALREADY_VERIFIED')
  }

  user.isVerified = true
  await user.save()

  logger.info('Email verified', { userId: user._id, email })

  return user
}

export const resendVerificationOtp = async (email) => {
  const user = await User.findOne({ email }).select('_id isVerified').lean()
  if (!user) {
    return { message: 'Nếu email tồn tại và chưa xác thực, mã OTP mới sẽ được gửi.' }
  }

  if (user.isVerified) {
    return { message: 'Nếu email tồn tại và chưa xác thực, mã OTP mới sẽ được gửi.' }
  }

  await otpService.sendOtp({
    identifier: email,
    purpose: 'email_verification',
    channel: 'email',
    provider: 'email',
    payload: { userId: user._id.toString() },
    exposePreview: process.env.NODE_ENV !== 'production',
  })

  return { message: 'Nếu email tồn tại và chưa xác thực, mã OTP mới sẽ được gửi.' }
}

export const forgotPassword = async (email) => {
  const user = await User.findOne({ email }).select('_id').lean()
  if (!user) {
    return { message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.' }
  }

  const { rawToken } = await PasswordResetToken.generate(user._id)

  await sendPasswordResetEmail({ toEmail: email, resetToken: rawToken })

  logger.info('Password reset requested', { userId: user._id, email })

  return {
    message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.',
  }
}

export const resetPassword = async (token, newPassword) => {
  const consumed = await PasswordResetToken.consume(token)
  if (!consumed) {
    throw new AppError('Token không hợp lệ hoặc đã hết hạn', 400, 'AUTH_INVALID_RESET_TOKEN')
  }

  const user = await User.findById(consumed.userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  user.passwordHash = newPassword
  await user.save()

  await RefreshToken.revokeAllForUser(user._id)

  logger.info('Password reset completed', { userId: user._id })
}
