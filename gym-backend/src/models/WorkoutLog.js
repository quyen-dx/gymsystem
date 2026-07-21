import mongoose from 'mongoose'

const workoutLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    workoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workout',
      default: null,
      index: true,
    },

    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise',
      default: null,
    },

    exerciseName: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    actualSets: {
      type: Number,
      min: 0,
      default: 0,
    },

    actualReps: {
      type: Number,
      min: 0,
      default: 0,
    },

    weight: {
      type: Number,
      min: 0,
      default: 0,
    },

    durationMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    rpe: {
      type: Number,
      min: 1,
      max: 10,
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

workoutLogSchema.index({ userId: 1, date: -1 })
workoutLogSchema.index({ workoutId: 1, date: -1 })
workoutLogSchema.index({ exerciseId: 1, date: -1 })

export default mongoose.models.WorkoutLog || mongoose.model('WorkoutLog', workoutLogSchema)
