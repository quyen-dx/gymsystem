import mongoose from 'mongoose'

const otpSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['register', 'forgot_password'],
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms'],
      required: true,
    },
    provider: {
      type: String,
      enum: ['google', 'facebook', 'phone'],
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
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
)

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
otpSchema.index({ identifier: 1, purpose: 1 }, { unique: true })

const Otp = mongoose.model('Otp', otpSchema)

export default Otp
