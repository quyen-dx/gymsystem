import mongoose from 'mongoose'
import crypto from 'crypto'

const passwordResetTokenSchema = new mongoose.Schema(
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
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

passwordResetTokenSchema.index({ token: 1 }, { unique: true })
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 })

passwordResetTokenSchema.statics.generate = async function (userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  return this.create({ userId, token, expiresAt })
}

passwordResetTokenSchema.statics.consume = async function (token) {
  return this.findOneAndUpdate(
    {
      token,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { usedAt: new Date() },
    { new: true },
  )
}

const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema)

export default PasswordResetToken
