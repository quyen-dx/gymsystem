import mongoose from 'mongoose'

const mealLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      default: 'snack',
    },

    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Food',
      default: null,
    },

    foodName: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      min: 0,
      default: 1,
    },

    unit: {
      type: String,
      enum: ['g', 'ml', 'serving', 'piece'],
      default: 'serving',
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

    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true },
)

mealLogSchema.index({ userId: 1, date: -1 })
mealLogSchema.index({ userId: 1, mealType: 1, date: -1 })
mealLogSchema.index({ foodId: 1, date: -1 })

export default mongoose.models.MealLog || mongoose.model('MealLog', mealLogSchema)
