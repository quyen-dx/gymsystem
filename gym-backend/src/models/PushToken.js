import mongoose from 'mongoose'

const pushTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId là bắt buộc'],
    },
    token: {
      type: String,
      required: [true, 'Push token là bắt buộc'],
      trim: true,
    },
    platform: {
      type: String,
      enum: ['web', 'ios', 'android'],
      required: [true, 'Nền tảng là bắt buộc'],
    },
    deviceId: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

pushTokenSchema.index({ userId: 1, platform: 1 })
pushTokenSchema.index({ token: 1 })

pushTokenSchema.statics.deactivateToken = async function (token) {
  return this.findOneAndUpdate({ token }, { isActive: false }, { new: true })
}

pushTokenSchema.statics.getActiveTokensForUser = async function (userId) {
  const tokens = await this.find({ userId, isActive: true }).select('token platform').lean()
  return tokens
}

const PushToken = mongoose.models.PushToken || mongoose.model('PushToken', pushTokenSchema)

export default PushToken
