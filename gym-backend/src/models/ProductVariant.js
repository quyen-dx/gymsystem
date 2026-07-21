import mongoose from 'mongoose'

const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    price: {
      type: Number,
      min: 0,
      default: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    reserved: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
)

productVariantSchema.index({ productId: 1, isActive: 1 })
productVariantSchema.index({ sku: 1 }, { unique: true })
productVariantSchema.index({ productId: 1, sortOrder: 1 })

export default mongoose.models.ProductVariant || mongoose.model('ProductVariant', productVariantSchema)
