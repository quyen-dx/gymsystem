import mongoose from 'mongoose'

const shiftSwapItemSchema = new mongoose.Schema({
  swapRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftSwapRequest', required: true, index: true },
  workoutScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutSchedule', required: true },
  sessionIndex: { type: Number, required: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingClass' },
  className: { type: String, default: '' },
  classCode: { type: String, default: '' },
  sessionTime: { type: String, default: '' },
  sessionTitle: { type: String, default: '' },
  specialization: { type: String, default: '' },
  goals: { type: [String], default: [] },
  healthNotes: { type: String, default: '' },
}, { timestamps: true })

export default mongoose.models.ShiftSwapItem || mongoose.model('ShiftSwapItem', shiftSwapItemSchema)
