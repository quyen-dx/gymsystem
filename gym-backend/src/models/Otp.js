import crypto from 'crypto'
import mongoose from 'mongoose'

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    code: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'register',
        'forgot_password',
        'password_reset',
        'email_change',
        'email_verification',
        'phone_verification',
        'login',
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms'],
      required: true,
    },
    provider: {
      type: String,
      default: null,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    resendAvailableAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

otpSchema.index({ identifier: 1, type: 1 }, { unique: true })
otpSchema.index({ userId: 1, type: 1 })
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 2100 })
otpSchema.index({ lockedUntil: 1 })

otpSchema.statics.generate = async function (userId, type) {
  const code = crypto.randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  return this.create({ userId, code, type, expiresAt })
}

const OTP = mongoose.model('OTP', otpSchema)

export default OTP
