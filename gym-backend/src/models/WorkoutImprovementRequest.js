import mongoose from 'mongoose'

const workoutImprovementRequestSchema = new mongoose.Schema(
  {
    workoutTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workout',
      required: true,
      index: true,
    },
    senderTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
)

workoutImprovementRequestSchema.index({ receiverTrainerId: 1, status: 1 })
workoutImprovementRequestSchema.index({ workoutTemplateId: 1, status: 1 })

export default mongoose.models.WorkoutImprovementRequest || mongoose.model('WorkoutImprovementRequest', workoutImprovementRequestSchema)
