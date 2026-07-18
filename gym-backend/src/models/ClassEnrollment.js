import mongoose from 'mongoose'

const classEnrollmentSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainingClass',
    required: true,
    index: true,
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active',
    index: true,
  },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
  sourceReason: {
    type: String,
    enum: ['assigned_by_pt', 'ended_by_pt', 'ended_by_admin', 'member_request', 'auto_migrated', 'transfer_class'],
    default: 'assigned_by_pt',
  },
  note: { type: String, default: '' },
}, { timestamps: true })

classEnrollmentSchema.index({ classId: 1, memberId: 1, status: 1 })
classEnrollmentSchema.index({ classId: 1, status: 1 })
classEnrollmentSchema.index({ memberId: 1, status: 1 })

export default mongoose.models.ClassEnrollment || mongoose.model('ClassEnrollment', classEnrollmentSchema)