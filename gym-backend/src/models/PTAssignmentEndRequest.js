import mongoose from 'mongoose'

const ptAssignmentEndRequestSchema = new mongoose.Schema({
  ptId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PTAssignment', default: null },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingClass', default: null },
  reasonType: {
    type: String,
    enum: ['MEMBER_COMPLETED', 'MEMBER_REQUEST_CHANGE_PT', 'MEMBER_QUIT', 'PT_NO_LONGER_TEACHES', 'OTHER'],
    required: true,
  },
  reasonDetail: { type: String, default: '', trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  processedAt: Date,
  rejectReason: { type: String, default: '', trim: true },
}, { timestamps: true })

ptAssignmentEndRequestSchema.index({ ptId: 1, status: 1 })
ptAssignmentEndRequestSchema.index({ status: 1, createdAt: -1 })

export default mongoose.models.PTAssignmentEndRequest || mongoose.model('PTAssignmentEndRequest', ptAssignmentEndRequestSchema)
