import mongoose from 'mongoose'

const workoutReportSchema = new mongoose.Schema(
  {
    workoutTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workout',
      required: true,
      index: true,
    },
    reporterTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      enum: ['wrong_expertise', 'incorrect_content', 'missing_info', 'spam', 'duplicate', 'other'],
    },
    detail: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'rejected'],
      default: 'pending',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolution: {
      type: String,
      default: '',
      trim: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

workoutReportSchema.index({ workoutTemplateId: 1, status: 1 })
workoutReportSchema.index({ reporterTrainerId: 1, status: 1 })
workoutReportSchema.index({ status: 1, createdAt: -1 })

export default mongoose.models.WorkoutReport || mongoose.model('WorkoutReport', workoutReportSchema)
