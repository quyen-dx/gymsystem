import mongoose from 'mongoose'

const MONTHLY_LIMIT = 50_000_000

const monthlyWithdrawalLimitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
)

monthlyWithdrawalLimitSchema.index({ userId: 1, month: 1 }, { unique: true })

monthlyWithdrawalLimitSchema.statics.attemptReserve = async function ({ userId, month, amount, session }) {
  const limit = MONTHLY_LIMIT

  try {
    const result = await this.findOneAndUpdate(
      { userId, month, total: { $lte: limit - amount } },
      { $inc: { total: amount } },
      { new: true, upsert: true, session },
    )
    return result
  } catch (err) {
    if (err.code === 11000) {
      const result = await this.findOneAndUpdate(
        { userId, month, total: { $lte: limit - amount } },
        { $inc: { total: amount } },
        { new: true, session },
      )
      return result
    }
    throw err
  }
}

export default mongoose.model('MonthlyWithdrawalLimit', monthlyWithdrawalLimitSchema)
