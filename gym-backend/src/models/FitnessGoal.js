import mongoose from 'mongoose'

const fitnessGoalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ['weight_loss', 'muscle_gain', 'maintenance', 'endurance', 'custom'],
      required: true,
    },

    targetWeight: {
      type: Number,
      min: 0,
      default: null,
    },

    targetBodyFatPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    targetDate: {
      type: Date,
      default: null,
    },

    currentValue: {
      type: Number,
      min: 0,
      default: null,
    },

    startValue: {
      type: Number,
      min: 0,
      default: null,
    },

    progressPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true },
)

fitnessGoalSchema.index({ userId: 1, isActive: 1 })
fitnessGoalSchema.index({ userId: 1, type: 1 })

export default mongoose.models.FitnessGoal || mongoose.model('FitnessGoal', fitnessGoalSchema)
