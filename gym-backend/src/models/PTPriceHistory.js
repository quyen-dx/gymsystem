import mongoose from 'mongoose'

const ptPriceHistorySchema = new mongoose.Schema(
  {
    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    priceType: {
      type: String,
      enum: ['ONE_TO_ONE', 'GROUP'],
      required: true,
    },
    oldPrice: {
      type: Number,
      default: null,
    },
    newPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
)

ptPriceHistorySchema.index({ ptId: 1, priceType: 1, changedAt: -1 })

export default mongoose.models.PTPriceHistory || mongoose.model('PTPriceHistory', ptPriceHistorySchema)
