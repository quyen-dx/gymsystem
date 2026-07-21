import mongoose from 'mongoose'

const inventoryReservationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: ['reserved', 'released', 'deducted', 'expired'],
      default: 'reserved',
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    notes: {
      type: String,
      default: '',
      trim: true,
    },

    inventoryRestored: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
)

inventoryReservationSchema.index({ userId: 1, status: 1 })
inventoryReservationSchema.index({ expiresAt: 1, status: 1 })
inventoryReservationSchema.index({ productId: 1, variantId: 1, status: 1 })

export default mongoose.models.InventoryReservation || mongoose.model('InventoryReservation', inventoryReservationSchema)
