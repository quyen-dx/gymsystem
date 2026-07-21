import mongoose from 'mongoose'

const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    muscleGroup: {
      type: [String],
      default: [],
    },

    equipment: {
      type: [String],
      default: [],
    },

    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
    },

    description: {
      type: String,
      default: '',
      trim: true,
    },

    mediaUrls: {
      type: [String],
      default: [],
    },

    category: {
      type: String,
      default: '',
      trim: true,
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

exerciseSchema.index({ name: 1 }, { unique: true })
exerciseSchema.index({ muscleGroup: 1, isActive: 1 })
exerciseSchema.index({ equipment: 1, isActive: 1 })
exerciseSchema.index({ difficulty: 1, isActive: 1 })
exerciseSchema.index({ category: 1, isActive: 1 })
exerciseSchema.index({ name: 'text', description: 'text' })

export default mongoose.models.Exercise || mongoose.model('Exercise', exerciseSchema)
