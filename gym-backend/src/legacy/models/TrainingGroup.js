// DEPRECATED: Replaced by TrainingClass model.
// TrainingGroup has been refactored into TrainingClass with new structure (schedule, templateId, no zone).
// This file is kept to prevent import errors during transition.
import mongoose from 'mongoose'

const trainingGroupMemberSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: Date,
}, { _id: false })

const trainingGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  goal: { type: String, default: '', trim: true },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  maxCapacity: { type: Number, default: 15, min: 1 },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  members: { type: [trainingGroupMemberSchema], default: [] },
  description: { type: String, default: '', trim: true },
}, { timestamps: true })

trainingGroupSchema.virtual('memberCount').get(function () {
  return this.members.filter((m) => m.status === 'active').length
})

trainingGroupSchema.set('toJSON', { virtuals: true })
trainingGroupSchema.set('toObject', { virtuals: true })

trainingGroupSchema.index({ trainerId: 1, status: 1 })

export default mongoose.models.TrainingGroup || mongoose.model('TrainingGroup', trainingGroupSchema)
