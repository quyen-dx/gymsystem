import mongoose from 'mongoose'
import AppError from '../utils/appError.js'

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    family: {
      type: String,
      required: true,
    },
    deviceInfo: {
      userAgent: { type: String, default: '' },
      ip: { type: String, default: '' },
      platform: { type: String, default: '' },
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
)

refreshTokenSchema.index({ token: 1 }, { unique: true })
refreshTokenSchema.index({ userId: 1, family: 1 })
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 604800 })

refreshTokenSchema.statics.rotate = async function (token) {
  const existing = await this.findOneAndUpdate(
    { token, isRevoked: false, expiresAt: { $gt: new Date() } },
    { isRevoked: true },
    { new: true },
  )

  if (!existing) {
    const previouslyRevoked = await this.findOne({ token })
    if (previouslyRevoked) {
      await this.revokeFamily(previouslyRevoked.family)
      throw new AppError('Token reuse detected — family revoked', 401, 'TOKEN_THEFT_DETECTED')
    }
    throw new AppError('Refresh token not found or expired', 401, 'AUTH_TOKEN_EXPIRED')
  }

  return existing.family
}

refreshTokenSchema.statics.revokeFamily = async function (family) {
  return this.updateMany({ family, isRevoked: false }, { isRevoked: true })
}

refreshTokenSchema.statics.revokeAllForUser = async function (userId) {
  return this.updateMany({ userId, isRevoked: false }, { isRevoked: true })
}

refreshTokenSchema.statics.countActiveByUser = async function (userId) {
  return this.countDocuments({
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  })
}

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema)

export default RefreshToken
