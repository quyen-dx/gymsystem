import mongoose from 'mongoose'

const socialAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: String,
      enum: ['google', 'facebook', 'apple'],
      required: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    profileUrl: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
)

socialAccountSchema.index({ provider: 1, providerId: 1 }, { unique: true })
socialAccountSchema.index({ userId: 1 })

const SocialAccount = mongoose.model('SocialAccount', socialAccountSchema)

export default SocialAccount
