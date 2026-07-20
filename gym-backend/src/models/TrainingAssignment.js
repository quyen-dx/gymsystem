import mongoose from 'mongoose'

const trainingAssignmentSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingClass', default: null },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingRequest' },
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
  status: {
    type: String,
    enum: ['waiting_pt', 'active', 'finished', 'cancelled'],
    default: 'waiting_pt',
    index: true,
  },
  acceptedAt: { type: Date, default: null },
  startDate: { type: Date, default: Date.now },
  endDate: Date,
  cancelledAt: Date,
  cancelReason: { type: String, default: '' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

trainingAssignmentSchema.index({ memberId: 1, status: 1 })
trainingAssignmentSchema.index({ classId: 1 })
trainingAssignmentSchema.index({ trainerId: 1, status: 1 })

export default mongoose.models.TrainingAssignment || mongoose.model('TrainingAssignment', trainingAssignmentSchema)
