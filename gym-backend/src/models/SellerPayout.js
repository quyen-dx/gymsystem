import mongoose from 'mongoose'

const sellerPayoutSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    method: {
      type: String,
      enum: ['wallet', 'bank_transfer'],
      default: 'wallet',
    },
    settledAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

sellerPayoutSchema.index({ sellerId: 1, createdAt: -1 })
sellerPayoutSchema.index({ orderId: 1 }, { unique: true })

export default mongoose.model('SellerPayout', sellerPayoutSchema)
