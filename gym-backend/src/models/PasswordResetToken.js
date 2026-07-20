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
  const rawToken = crypto.randomBytes(32).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  const doc = await this.create({ userId, token: hashedToken, expiresAt })
  return { doc, rawToken }
}

passwordResetTokenSchema.statics.consume = async function (rawToken) {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
  return this.findOneAndUpdate(
    {
      token: hashedToken,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { usedAt: new Date() },
    { new: true },
  )
}

const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema)

export default PasswordResetToken
