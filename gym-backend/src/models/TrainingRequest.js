import mongoose from 'mongoose'

const trainingRequestSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  specialization: { type: String, trim: true, default: 'GYM' },
  goals: [{ type: String, trim: true }],
  desiredSessions: { type: Number, min: 1, max: 7, default: 3 },
  timeSlots: [{ type: String, trim: true }],
  daysOfWeek: [{ type: Number, min: 0, max: 6 }],
  healthNotes: { type: String, default: '', trim: true },
  isNewToGym: { type: Boolean, default: false },
  note: { type: String, default: '', trim: true },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'cancelled'],
    default: 'pending',
    index: true,
  },
  assignedClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingClass', default: null },
  assignedAt: Date,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: Date,
  cancelReason: { type: String, default: '' },
}, { timestamps: true })

trainingRequestSchema.index({ memberId: 1, status: 1 })
trainingRequestSchema.index({ status: 1, createdAt: -1 })

export default mongoose.models.TrainingRequest || mongoose.model('TrainingRequest', trainingRequestSchema)
