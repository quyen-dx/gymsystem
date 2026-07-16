import mongoose from 'mongoose'

const trainerScheduleSchema = new mongoose.Schema({
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  shift: { type: String, enum: ['morning', 'afternoon', 'evening'], required: true },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
}, { timestamps: true })

trainerScheduleSchema.index({ trainerId: 1, dayOfWeek: 1 })

export default mongoose.models.TrainerSchedule || mongoose.model('TrainerSchedule', trainerScheduleSchema)
