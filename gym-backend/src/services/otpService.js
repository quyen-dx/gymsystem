import bcrypt from 'bcrypt'
import Otp from '../models/Otp.js'
import AppError from '../utils/appError.js'
import { sendOtpEmail } from './emailService.js'
import { sendOtpSms } from './smsService.js'

const OTP_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString()

export const sendOtp = async ({ identifier, purpose, channel, provider = null, payload = {} }) => {
  const existingOtp = await Otp.findOne({ identifier, purpose })
  const now = Date.now()

  if (existingOtp?.resendAvailableAt && existingOtp.resendAvailableAt.getTime() > now) {
    const waitSeconds = Math.ceil((existingOtp.resendAvailableAt.getTime() - now) / 1000)
    throw new AppError(`Vui lòng chờ ${waitSeconds} giây trước khi gửi lại mã OTP`, 429)
  }

  const otp = generateOtpCode()
  const expiresAt = new Date(now + OTP_TTL_MS)
  const resendAvailableAt = new Date(now + RESEND_COOLDOWN_MS)

  const record = await Otp.findOneAndUpdate(
    { identifier, purpose },
    {
      identifier,
      otp,
      purpose,
      channel,
      provider,
      payload,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  )

  if (channel === 'email') {
    await sendOtpEmail({ toEmail: identifier, otp, purpose })
  } else {
    await sendOtpSms({ phone: identifier, otp, purpose })
  }

  return {
    message: 'Mã OTP đã được gửi thành công',
    expiresIn: OTP_TTL_MS / 1000,
    resendAfter: RESEND_COOLDOWN_MS / 1000,
    ...(process.env.NODE_ENV !== 'production' ? { otpPreview: otp } : {}),
    record,
  }
}

export const verifyOtp = async ({ identifier, purpose, otp }) => {
  const record = await Otp.findOne({ identifier, purpose })

  if (!record) {
    throw new AppError('Không tìm thấy mã OTP. Vui lòng yêu cầu gửi lại mã', 400)
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ _id: record._id })
    throw new AppError('Mã OTP đã hết hạn', 400)
  }

  if (record.otp !== otp) {
    record.attempts += 1
    await record.save()
    throw new AppError('Mã OTP không đúng', 400)
  }

  return record
}

export const consumeOtp = async (recordId) => {
  await Otp.deleteOne({ _id: recordId })
}

export const hashPendingPassword = async (password) => {
  if (!password) return null
  return bcrypt.hash(password, 12)
}
