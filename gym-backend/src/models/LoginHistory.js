import mongoose from 'mongoose'

const loginHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: ['login', 'login_failed'],
      required: true,
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    platform: {
      type: String,
      default: '',
    },
    failureReason: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false },
)

loginHistorySchema.index({ userId: 1, timestamp: -1 })
loginHistorySchema.index({ action: 1, timestamp: -1 })

const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema)

export default LoginHistory
