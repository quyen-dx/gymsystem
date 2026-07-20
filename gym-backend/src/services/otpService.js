import crypto from 'crypto'
import bcrypt from 'bcrypt'
import OTP from '../models/Otp.js'
import AppError from '../utils/appError.js'
import { sendOtpEmail } from './emailService.js'
import { sendOtpSms } from './smsService.js'

const DEFAULT_OTP_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const LOCKOUT_DURATION_MS = 30 * 60 * 1000
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

const generateOtpCode = () => crypto.randomInt(100000, 999999).toString()

const purposeToType = (purpose) => {
  const map = {
    register: 'register',
    forgot_password: 'forgot_password',
    password_reset: 'password_reset',
    email_change: 'email_change',
    email_verification: 'email_verification',
    phone_verification: 'phone_verification',
    login: 'login',
  }
  return map[purpose] || purpose
}

const INVALID_OTP_MESSAGE = 'Mã OTP không hợp lệ hoặc đã hết hạn.'

export const sendOtp = async ({ identifier, purpose, channel, provider = null, payload = {}, ttlSeconds, exposePreview }) => {
  const normalizedIdentifier = identifier.toLowerCase().trim()
  const type = purposeToType(purpose)
  const now = Date.now()

  const existing = await OTP.findOne({ identifier: normalizedIdentifier, type })

  if (existing?.lockedUntil && existing.lockedUntil.getTime() > now) {
    const waitMinutes = Math.ceil((existing.lockedUntil.getTime() - now) / 60000)
    throw new AppError(
      `Quá nhiều lần thử sai. Vui lòng thử lại sau ${waitMinutes} phút.`,
      429,
      'OTP_ACCOUNT_LOCKED',
    )
  }

  if (existing?.resendAvailableAt && existing.resendAvailableAt.getTime() > now) {
    const waitSeconds = Math.ceil((existing.resendAvailableAt.getTime() - now) / 1000)
    throw new AppError(
      `Vui lòng chờ ${waitSeconds} giây trước khi gửi lại mã OTP.`,
      429,
      'OTP_RESEND_COOLDOWN',
    )
  }

  const code = generateOtpCode()
  const otpTtlMs = Math.max(30, Number(ttlSeconds) || DEFAULT_OTP_TTL_MS / 1000) * 1000
  const expiresAt = new Date(now + otpTtlMs)
  const resendAvailableAt = new Date(now + RESEND_COOLDOWN_MS)

  await OTP.findOneAndUpdate(
    { identifier: normalizedIdentifier, type },
    {
      identifier: normalizedIdentifier,
      code,
      type,
      channel,
      provider,
      payload,
      expiresAt,
      resendAvailableAt,
      consumedAt: null,
      attempts: 0,
      lockedUntil: null,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  if (channel === 'email') {
    await sendOtpEmail({ toEmail: normalizedIdentifier, otp: code, purpose })
  } else {
    await sendOtpSms({ phone: normalizedIdentifier, otp: code, purpose })
  }

  return {
    message: 'Mã OTP đã được gửi thành công',
    expiresIn: otpTtlMs / 1000,
    resendAfter: RESEND_COOLDOWN_MS / 1000,
    ...(exposePreview && process.env.NODE_ENV !== 'production' ? { otpPreview: code } : {}),
  }
}

export const verifyOtp = async ({ identifier, purpose, otp }) => {
  const normalizedIdentifier = identifier.toLowerCase().trim()
  const type = purposeToType(purpose)

  const record = await OTP.findOne({
    identifier: normalizedIdentifier,
    type,
    consumedAt: null,
  })

  if (!record) {
    throw new AppError(INVALID_OTP_MESSAGE, 400, 'OTP_INVALID')
  }

  if (record.lockedUntil && record.lockedUntil.getTime() > Date.now()) {
    const waitMinutes = Math.ceil((record.lockedUntil.getTime() - Date.now()) / 60000)
    throw new AppError(
      `Quá nhiều lần thử sai. Vui lòng thử lại sau ${waitMinutes} phút.`,
      429,
      'OTP_ACCOUNT_LOCKED',
    )
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new AppError(INVALID_OTP_MESSAGE, 400, 'OTP_EXPIRED')
  }

  if (record.code !== otp) {
    const updated = await OTP.findOneAndUpdate(
      { _id: record._id },
      { $inc: { attempts: 1 } },
      { new: true },
    )

    if (!updated) {
      throw new AppError(INVALID_OTP_MESSAGE, 400, 'OTP_INVALID')
    }

    const fifteenMinAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)

    const pastResults = await OTP.aggregate([
      {
        $match: {
          identifier: normalizedIdentifier,
          type,
          _id: { $ne: record._id },
          createdAt: { $gte: fifteenMinAgo },
        },
      },
      { $group: { _id: null, totalAttempts: { $sum: '$attempts' } } },
    ])

    const pastTotal = pastResults[0]?.totalAttempts ?? 0
    const totalAttempts = pastTotal + updated.attempts

    if (totalAttempts >= MAX_ATTEMPTS) {
      await OTP.updateOne(
        { _id: record._id },
        { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
      )
      throw new AppError(
        'Quá nhiều lần thử sai. Vui lòng thử lại sau 30 phút.',
        429,
        'OTP_RATE_LIMIT_EXCEEDED',
      )
    }

    throw new AppError(INVALID_OTP_MESSAGE, 400, 'OTP_INVALID')
  }

  return record
}

export const consumeOtp = async (recordId) => {
  await OTP.updateOne({ _id: recordId }, { consumedAt: new Date() })
}

export const hashPendingPassword = async (password) => {
  if (!password) return null
  return bcrypt.hash(password, 12)
}
