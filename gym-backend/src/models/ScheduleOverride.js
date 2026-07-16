import mongoose from 'mongoose'

const scheduleOverrideSchema = new mongoose.Schema({
  swapRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftSwapRequest', default: null, index: true },
  swapItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftSwapItem', default: null },
  replacementRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainerReplacementRequest', default: null, index: true },
  workoutScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutSchedule', required: true, index: true },
  sessionIndex: { type: Number, required: true },
  originalPtId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  overridePtId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  overrideLocation: { type: String, default: '' },
  effectiveDate: { type: Date, required: true, index: true },
}, { timestamps: true })

scheduleOverrideSchema.index({ workoutScheduleId: 1, sessionIndex: 1, effectiveDate: 1 }, { unique: true })

export default mongoose.models.ScheduleOverride || mongoose.model('ScheduleOverride', scheduleOverrideSchema)
