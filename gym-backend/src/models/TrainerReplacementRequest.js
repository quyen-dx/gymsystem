import mongoose from 'mongoose'

const trainerReplacementRequestSchema = new mongoose.Schema({
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutSchedule', required: true },
  originalTrainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  replacementTrainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  date: { type: Date, required: true },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  handledAt: Date,
  rejectReason: { type: String, default: '', trim: true },
}, { timestamps: true })

trainerReplacementRequestSchema.index({ originalTrainerId: 1, status: 1 })
trainerReplacementRequestSchema.index({ replacementTrainerId: 1 })

export default mongoose.models.TrainerReplacementRequest || mongoose.model('TrainerReplacementRequest', trainerReplacementRequestSchema)
