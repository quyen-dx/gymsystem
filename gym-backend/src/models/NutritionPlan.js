import mongoose from 'mongoose'

const nutritionPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    goal: {
      type: String,
      default: '',
      trim: true,
    },

    dailyCalorieTarget: {
      type: Number,
      min: 0,
      default: 0,
    },

    proteinTarget_g: {
      type: Number,
      min: 0,
      default: 0,
    },

    carbsTarget_g: {
      type: Number,
      min: 0,
      default: 0,
    },

    fatTarget_g: {
      type: Number,
      min: 0,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true },
)

nutritionPlanSchema.index({ userId: 1, isActive: 1 })

export default mongoose.models.NutritionPlan || mongoose.model('NutritionPlan', nutritionPlanSchema)
