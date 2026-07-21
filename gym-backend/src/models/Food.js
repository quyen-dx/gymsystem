import mongoose from 'mongoose'

const foodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
      trim: true,
    },

    category: {
      type: String,
      default: '',
      trim: true,
    },

    servingSize: {
      type: String,
      default: '',
      trim: true,
    },

    calories: {
      type: Number,
      min: 0,
      default: 0,
    },

    protein_g: {
      type: Number,
      min: 0,
      default: 0,
    },

    carbs_g: {
      type: Number,
      min: 0,
      default: 0,
    },

    fat_g: {
      type: Number,
      min: 0,
      default: 0,
    },

    fiber_g: {
      type: Number,
      min: 0,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  { timestamps: true },
)

foodSchema.index({ name: 1 }, { unique: true })
foodSchema.index({ category: 1, isActive: 1 })
foodSchema.index({ name: 'text', description: 'text' })

export default mongoose.models.Food || mongoose.model('Food', foodSchema)
